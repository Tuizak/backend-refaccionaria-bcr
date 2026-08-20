const pool = require("../config/db");

/**
 * GET /api/sucursales — Listar todas las sucursales activas
 */
const listarSucursales = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id_sucursal, nombre, direccion
       FROM sucursales
       WHERE activo = 1
       ORDER BY id_sucursal ASC`
    );
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error("Error en listarSucursales:", error);
    return res.status(500).json({ ok: false, message: "Error al listar sucursales" });
  }
};

/**
 * GET /api/sucursales/:id — Obtener una sucursal por ID
 */
const obtenerSucursal = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: "ID no válido" });
    }

    const [rows] = await pool.query(
      `SELECT id_sucursal, nombre, direccion
       FROM sucursales
       WHERE id_sucursal = ? AND activo = 1
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Sucursal no encontrada" });
    }

    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    console.error("Error en obtenerSucursal:", error);
    return res.status(500).json({ ok: false, message: "Error al obtener sucursal" });
  }
};

module.exports = { listarSucursales, obtenerSucursal };
