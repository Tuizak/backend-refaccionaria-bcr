const pool = require("../config/db");

/**
 * requireAuth — verifica que el usuario exista y esté activo.
 * Espera el header X-User-Id enviado por el frontend.
 * Si es válido, adjunta req.user con { id_usuario, nombre, rol, id_sucursal }.
 */
const requireAuth = async (req, res, next) => {
  const userId = req.headers["x-user-id"];

  if (!userId) {
    return res.status(401).json({
      ok: false,
      message: "Acceso no autorizado. Inicia sesión.",
    });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id_usuario, nombre, rol, id_sucursal, activo
       FROM usuarios
       WHERE id_usuario = ? AND activo = 1
       LIMIT 1`,
      [userId]
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
 * requireEmpleado — permite tanto gerente como empleado.
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

module.exports = { requireAuth, requireGerente, requireEmpleado };
