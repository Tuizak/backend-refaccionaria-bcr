const pool = require("../config/db");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_change_me";

/**
 * requireAuth — valida el JWT del header Authorization.
 * Si es válido, decodifica el token y adjunta req.user.
 * También verifica en BD que el usuario siga activo.
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      ok: false,
      message: "Acceso no autorizado. Inicia sesión.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

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
