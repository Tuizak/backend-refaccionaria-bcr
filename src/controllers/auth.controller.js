const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_change_me";
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || "24h";

/* ─── Helpers ────────────────────────────────────────────── */

function firmarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id_usuario,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      id_sucursal: usuario.id_sucursal,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

/* ─── LOGIN ──────────────────────────────────────────────── */

const login = async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin || !/^\d{4,6}$/.test(String(pin))) {
      return res.status(400).json({
        ok: false,
        message: "PIN inválido. Debe ser numérico de 4 a 6 dígitos.",
      });
    }

    /* Buscamos TODOS los usuarios activos (incluyendo pin hasheado) */
    const [rows] = await pool.query(
      `SELECT id_usuario, nombre, email, pin, rol, id_sucursal, activo
       FROM usuarios
       WHERE activo = 1
       ORDER BY id_usuario ASC`
    );

    if (rows.length === 0) {
      return res.status(401).json({
        ok: false,
        message: "PIN incorrecto o usuario inactivo",
      });
    }

    /* Comparamos el PIN contra cada hash */
    let usuarioEncontrado = null;
    for (const u of rows) {
      const coincide = await bcrypt.compare(String(pin), u.pin);
      if (coincide) {
        usuarioEncontrado = u;
        break;
      }
    }

    /* Si ningún hash coincidió, probamos texto plano (migración) */
    if (!usuarioEncontrado) {
      for (const u of rows) {
        if (u.pin === String(pin)) {
          usuarioEncontrado = u;
          /* Migramos el PIN a hash en background */
          const hash = await bcrypt.hash(String(pin), 10);
          pool.query("UPDATE usuarios SET pin = ? WHERE id_usuario = ?", [hash, u.id_usuario]);
          break;
        }
      }
    }

    if (!usuarioEncontrado) {
      return res.status(401).json({
        ok: false,
        message: "PIN incorrecto o usuario inactivo",
      });
    }

    await pool.query(
      `UPDATE usuarios SET ultimo_acceso = NOW() WHERE id_usuario = ?`,
      [usuarioEncontrado.id_usuario]
    );

    const token = firmarToken(usuarioEncontrado);

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
    console.error("Error en login:", error);
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
