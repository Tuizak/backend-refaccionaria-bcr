const express = require("express");
const router = express.Router();
const { requireAuth, requireGerente } = require("../middlewares/auth");

const uploadProductos = require("../config/uploadProductos");

const {
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
  setImagenPrincipalUrl,
  obtenerProductosPorVehiculo,
  obtenerCompatibilidadesProducto,
  crearCompatibilidad,
  actualizarCompatibilidad,
  eliminarCompatibilidad,
  obtenerStockProducto,
  agregarStock,
  reducirStock,
  buscarProductosInteligente,
} = require("../controllers/productos.controller");

/* ─── RUTAS ESPECÍFICAS PRIMERO (antes de /:id) ────────── */
router.get("/", obtenerProductos);
router.get("/buscar", buscarProductosInteligente);
router.get("/catalogos/categorias", obtenerCategoriasParaProductos);
router.get("/vehiculo/:idMarca/:idModelo/:anio", obtenerProductosPorVehiculo);

/* ─── RUTAS CON /:id DESPUÉS ───────────────────────────── */
router.get("/:id", obtenerProductoPorId);
router.get("/:id/imagenes", obtenerImagenesProducto);
router.get("/:id/stock", obtenerStockProducto);
router.get("/:id/compatibilidades", obtenerCompatibilidadesProducto);

/* ─── ESCRITURA (solo gerente) ──────────────────────────── */
router.post("/", requireAuth, requireGerente, crearProducto);
router.put("/:id", requireAuth, requireGerente, actualizarProducto);
router.delete("/:id", requireAuth, requireGerente, eliminarProducto);

router.post("/:id/imagen", requireAuth, requireGerente, uploadProductos.single("imagen"), subirImagenProducto);
router.post("/:id/imagen_url", requireAuth, requireGerente, setImagenPrincipalUrl);
router.put("/:id/imagenes/:idImagen/principal", requireAuth, requireGerente, marcarImagenPrincipal);
router.delete("/:id/imagenes/:idImagen", requireAuth, requireGerente, eliminarImagenProducto);

router.post("/:id/stock", requireAuth, requireGerente, agregarStock);
router.post("/:id/stock/reducir", requireAuth, requireGerente, reducirStock);

router.post("/:id/compatibilidades", requireAuth, requireGerente, crearCompatibilidad);
router.put("/compatibilidades/:idCompatibilidad", requireAuth, requireGerente, actualizarCompatibilidad);
router.delete("/compatibilidades/:idCompatibilidad", requireAuth, requireGerente, eliminarCompatibilidad);

module.exports = router;
