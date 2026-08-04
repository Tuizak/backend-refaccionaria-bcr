const pool = require("../config/db");

const getMarcas = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id_marca, nombre, slug
      FROM marcas_vehiculo
      WHERE activo = 1
      ORDER BY nombre ASC
    `);

    return res.status(200).json({
      ok: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error en getMarcas:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al obtener las marcas",
    });
  }
};

const getModelosByMarca = async (req, res) => {
  try {
    const idMarca = Number(req.params.idMarca);

    if (!Number.isInteger(idMarca) || idMarca <= 0) {
      return res.status(400).json({
        ok: false,
        message: "El id de la marca no es válido",
      });
    }

    const [rows] = await pool.query(
      `
      SELECT id_modelo, nombre, slug
      FROM modelos_vehiculo
      WHERE id_marca = ?
        AND activo = 1
      ORDER BY nombre ASC
      `,
      [idMarca]
    );

    return res.status(200).json({
      ok: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error en getModelosByMarca:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al obtener los modelos",
    });
  }
};

const getAniosByModelo = async (req, res) => {
  try {
    const idModelo = Number(req.params.idModelo);

    if (!Number.isInteger(idModelo) || idModelo <= 0) {
      return res.status(400).json({
        ok: false,
        message: "El id del modelo no es válido",
      });
    }

    const [rows] = await pool.query(
      `
      SELECT DISTINCT anio
      FROM producto_compatibilidades
      WHERE id_modelo = ?
        AND activo = 1
      ORDER BY anio DESC
      `,
      [idModelo]
    );

    if (rows.length === 0) {
      const anioActual = new Date().getFullYear();
      const anios = [];
      for (let anio = anioActual; anio >= 1990; anio--) {
        anios.push({ anio });
      }
      return res.status(200).json({
        ok: true,
        modo: "provisional",
        message: "Años genéricos (sin datos de compatibilidad)",
        data: anios,
      });
    }

    return res.status(200).json({
      ok: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error en getAniosByModelo:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al obtener los años",
    });
  }
};

module.exports = {
  getMarcas,
  getModelosByMarca,
  getAniosByModelo,
};