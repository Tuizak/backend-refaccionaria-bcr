const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_change_me";

/* ═══════════════════════════════════════════════════════════
   SEGURIDAD: Detección de patrones sospechosos
   ═══════════════════════════════════════════════════════════ */
const suspiciousIps = new Map();

function flagSuspicious(ip, reason) {
  const record = suspiciousIps.get(ip) || { count: 0, reasons: [] };
  record.count++;
  record.reasons.push({ reason, time: Date.now() });
  record.lastSeen = Date.now();
  suspiciousIps.set(ip, record);

  if (record.count >= 10) {
    console.warn(`[SECURITY] IP ${ip} marcada como SOSPECHOSA (${record.count} incidentes): ${reason}`);
  }
}

function getClientIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.headers["x-real-ip"]
    || req.socket?.remoteAddress
    || "unknown";
}

/**
 * requireAuth — valida el JWT del header Authorization.
 * Si es válido, decodifica el token y adjunta req.user.
 * Verifica: token válido, usuario activo, IP fingerprint.
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const ip = getClientIp(req);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      ok: false,
      message: "Acceso no autorizado. Inicia sesión.",
    });
  }

  const token = authHeader.split(" ")[1];

  // Validar formato del token (anti-inyección)
  if (!token || typeof token !== "string" || token.length > 2048 || /[<>"'`;\\]/.test(token)) {
    flagSuspicious(ip, "Token con formato sospechoso");
    return res.status(401).json({ ok: false, message: "Token inválido." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verificar IP fingerprint del token
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 8);
    if (decoded.ip && decoded.ip !== ipHash) {
      flagSuspicious(ip, `IP mismatch: token hash=${decoded.ip}, actual=${ipHash}`);
      // No bloquear pero registrar — la IP puede cambiar en移动
      // En producción strict: return res.status(401)...
    }

    /* Verificamos que el usuario siga activo en BD */
    const [rows] = await pool.query(
      `SELECT id_usuario, nombre, rol, id_sucursal, activo
       FROM usuarios
       WHERE id_usuario = ? AND activo = 1
       LIMIT 1`,
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no válido o inactivo.",
      });
    }

    req.user = rows[0];
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        ok: false,
        message: "Sesión expirada. Inicia sesión nuevamente.",
      });
    }
    if (error.name === "JsonWebTokenError") {
      flagSuspicious(ip, "JWT inválido");
      return res.status(401).json({
        ok: false,
        message: "Token inválido.",
      });
    }
    console.error("Error en requireAuth:", error);
    return res.status(500).json({
      ok: false,
      message: "Error interno de autenticación",
    });
  }
};

/**
 * requireGerente — exige que el usuario autenticado sea gerente o superadmin.
 * Debe usarse DESPUÉS de requireAuth.
 */
const requireGerente = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      ok: false,
      message: "Acceso no autorizado",
    });
  }

  if (req.user.rol !== "gerente" && req.user.rol !== "superadmin") {
    return res.status(403).json({
      ok: false,
      message: "Se requieren permisos de gerente para esta acción",
    });
  }

  next();
};

/**
 * requireSuperAdmin — solo superadmin pasa.
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, message: "Acceso no autorizado" });
  }

  if (req.user.rol !== "superadmin") {
    return res.status(403).json({
      ok: false,
      message: "Se requieren permisos de super administrador",
    });
  }

  next();
};

/**
 * requireSucursalAccess — verifica que el usuario pueda operar sobre la sucursal indicada.
 * - superadmin: puede todo
 * - gerente: solo su propia id_sucursal
 * - empleado: solo lectura (este middleware es para escritura)
 *
 * Lee id_sucursal de req.body.id_sucursal o req.params.idSucursal o req.query.sucursal.
 */
const requireSucursalAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, message: "Acceso no autorizado" });
  }

  if (req.user.rol === "superadmin") return next();

  const sucursalObjetivo = Number(
    req.body.id_sucursal || req.params.idSucursal || req.query.sucursal || 0
  );

  if (!sucursalObjetivo) {
    return res.status(400).json({
      ok: false,
      message: "Se requiere id_sucursal para esta operación",
    });
  }

  if (Number(req.user.id_sucursal) !== sucursalObjetivo) {
    return res.status(403).json({
      ok: false,
      message: "No puedes realizar operaciones en otra sucursal",
    });
  }

  next();
};

/**
 * requireEmpleado — permite gerente, superadmin y empleado.
 */
const requireEmpleado = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      ok: false,
      message: "Acceso no autorizado",
    });
  }

  if (!["gerente", "superadmin", "empleado", "admin"].includes(req.user.rol)) {
    return res.status(403).json({
      ok: false,
      message: "Rol no autorizado",
    });
  }

  next();
};

module.exports = {
  requireAuth,
  requireGerente,
  requireSuperAdmin,
  requireSucursalAccess,
  requireEmpleado,
};
