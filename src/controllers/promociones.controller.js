const fs = require("fs/promises");
const path = require("path");
const pool = require("../config/db");

/**
 * Convierte una ruta guardada en la BD a URL pública.
 */
const buildImageUrl = (req, imagePath) => {
  if (!imagePath) return "";
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  return `${req.protocol}://${req.get("host")}${imagePath}`;
};

/**
 * Formatea una promoción para que coincida con tu frontend actual.
 */
const mapPromocionToFrontend = (req, promo) => {
  return {
    id: promo.id_promocion,
    titulo: promo.titulo,
    descripcion: promo.descripcion || "",
    imagen: buildImageUrl(req, promo.imagen_url),
    precioPromo:
      promo.precio_promocion !== null ? String(promo.precio_promocion) : "",
    precioAnterior:
      promo.precio_anterior !== null ? String(promo.precio_anterior) : "",
    whatsappMensaje: promo.mensaje_whatsapp || "",
    linkProducto: promo.link_interno || "",
    activa: Boolean(promo.activo),
    idProducto: promo.id_producto || null,
    fechaInicio: promo.fecha_inicio || null,
    fechaFin: promo.fecha_fin || null,
    prioridad: promo.prioridad ?? 0,
    createdAt: promo.created_at,
    updatedAt: promo.updated_at,
  };
};

/**
 * Borra un archivo físico si existe.
 */
const removeFileIfExists = async (relativePath) => {
  if (!relativePath) return;

  try {
    const cleanPath = relativePath.replace(/^\/+/, "");
    const absolutePath = path.join(process.cwd(), cleanPath);
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Error eliminando archivo:", error.message);
    }
  }
};

const getPromociones = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        id_promocion,
        id_producto,
        titulo,
        descripcion,
        imagen_url,
        precio_anterior,
        precio_promocion,
        mensaje_whatsapp,
        link_interno,
        fecha_inicio,
        fecha_fin,
        prioridad,
        activo,
        created_at,
        updated_at
      FROM promociones
      ORDER BY prioridad DESC, created_at DESC
    `);

    return res.status(200).json({
      ok: true,
      data: rows.map((promo) => mapPromocionToFrontend(req, promo)),
    });
  } catch (error) {
    console.error("Error en getPromociones:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al obtener promociones",
    });
  }
};

const createPromocion = async (req, res) => {
  try {
    const {
      idProducto,
      titulo,
      descripcion,
      precioPromo,
      precioAnterior,
      whatsappMensaje,
      linkProducto,
      imagenUrl,
      fechaInicio,
      fechaFin,
      prioridad,
      activa,
    } = req.body;

    if (!titulo || !titulo.trim()) {
      return res.status(400).json({
        ok: false,
        message: "El título es obligatorio",
      });
    }

    if (precioPromo === undefined || precioPromo === null || precioPromo === "") {
      return res.status(400).json({
        ok: false,
        message: "El precio promoción es obligatorio",
      });
    }

    /* La imagen puede venir como archivo, URL externa o no venir (opcional) */
    let imagePath = "";

    if (req.file) {
      imagePath = `/uploads/promociones/${req.file.filename}`;
    } else if (imagenUrl && imagenUrl.trim()) {
      imagePath = imagenUrl.trim();
    }

    const [result] = await pool.query(
      `
      INSERT INTO promociones (
        id_producto,
        titulo,
        descripcion,
        imagen_url,
        precio_anterior,
        precio_promocion,
        mensaje_whatsapp,
        link_interno,
        fecha_inicio,
        fecha_fin,
        prioridad,
        activo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        idProducto ? Number(idProducto) : null,
        titulo.trim(),
        descripcion?.trim() || null,
        imagePath,
        precioAnterior !== "" && precioAnterior !== undefined
          ? Number(precioAnterior)
          : null,
        Number(precioPromo),
        whatsappMensaje?.trim() || null,
        linkProducto?.trim() || null,
        fechaInicio || null,
        fechaFin || null,
        prioridad !== undefined && prioridad !== "" ? Number(prioridad) : 0,
        activa === "false" || activa === "0" ? 0 : 1,
      ]
    );

    const [rows] = await pool.query(
      `
      SELECT
        id_promocion,
        id_producto,
        titulo,
        descripcion,
        imagen_url,
        precio_anterior,
        precio_promocion,
        mensaje_whatsapp,
        link_interno,
        fecha_inicio,
        fecha_fin,
        prioridad,
        activo,
        created_at,
        updated_at
      FROM promociones
      WHERE id_promocion = ?
      `,
      [result.insertId]
    );

    return res.status(201).json({
      ok: true,
      message: "Promoción creada correctamente",
      data: mapPromocionToFrontend(req, rows[0]),
    });
  } catch (error) {
    console.error("Error en createPromocion:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al crear la promoción",
    });
  }
};

const updatePromocion = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        message: "El id no es válido",
      });
    }

    const [existingRows] = await pool.query(
      `
      SELECT *
      FROM promociones
      WHERE id_promocion = ?
      LIMIT 1
      `,
      [id]
    );

    if (!existingRows.length) {
      return res.status(404).json({
        ok: false,
        message: "Promoción no encontrada",
      });
    }

    const existing = existingRows[0];

    const {
      idProducto,
      titulo,
      descripcion,
      precioPromo,
      precioAnterior,
      whatsappMensaje,
      linkProducto,
      imagenUrl,
      fechaInicio,
      fechaFin,
      prioridad,
      activa,
    } = req.body;

    const esImagenLocal = /^https?:\/\//i.test(existing.imagen_url || "") === false && !!existing.imagen_url;
    let imagePath = existing.imagen_url || "";

    if (req.file) {
      if (esImagenLocal) await removeFileIfExists(existing.imagen_url);
      imagePath = `/uploads/promociones/${req.file.filename}`;
    } else if (imagenUrl !== undefined) {
      const nuevo = String(imagenUrl).trim();
      if (nuevo) {
        if (esImagenLocal && nuevo !== existing.imagen_url) {
          await removeFileIfExists(existing.imagen_url);
        }
        imagePath = nuevo;
      } else {
        if (esImagenLocal) await removeFileIfExists(existing.imagen_url);
        imagePath = "";
      }
    }

    await pool.query(
      `
      UPDATE promociones
      SET
        id_producto = ?,
        titulo = ?,
        descripcion = ?,
        imagen_url = ?,
        precio_anterior = ?,
        precio_promocion = ?,
        mensaje_whatsapp = ?,
        link_interno = ?,
        fecha_inicio = ?,
        fecha_fin = ?,
        prioridad = ?,
        activo = ?
      WHERE id_promocion = ?
      `,
      [
        idProducto ? Number(idProducto) : null,
        titulo?.trim() || existing.titulo,
        descripcion !== undefined ? descriptionOrNull(descripcion) : existing.descripcion,
        imagePath,
        precioAnterior !== undefined && precioAnterior !== ""
          ? Number(precioAnterior)
          : null,
        precioPromo !== undefined && precioPromo !== ""
          ? Number(precioPromo)
          : existing.precio_promocion,
        whatsappMensaje !== undefined ? textOrNull(whatsappMensaje) : existing.mensaje_whatsapp,
        linkProducto !== undefined ? textOrNull(linkProducto) : existing.link_interno,
        fechaInicio !== undefined && fechaInicio !== "" ? fechaInicio : null,
        fechaFin !== undefined && fechaFin !== "" ? fechaFin : null,
        prioridad !== undefined && prioridad !== "" ? Number(prioridad) : existing.prioridad,
        activa === "false" || activa === "0" ? 0 : 1,
        id,
      ]
    );

    const [rows] = await pool.query(
      `
      SELECT
        id_promocion,
        id_producto,
        titulo,
        descripcion,
        imagen_url,
        precio_anterior,
        precio_promocion,
        mensaje_whatsapp,
        link_interno,
        fecha_inicio,
        fecha_fin,
        prioridad,
        activo,
        created_at,
        updated_at
      FROM promociones
      WHERE id_promocion = ?
      `,
      [id]
    );

    return res.status(200).json({
      ok: true,
      message: "Promoción actualizada correctamente",
      data: mapPromocionToFrontend(req, rows[0]),
    });
  } catch (error) {
    console.error("Error en updatePromocion:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al actualizar la promoción",
    });
  }
};

const deletePromocion = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        message: "El id no es válido",
      });
    }

    const [rows] = await pool.query(
      `
      SELECT id_promocion, imagen_url
      FROM promociones
      WHERE id_promocion = ?
      LIMIT 1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        ok: false,
        message: "Promoción no encontrada",
      });
    }

    await pool.query(
      `
      DELETE FROM promociones
      WHERE id_promocion = ?
      `,
      [id]
    );

    await removeFileIfExists(rows[0].imagen_url);

    return res.status(200).json({
      ok: true,
      message: "Promoción eliminada correctamente",
    });
  } catch (error) {
    console.error("Error en deletePromocion:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al eliminar la promoción",
    });
  }
};

const togglePromocionStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        message: "El id no es válido",
      });
    }

    const [rows] = await pool.query(
      `
      SELECT activo
      FROM promociones
      WHERE id_promocion = ?
      LIMIT 1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        ok: false,
        message: "Promoción no encontrada",
      });
    }

    const nuevoEstado = rows[0].activo ? 0 : 1;

    await pool.query(
      `
      UPDATE promociones
      SET activo = ?
      WHERE id_promocion = ?
      `,
      [nuevoEstado, id]
    );

    return res.status(200).json({
      ok: true,
      message: "Estado de promoción actualizado correctamente",
    });
  } catch (error) {
    console.error("Error en togglePromocionStatus:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al cambiar el estado de la promoción",
    });
  }
};

/**
 * Helpers para limpiar texto opcional.
 */
function textOrNull(value) {
  if (value === undefined || value === null) return null;
  const clean = String(value).trim();
  return clean ? clean : null;
}

function descriptionOrNull(value) {
  return textOrNull(value);
}

module.exports = {
  getPromociones,
  createPromocion,
  updatePromocion,
  deletePromocion,
  togglePromocionStatus,
};