const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_change_me";
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || "24h";

/* ═══════════════════════════════════════════════════════════
   SEGURIDAD: Anti-brute-force en memoria
   - Bloqueo de cuenta tras 5 intentos fallidos (15 min)
   - Delay progresivo para evitar timing attacks
   - Log de intentos sospechosos
   ═══════════════════════════════════════════════════════════ */
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_TIME_MS = 15 * 60 * 1000; // 15 minutos
const PROGRESSIVE_DELAYS = [0, 200, 500, 1000, 2000]; // ms

// Map<ip, { attempts: number, lockedUntil: number, lastAttempt: number }>
const loginAttempts = new Map();

function getClienteIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.headers["x-real-ip"]
    || req.socket?.remoteAddress
    || "unknown";
}

function checkBruteForce(ip) {
  const record = loginAttempts.get(ip);
  if (!record) return { blocked: false, attempts: 0 };

  // Si está bloqueado y el tiempo no ha expirado
  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    const remaining = Math.ceil((record.lockedUntil - Date.now()) / 1000);
    return { blocked: true, attempts: record.attempts, remaining };
  }

  // Si el lockout expiró, resetear
  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    loginAttempts.delete(ip);
    return { blocked: false, attempts: 0 };
  }

  return { blocked: false, attempts: record.attempts };
}

function recordFailedAttempt(ip) {
  const record = loginAttempts.get(ip) || { attempts: 0, lockedUntil: 0, lastAttempt: 0 };
  record.attempts++;
  record.lastAttempt = Date.now();

  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_TIME_MS;
    console.warn(`[SECURITY] IP ${ip} bloqueada por ${MAX_FAILED_ATTEMPTS} intentos fallidos. Lockout: 15 min`);
  }

  loginAttempts.set(ip, record);
}

function recordSuccess(ip) {
  loginAttempts.delete(ip);
}

function getProgressiveDelay(attempts) {
  const idx = Math.min(attempts, PROGRESSIVE_DELAYS.length - 1);
  return PROGRESSIVE_DELAYS[idx];
}

// Limpieza periódica de registros viejos (cada 30 min)
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of loginAttempts.entries()) {
    if (record.lockedUntil && now > record.lockedUntil) {
      loginAttempts.delete(ip);
    } else if (!record.lockedUntil && now - record.lastAttempt > LOCKOUT_TIME_MS) {
      loginAttempts.delete(ip);
    }
  }
}, 30 * 60 * 1000);

/* ─── Helpers ────────────────────────────────────────────── */

function firmarToken(usuario, ip) {
  return jwt.sign(
    {
      id: usuario.id_usuario,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      id_sucursal: usuario.id_sucursal,
      ip: crypto.createHash("sha256").update(ip || "").digest("hex").slice(0, 8),
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

/* Sanitización de entrada: solo permite caracteres seguros */
function sanitizeInput(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[<>"'`;\\]/g, "").trim().slice(0, 20);
}

/* ═══════════════════════════════════════════════════════════
   LOGIN CON PROTECCIÓN ANTI-BRUTE-FORCE
   ═══════════════════════════════════════════════════════════ */
const login = async (req, res) => {
  const ip = getClienteIp(req);
  const inicio = Date.now();

  try {
    const { pin } = req.body;

    // 1. Validación de formato (anti-inyección: solo dígitos)
    if (!pin || !/^\d{4,6}$/.test(String(pin).trim())) {
      // Delay aleatorio para no revelar si el formato es válido
      await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
      return res.status(400).json({
        ok: false,
        message: "PIN inválido. Debe ser numérico de 4 a 6 dígitos.",
      });
    }

    const pinLimpio = String(pin).trim();

    // 2. Verificar brute-force por IP
    const bruteCheck = checkBruteForce(ip);
    if (bruteCheck.blocked) {
      console.warn(`[SECURITY] Login bloqueado desde IP ${ip} — ${bruteCheck.attempts} intentos fallidos. Restan ${bruteCheck.remaining}s`);
      return res.status(429).json({
        ok: false,
        message: `Demasiados intentos fallidos. Intenta de nuevo en ${bruteCheck.remaining} segundos.`,
        retryAfter: bruteCheck.remaining,
      });
    }

    // 3. Delay progresivo anti-timing
    const delay = getProgressiveDelay(bruteCheck.attempts);
    if (delay > 0) {
      await new Promise(r => setTimeout(r, delay));
    }

    // 4. Buscar usuarios activos
    const [rows] = await pool.query(
      `SELECT id_usuario, nombre, email, pin, rol, id_sucursal, activo
       FROM usuarios
       WHERE activo = 1
       ORDER BY id_usuario ASC`
    );

    if (rows.length === 0) {
      recordFailedAttempt(ip);
      return res.status(401).json({ ok: false, message: "PIN incorrecto" });
    }

    // 5. Comparar PIN con bcrypt ( timing-safe )
    let usuarioEncontrado = null;
    for (const u of rows) {
      const coincide = await bcrypt.compare(pinLimpio, u.pin);
      if (coincide) {
        usuarioEncontrado = u;
        break;
      }
    }

    // 6. Migración de texto plano (legacy)
    if (!usuarioEncontrado) {
      for (const u of rows) {
        if (u.pin === pinLimpio) {
          usuarioEncontrado = u;
          const hash = await bcrypt.hash(pinLimpio, 10);
          pool.query("UPDATE usuarios SET pin = ? WHERE id_usuario = ?", [hash, u.id_usuario]);
          break;
        }
      }
    }

    // 7. PIN incorrecto
    if (!usuarioEncontrado) {
      recordFailedAttempt(ip);
      const intentos = loginAttempts.get(ip)?.attempts || 0;
      const restantes = MAX_FAILED_ATTEMPTS - intentos;
      console.warn(`[SECURITY] PIN incorrecto desde IP ${ip}. Intentos: ${intentos}/${MAX_FAILED_ATTEMPTS}`);

      // Delay extra si está cerca del bloqueo
      if (restantes <= 2 && restantes > 0) {
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
      }

      return res.status(401).json({
        ok: false,
        message: "PIN incorrecto",
        ...(restantes > 0 && restantes <= 3 && { intentosRestantes: restantes }),
      });
    }

    // 8. Login exitoso — limpiar intentos
    recordSuccess(ip);

    // 9. Actualizar último acceso
    await pool.query(
      `UPDATE usuarios SET ultimo_acceso = NOW() WHERE id_usuario = ?`,
      [usuarioEncontrado.id_usuario]
    );

    // 10. Firmar token con fingerprint de IP
    const token = firmarToken(usuarioEncontrado, ip);

    const duracion = Date.now() - inicio;
    console.log(`[AUTH] Login exitoso: ${usuarioEncontrado.nombre} (${usuarioEncontrado.rol}) desde IP ${ip} en ${duracion}ms`);

    return res.status(200).json({
      ok: true,
      data: {
        token,
        id_usuario: usuarioEncontrado.id_usuario,
        nombre: usuarioEncontrado.nombre,
        email: usuarioEncontrado.email,
        rol: usuarioEncontrado.rol,
        id_sucursal: usuarioEncontrado.id_sucursal,
      },
    });
  } catch (error) {
    console.error("[SECURITY] Error en login:", error);
    // No revelar detalles del error
    return res.status(500).json({
      ok: false,
      message: "Error interno del servidor",
    });
  }
};

/* ─── VERIFICAR SESIÓN (por JWT) ─────────────────────────── */

const verificarSesion = async (req, res) => {
  try {
    /* req.user ya viene del middleware requireAuth (decodificado del JWT) */
    return res.status(200).json({ ok: true, data: req.user });
  } catch (error) {
    console.error("Error en verificarSesion:", error);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
};

/* ─── LISTAR USUARIOS ────────────────────────────────────── */

const listarUsuarios = async (req, res) => {
  try {
    /* Gerentes solo ven usuarios de su propia sucursal */
    if (req.user.rol === "gerente" && req.user.id_sucursal) {
      const [rows] = await pool.query(
        `SELECT id_usuario, nombre, email, rol, id_sucursal, activo, ultimo_acceso
         FROM usuarios
         WHERE id_sucursal = ?
         ORDER BY id_usuario ASC`,
        [req.user.id_sucursal]
      );
      return res.status(200).json({ ok: true, data: rows });
    }

    /* Superadmin ve todos */
    const [rows] = await pool.query(
      `SELECT id_usuario, nombre, email, rol, id_sucursal, activo, ultimo_acceso
       FROM usuarios
       ORDER BY id_usuario ASC`
    );
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error("Error en listarUsuarios:", error);
    return res.status(500).json({ ok: false, message: "Error al listar usuarios" });
  }
};

/* ─── CREAR USUARIO ──────────────────────────────────────── */

const crearUsuario = async (req, res) => {
  try {
    const { nombre, email, pin, rol, id_sucursal } = req.body;

    if (!nombre || !pin) {
      return res.status(400).json({ ok: false, message: "Nombre y PIN son obligatorios" });
    }

    if (!/^\d{4,6}$/.test(String(pin))) {
      return res.status(400).json({ ok: false, message: "El PIN debe ser numérico de 4 a 6 dígitos" });
    }

    const rolValido = ["gerente", "empleado", "admin", "superadmin"];
    if (rol && !rolValido.includes(rol)) {
      return res.status(400).json({ ok: false, message: "Rol no válido" });
    }

    /* Gerente solo puede crear usuarios en su propia sucursal */
    const sucursalFinal = id_sucursal || req.user.id_sucursal;
    if (req.user.rol === "gerente" && req.user.id_sucursal) {
      if (Number(sucursalFinal) !== Number(req.user.id_sucursal)) {
        return res.status(403).json({ ok: false, message: "No puedes crear usuarios en otra sucursal" });
      }
      /* Gerente no puede crear superadmin ni gerente de otra sucursal */
      if (rol === "superadmin") {
        return res.status(403).json({ ok: false, message: "No puedes crear superadmin" });
      }
    }

    const hash = await bcrypt.hash(String(pin), 10);

    const [resultado] = await pool.query(
      `INSERT INTO usuarios (nombre, email, pin, rol, id_sucursal, activo)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [
        nombre.trim(),
        email?.trim() || null,
        hash,
        rol || "empleado",
        sucursalFinal || null,
      ]
    );

    return res.status(201).json({
      ok: true,
      message: "Usuario creado correctamente",
      data: { id_usuario: resultado.insertId },
    });
  } catch (error) {
    console.error("Error en crearUsuario:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, message: "Ya existe un usuario con ese email o PIN" });
    }
    return res.status(500).json({ ok: false, message: "Error al crear usuario" });
  }
};

/* ─── TOGGLE USUARIO ─────────────────────────────────────── */

const toggleUsuario = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: "ID no válido" });
    }

    const [rows] = await pool.query(
      "SELECT activo FROM usuarios WHERE id_usuario = ? LIMIT 1",
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ ok: false, message: "Usuario no encontrado" });
    }

    const nuevoEstado = rows[0].activo ? 0 : 1;
    await pool.query("UPDATE usuarios SET activo = ? WHERE id_usuario = ?", [nuevoEstado, id]);

    return res.status(200).json({
      ok: true,
      message: nuevoEstado ? "Usuario activado" : "Usuario desactivado",
    });
  } catch (error) {
    console.error("Error en toggleUsuario:", error);
    return res.status(500).json({ ok: false, message: "Error al cambiar estado" });
  }
};

/* ─── ACTUALIZAR USUARIO ─────────────────────────────────── */

const actualizarUsuario = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombre, email, pin, rol, id_sucursal } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: "ID no válido" });
    }

    const [existe] = await pool.query("SELECT id_usuario FROM usuarios WHERE id_usuario = ? LIMIT 1", [id]);
    if (!existe.length) {
      return res.status(404).json({ ok: false, message: "Usuario no encontrado" });
    }

    const updates = [];
    const params = [];

    if (nombre) { updates.push("nombre = ?"); params.push(nombre.trim()); }
    if (email !== undefined) { updates.push("email = ?"); params.push(email?.trim() || null); }
    if (pin) {
      if (!/^\d{4,6}$/.test(String(pin))) {
        return res.status(400).json({ ok: false, message: "El PIN debe ser numérico de 4 a 6 dígitos" });
      }
      const hash = await bcrypt.hash(String(pin), 10);
      updates.push("pin = ?"); params.push(hash);
    }
    if (rol) { updates.push("rol = ?"); params.push(rol); }
    if (id_sucursal !== undefined) { updates.push("id_sucursal = ?"); params.push(id_sucursal || null); }

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, message: "No hay campos para actualizar" });
    }

    params.push(id);
    await pool.query(`UPDATE usuarios SET ${updates.join(", ")} WHERE id_usuario = ?`, params);

    return res.status(200).json({ ok: true, message: "Usuario actualizado correctamente" });
  } catch (error) {
    console.error("Error en actualizarUsuario:", error);
    return res.status(500).json({ ok: false, message: "Error al actualizar usuario" });
  }
};

module.exports = {
  login,
  verificarSesion,
  listarUsuarios,
  crearUsuario,
  toggleUsuario,
  actualizarUsuario,
};
