const fs = require("fs");
const path = require("path");
const db = require("../config/db");

/* Convierte texto a slug seguro */
const crearSlug = (texto = "") => {
  return texto
    .toString()
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

/* GET /api/productos */
const obtenerProductos = async (req, res) => {
  try {
    const [productos] = await db.query(`
      SELECT 
        p.id_producto,
        p.sku,
        p.slug,
        p.nombre,
        p.descripcion_corta,
        p.descripcion_larga,
        p.marca_producto,
        p.precio_base,
        p.moneda,
        p.mostrar_precio,
        p.id_categoria,
        c.nombre AS categoria,
        p.requiere_vehiculo,
        p.mensaje_whatsapp,
        p.destacado,
        p.activo,
        p.created_at,
        p.updated_at,
        (
          SELECT pi.url_imagen
          FROM producto_imagenes pi
          WHERE pi.id_producto = p.id_producto
            AND pi.activo = 1
          ORDER BY pi.es_principal DESC, pi.orden ASC, pi.id_imagen ASC
          LIMIT 1
        ) AS imagen_principal,
        COALESCE(inv.stock_total, 0) AS stock_total,
        COALESCE(compat.compat_total, 0) AS compat_total
      FROM productos p
      INNER JOIN categorias c ON c.id_categoria = p.id_categoria
      LEFT JOIN (
        SELECT id_producto, SUM(stock) AS stock_total
        FROM inventario_sucursal
        GROUP BY id_producto
      ) inv ON inv.id_producto = p.id_producto
      LEFT JOIN (
        SELECT id_producto, COUNT(*) AS compat_total
        FROM producto_compatibilidades
        WHERE activo = 1
        GROUP BY id_producto
      ) compat ON compat.id_producto = p.id_producto
      ORDER BY p.id_producto DESC
    `);

    return res.json(productos);
  } catch (error) {
    console.error("Error al obtener productos:", error);
    return res.status(500).json({
      mensaje: "Error interno al obtener productos",
    });
  }
};

/* GET /api/productos/:id */
const obtenerProductoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const [producto] = await db.query(
      `
      SELECT 
        p.*,
        c.nombre AS categoria
      FROM productos p
      INNER JOIN categorias c ON c.id_categoria = p.id_categoria
      WHERE p.id_producto = ?
      LIMIT 1
      `,
      [id]
    );

    if (producto.length === 0) {
      return res.status(404).json({
        mensaje: "Producto no encontrado",
      });
    }

    return res.json(producto[0]);
  } catch (error) {
    console.error("Error al obtener producto:", error);
    return res.status(500).json({
      mensaje: "Error interno al obtener producto",
    });
  }
};

/* POST /api/productos */
const crearProducto = async (req, res) => {
  try {
    const {
      sku,
      nombre,
      descripcion_corta,
      descripcion_larga,
      marca_producto,
      precio_base,
      mostrar_precio,
      id_categoria,
      requiere_vehiculo,
      mensaje_whatsapp,
      destacado,
      activo,
    } = req.body;

    if (!sku || !nombre || !id_categoria) {
      return res.status(400).json({
        mensaje: "SKU, nombre y categoría son obligatorios",
      });
    }

    const slugBase = crearSlug(nombre);
    const slug = `${slugBase}-${Date.now()}`;

    const [resultado] = await db.query(
      `
      INSERT INTO productos (
        sku,
        slug,
        nombre,
        descripcion_corta,
        descripcion_larga,
        marca_producto,
        precio_base,
        mostrar_precio,
        id_categoria,
        requiere_vehiculo,
        mensaje_whatsapp,
        destacado,
        activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        sku.trim(),
        slug,
        nombre.trim(),
        descripcion_corta || null,
        descripcion_larga || null,
        marca_producto || null,
        precio_base || null,
        mostrar_precio ? 1 : 0,
        Number(id_categoria),
        requiere_vehiculo ? 1 : 0,
        mensaje_whatsapp || null,
        destacado ? 1 : 0,
        activo ? 1 : 0,
      ]
    );

    return res.status(201).json({
      mensaje: "Producto creado correctamente",
      id_producto: resultado.insertId,
    });
  } catch (error) {
    console.error("Error al crear producto:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        mensaje: "Ya existe un producto con ese SKU o slug",
      });
    }

    return res.status(500).json({
      mensaje: "Error interno al crear producto",
    });
  }
};

/* PUT /api/productos/:id */
const actualizarProducto = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      sku,
      nombre,
      descripcion_corta,
      descripcion_larga,
      marca_producto,
      precio_base,
      mostrar_precio,
      id_categoria,
      requiere_vehiculo,
      mensaje_whatsapp,
      destacado,
      activo,
    } = req.body;

    if (!sku || !nombre || !id_categoria) {
      return res.status(400).json({
        mensaje: "SKU, nombre y categoría son obligatorios",
      });
    }

    const slugBase = crearSlug(nombre);
    const slug = `${slugBase}-${id}`;

    const [resultado] = await db.query(
      `
      UPDATE productos
      SET
        sku = ?,
        slug = ?,
        nombre = ?,
        descripcion_corta = ?,
        descripcion_larga = ?,
        marca_producto = ?,
        precio_base = ?,
        mostrar_precio = ?,
        id_categoria = ?,
        requiere_vehiculo = ?,
        mensaje_whatsapp = ?,
        destacado = ?,
        activo = ?
      WHERE id_producto = ?
      `,
      [
        sku.trim(),
        slug,
        nombre.trim(),
        descripcion_corta || null,
        descripcion_larga || null,
        marca_producto || null,
        precio_base || null,
        mostrar_precio ? 1 : 0,
        Number(id_categoria),
        requiere_vehiculo ? 1 : 0,
        mensaje_whatsapp || null,
        destacado ? 1 : 0,
        activo ? 1 : 0,
        id,
      ]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        mensaje: "Producto no encontrado",
      });
    }

    return res.json({
      mensaje: "Producto actualizado correctamente",
    });
  } catch (error) {
    console.error("Error al actualizar producto:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        mensaje: "Ya existe otro producto con ese SKU o slug",
      });
    }

    return res.status(500).json({
      mensaje: "Error interno al actualizar producto",
    });
  }
};

/* DELETE /api/productos/:id */
const eliminarProducto = async (req, res) => {
  try {
    const { id } = req.params;

    const [imagenes] = await db.query(
      `
      SELECT url_imagen
      FROM producto_imagenes
      WHERE id_producto = ?
      `,
      [id]
    );

    const [resultado] = await db.query(
      `
      DELETE FROM productos
      WHERE id_producto = ?
      `,
      [id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        mensaje: "Producto no encontrado",
      });
    }

    imagenes.forEach((img) => {
      const rutaLocal = path.join(process.cwd(), img.url_imagen);

      if (fs.existsSync(rutaLocal)) {
        fs.unlinkSync(rutaLocal);
      }
    });

    return res.json({
      mensaje: "Producto eliminado correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    return res.status(500).json({
      mensaje:
        "No se pudo eliminar. Puede tener inventario, promociones o compatibilidades relacionadas.",
    });
  }
};

/* GET /api/productos/catalogos/categorias */
const obtenerCategoriasParaProductos = async (req, res) => {
  try {
    const [categorias] = await db.query(`
      SELECT id_categoria, nombre
      FROM categorias
      WHERE activo = 1
      ORDER BY nombre ASC
    `);

    return res.json(categorias);
  } catch (error) {
    console.error("Error al obtener categorías:", error);
    return res.status(500).json({
      mensaje: "Error interno al obtener categorías",
    });
  }
};

/* POST /api/productos/:id/imagen */
const subirImagenProducto = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        mensaje: "No se recibió ninguna imagen",
      });
    }

    const [producto] = await db.query(
      `
      SELECT id_producto
      FROM productos
      WHERE id_producto = ?
      LIMIT 1
      `,
      [id]
    );

    if (producto.length === 0) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(404).json({
        mensaje: "Producto no encontrado",
      });
    }

    const [conteo] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM producto_imagenes
      WHERE id_producto = ?
      `,
      [id]
    );

    const totalImagenes = conteo[0].total;
    const esPrincipal = totalImagenes === 0 ? 1 : 0;
    const orden = totalImagenes + 1;
    const urlImagen = `/uploads/productos/${req.file.filename}`;

    const [resultado] = await db.query(
      `
      INSERT INTO producto_imagenes (
        id_producto,
        url_imagen,
        texto_alt,
        orden,
        es_principal,
        activo
      ) VALUES (?, ?, ?, ?, ?, 1)
      `,
      [
        id,
        urlImagen,
        req.body.texto_alt || null,
        orden,
        esPrincipal,
      ]
    );

    return res.status(201).json({
      mensaje: "Imagen subida correctamente",
      id_imagen: resultado.insertId,
      url_imagen: urlImagen,
      es_principal: esPrincipal,
    });
  } catch (error) {
    console.error("Error al subir imagen:", error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      mensaje: "Error interno al subir imagen",
    });
  }
};

/* GET /api/productos/:id/imagenes */
const obtenerImagenesProducto = async (req, res) => {
  try {
    const { id } = req.params;

    const [imagenes] = await db.query(
      `
      SELECT 
        id_imagen,
        id_producto,
        url_imagen,
        texto_alt,
        orden,
        es_principal,
        activo,
        created_at
      FROM producto_imagenes
      WHERE id_producto = ?
      ORDER BY es_principal DESC, orden ASC, id_imagen ASC
      `,
      [id]
    );

    return res.json(imagenes);
  } catch (error) {
    console.error("Error al obtener imágenes:", error);
    return res.status(500).json({
      mensaje: "Error interno al obtener imágenes",
    });
  }
};

/* DELETE /api/productos/:id/imagenes/:idImagen */
const eliminarImagenProducto = async (req, res) => {
  try {
    const { id, idImagen } = req.params;

    const [imagen] = await db.query(
      `
      SELECT url_imagen, es_principal
      FROM producto_imagenes
      WHERE id_producto = ?
        AND id_imagen = ?
      LIMIT 1
      `,
      [id, idImagen]
    );

    if (imagen.length === 0) {
      return res.status(404).json({
        mensaje: "Imagen no encontrada",
      });
    }

    await db.query(
      `
      DELETE FROM producto_imagenes
      WHERE id_producto = ?
        AND id_imagen = ?
      `,
      [id, idImagen]
    );

    const rutaLocal = path.join(process.cwd(), imagen[0].url_imagen);

    if (fs.existsSync(rutaLocal)) {
      fs.unlinkSync(rutaLocal);
    }

    if (imagen[0].es_principal) {
      const [siguienteImagen] = await db.query(
        `
        SELECT id_imagen
        FROM producto_imagenes
        WHERE id_producto = ?
        ORDER BY orden ASC, id_imagen ASC
        LIMIT 1
        `,
        [id]
      );

      if (siguienteImagen.length > 0) {
        await db.query(
          `
          UPDATE producto_imagenes
          SET es_principal = 1
          WHERE id_imagen = ?
          `,
          [siguienteImagen[0].id_imagen]
        );
      }
    }

    return res.json({
      mensaje: "Imagen eliminada correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar imagen:", error);
    return res.status(500).json({
      mensaje: "Error interno al eliminar imagen",
    });
  }
};

/* PUT /api/productos/:id/imagenes/:idImagen/principal */
const marcarImagenPrincipal = async (req, res) => {
  try {
    const { id, idImagen } = req.params;

    const [imagen] = await db.query(
      `
      SELECT id_imagen
      FROM producto_imagenes
      WHERE id_producto = ?
        AND id_imagen = ?
      LIMIT 1
      `,
      [id, idImagen]
    );

    if (imagen.length === 0) {
      return res.status(404).json({
        mensaje: "Imagen no encontrada",
      });
    }

    await db.query(
      `
      UPDATE producto_imagenes
      SET es_principal = 0
      WHERE id_producto = ?
      `,
      [id]
    );

    await db.query(
      `
      UPDATE producto_imagenes
      SET es_principal = 1
      WHERE id_producto = ?
        AND id_imagen = ?
      `,
      [id, idImagen]
    );

    return res.json({
      mensaje: "Imagen principal actualizada correctamente",
    });
  } catch (error) {
    console.error("Error al marcar imagen principal:", error);
    return res.status(500).json({
      mensaje: "Error interno al marcar imagen principal",
    });
  }
};

/* GET /api/productos/:id/stock */
const obtenerStockProducto = async (req, res) => {
  try {
    const { id } = req.params;

    const [stock] = await db.query(`
      SELECT
        isl.id_inventario,
        isl.id_sucursal,
        s.nombre AS sucursal,
        s.direccion,
        isl.stock,
        isl.stock_minimo
      FROM inventario_sucursal isl
      INNER JOIN sucursales s ON s.id_sucursal = isl.id_sucursal
      WHERE isl.id_producto = ?
      ORDER BY s.nombre ASC
    `, [id]);

    return res.json(stock);
  } catch (error) {
    console.error("Error al obtener stock del producto:", error);
    return res.status(500).json({
      mensaje: "Error interno al obtener stock",
    });
  }
};

/* ===========================================================
   COMPATIBILIDAD CON VEHÍCULOS
   =========================================================== */

/* GET /api/productos/vehiculo/:idMarca/:idModelo/:anio */
const obtenerProductosPorVehiculo = async (req, res) => {
  try {
    const idMarca = Number(req.params.idMarca);
    const idModelo = Number(req.params.idModelo);
    const anio = Number(req.params.anio);

    if (!idMarca || !idModelo || !anio) {
      return res.status(400).json({
        mensaje: "marca, modelo y año son obligatorios",
      });
    }

    const [productos] = await db.query(
      `
      SELECT DISTINCT
        p.id_producto,
        p.sku,
        p.slug,
        p.nombre,
        p.descripcion_corta,
        p.descripcion_larga,
        p.marca_producto,
        p.precio_base,
        p.moneda,
        p.mostrar_precio,
        p.id_categoria,
        c.nombre AS categoria,
        p.requiere_vehiculo,
        p.mensaje_whatsapp,
        p.destacado,
        p.activo,
        p.created_at,
        p.updated_at,
        (
          SELECT pi.url_imagen
          FROM producto_imagenes pi
          WHERE pi.id_producto = p.id_producto
            AND pi.activo = 1
          ORDER BY pi.es_principal DESC, pi.orden ASC, pi.id_imagen ASC
          LIMIT 1
        ) AS imagen_principal,
        COALESCE(inv.stock_total, 0) AS stock_total
      FROM productos p
      INNER JOIN categorias c ON c.id_categoria = p.id_categoria
      INNER JOIN producto_compatibilidades pc ON pc.id_producto = p.id_producto
      LEFT JOIN (
        SELECT id_producto, SUM(stock) AS stock_total
        FROM inventario_sucursal
        GROUP BY id_producto
      ) inv ON inv.id_producto = p.id_producto
      WHERE pc.id_marca = ?
        AND pc.id_modelo = ?
        AND (? BETWEEN pc.anio AND COALESCE(pc.anio_fin, pc.anio))
        AND pc.activo = 1
        AND p.activo = 1
      ORDER BY p.nombre ASC
      `,
      [idMarca, idModelo, anio]
    );

    return res.json(productos);
  } catch (error) {
    console.error("Error al obtener productos por vehículo:", error);
    return res.status(500).json({
      mensaje: "Error interno al obtener productos por vehículo",
    });
  }
};

/* GET /api/productos/:id/compatibilidades */
const obtenerCompatibilidadesProducto = async (req, res) => {
  try {
    const { id } = req.params;

    const [compatibilidades] = await db.query(
      `
      SELECT
        pc.id_compatibilidad,
        pc.id_producto,
        pc.id_marca,
        mv.nombre AS marca,
        pc.id_modelo,
        md.nombre AS modelo,
        pc.anio,
        pc.anio_fin,
        pc.motor,
        pc.version,
        pc.notas,
        pc.activo,
        pc.created_at
      FROM producto_compatibilidades pc
      INNER JOIN marcas_vehiculo mv ON mv.id_marca = pc.id_marca
      INNER JOIN modelos_vehiculo md ON md.id_modelo = pc.id_modelo
      WHERE pc.id_producto = ?
      ORDER BY mv.nombre ASC, md.nombre ASC, pc.anio DESC
      `,
      [id]
    );

    return res.json(compatibilidades);
  } catch (error) {
    console.error("Error al obtener compatibilidades:", error);
    return res.status(500).json({
      mensaje: "Error interno al obtener compatibilidades",
    });
  }
};

/* POST /api/productos/:id/compatibilidades */
const crearCompatibilidad = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_marca, id_modelo, anio, anio_fin, motor, version, notas } = req.body;

    if (!id_marca || !id_modelo || !anio) {
      return res.status(400).json({
        mensaje: "marca, modelo y año son obligatorios",
      });
    }

    const [resultado] = await db.query(
      `
      INSERT INTO producto_compatibilidades
        (id_producto, id_marca, id_modelo, anio, anio_fin, motor, version, notas, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
      [id, id_marca, id_modelo, anio, anio_fin || null, motor || null, version || null, notas || null]
    );

    return res.status(201).json({
      mensaje: "Compatibilidad agregada correctamente",
      id_compatibilidad: resultado.insertId,
    });
  } catch (error) {
    console.error("Error al crear compatibilidad:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        mensaje: "Ya existe esta compatibilidad para el producto",
      });
    }

    return res.status(500).json({
      mensaje: "Error interno al crear compatibilidad",
    });
  }
};

/* DELETE /api/productos/:id/compatibilidades/:idCompatibilidad */
const eliminarCompatibilidad = async (req, res) => {
  try {
    const { idCompatibilidad } = req.params;

    const [resultado] = await db.query(
      `
      DELETE FROM producto_compatibilidades
      WHERE id_compatibilidad = ?
      `,
      [idCompatibilidad]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        mensaje: "Compatibilidad no encontrada",
      });
    }

    return res.json({
      mensaje: "Compatibilidad eliminada correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar compatibilidad:", error);
    return res.status(500).json({
      mensaje: "Error interno al eliminar compatibilidad",
    });
  }
};

/* PUT /api/productos/compatibilidades/:idCompatibilidad */
const actualizarCompatibilidad = async (req, res) => {
  try {
    const { idCompatibilidad } = req.params;
    const { id_marca, id_modelo, anio, anio_fin, motor, version, notas } = req.body;

    if (!id_marca || !id_modelo || !anio) {
      return res.status(400).json({ mensaje: "marca, modelo y año son obligatorios" });
    }

    const [resultado] = await db.query(
      `
      UPDATE producto_compatibilidades
      SET id_marca = ?, id_modelo = ?, anio = ?, anio_fin = ?, motor = ?, version = ?, notas = ?
      WHERE id_compatibilidad = ?
      `,
      [id_marca, id_modelo, anio, anio_fin || null, motor || null, version || null, notas || null, idCompatibilidad]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: "Compatibilidad no encontrada" });
    }

    return res.json({ mensaje: "Compatibilidad actualizada correctamente" });
  } catch (error) {
    console.error("Error al actualizar compatibilidad:", error);
    return res.status(500).json({ mensaje: "Error interno al actualizar compatibilidad" });
  }
};

/* POST /api/productos/:id/stock — Agregar stock a una sucursal */
const agregarStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_sucursal, cantidad, notas } = req.body;

    if (!id_sucursal || !cantidad || Number(cantidad) <= 0) {
      return res.status(400).json({
        ok: false,
        mensaje: "Sucursal y cantidad (mayor a 0) son obligatorios",
      });
    }

    /* Verificar que el producto exista */
    const [prod] = await db.query(
      "SELECT id_producto, nombre FROM productos WHERE id_producto = ? LIMIT 1",
      [id]
    );
    if (prod.length === 0) {
      return res.status(404).json({ ok: false, mensaje: "Producto no encontrado" });
    }

    /* Verificar que la sucursal exista */
    const [suc] = await db.query(
      "SELECT id_sucursal, nombre FROM sucursales WHERE id_sucursal = ? LIMIT 1",
      [id_sucursal]
    );
    if (suc.length === 0) {
      return res.status(404).json({ ok: false, mensaje: "Sucursal no encontrada" });
    }

    /* Verificar si ya existe inventario para ese producto en esa sucursal */
    const [existe] = await db.query(
      "SELECT id_inventario, stock FROM inventario_sucursal WHERE id_producto = ? AND id_sucursal = ? LIMIT 1",
      [id, id_sucursal]
    );

    const cantidadNum = Number(cantidad);

    if (existe.length > 0) {
      /* Actualizar stock existente */
      await db.query(
        "UPDATE inventario_sucursal SET stock = stock + ? WHERE id_inventario = ?",
        [cantidadNum, existe[0].id_inventario]
      );
    } else {
      /* Crear registro nuevo */
      await db.query(
        "INSERT INTO inventario_sucursal (id_producto, id_sucursal, stock, stock_minimo) VALUES (?, ?, ?, 0)",
        [id, id_sucursal, cantidadNum]
      );
    }

    /* Consultar stock actualizado */
    const [stockActual] = await db.query(
      "SELECT stock FROM inventario_sucursal WHERE id_producto = ? AND id_sucursal = ?",
      [id, id_sucursal]
    );

    return res.status(200).json({
      ok: true,
      mensaje: `Stock actualizado: +${cantidadNum} unidades en ${suc[0].nombre}`,
      stock_actual: stockActual[0]?.stock || 0,
    });
  } catch (error) {
    console.error("Error al agregar stock:", error);
    return res.status(500).json({
      ok: false,
      mensaje: "Error interno al agregar stock",
    });
  }
};

/* GET /api/productos/buscar?q=texto&idMarca=X&idModelo=Y&anio=Z
   Búsqueda inteligente: combina texto + compatibilidad vehicular */
const buscarProductosInteligente = async (req, res) => {
  try {
    const { q, idMarca, idModelo, anio, motor } = req.query;

    let sql = `
      SELECT DISTINCT
        p.id_producto, p.sku, p.slug, p.nombre, p.descripcion_corta,
        p.marca_producto, p.precio_base, p.mostrar_precio,
        p.id_categoria, c.nombre AS categoria, p.requiere_vehiculo,
        p.activo,
        COALESCE(inv.stock_total, 0) AS stock_total,
        (
          SELECT pi.url_imagen
          FROM producto_imagenes pi
          WHERE pi.id_producto = p.id_producto AND pi.activo = 1
          ORDER BY pi.es_principal DESC, pi.orden ASC, pi.id_imagen ASC
          LIMIT 1
        ) AS imagen_principal
      FROM productos p
      INNER JOIN categorias c ON c.id_categoria = p.id_categoria
      LEFT JOIN (
        SELECT id_producto, SUM(stock) AS stock_total
        FROM inventario_sucursal GROUP BY id_producto
      ) inv ON inv.id_producto = p.id_producto
    `;

    const conditions = [];
    const params = [];

    /* Filtro de compatibilidad vehicular */
    if (idMarca && idModelo && anio) {
      sql += `
        INNER JOIN producto_compatibilidades pc ON pc.id_producto = p.id_producto
      `;
      conditions.push(
        "pc.id_marca = ?",
        "pc.id_modelo = ?",
        "(? BETWEEN pc.anio AND COALESCE(pc.anio_fin, pc.anio))",
        "pc.activo = 1"
      );
      params.push(Number(idMarca), Number(idModelo), Number(anio));

      /* Filtro por motor (opcional) */
      if (motor && motor.trim()) {
        conditions.push("pc.motor LIKE ?");
        params.push(`%${motor.trim()}%`);
      }
    }

    /* Filtro de texto */
    if (q && q.trim()) {
      const texto = q.trim();
      conditions.push(
        "(p.nombre LIKE ? OR p.sku LIKE ? OR p.marca_producto LIKE ? OR p.descripcion_corta LIKE ?)"
      );
      const like = `%${texto}%`;
      params.push(like, like, like, like);
    }

    conditions.push("p.activo = 1");

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY p.nombre ASC LIMIT 50";

    const [rows] = await db.query(sql, params);

    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error("Error en buscarProductosInteligente:", error);
    return res.status(500).json({
      ok: false,
      mensaje: "Error interno en la búsqueda",
    });
  }
};

module.exports = {
  obtenerProductos,
  obtenerProductoPorId,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  obtenerCategoriasParaProductos,
  subirImagenProducto,
  obtenerImagenesProducto,
  eliminarImagenProducto,
  marcarImagenPrincipal,
  obtenerProductosPorVehiculo,
  obtenerCompatibilidadesProducto,
  crearCompatibilidad,
  actualizarCompatibilidad,
  eliminarCompatibilidad,
  obtenerStockProducto,
  agregarStock,
  buscarProductosInteligente,
};