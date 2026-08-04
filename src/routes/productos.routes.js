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
  obtenerProductosPorVehiculo,
  obtenerCompatibilidadesProducto,
  crearCompatibilidad,
  actualizarCompatibilidad,
  eliminarCompatibilidad,
  obtenerStockProducto,
  agregarStock,
  buscarProductosInteligente,
} = require("../controllers/productos.controller");

/* ─── LECTURA (gerente y empleado) ──────────────────────── */
router.get("/", obtenerProductos);
router.get("/buscar", buscarProductosInteligente);
router.get("/catalogos/categorias", obtenerCategoriasParaProductos);
router.get("/vehiculo/:idMarca/:idModelo/:anio", obtenerProductosPorVehiculo);
router.get("/:id", obtenerProductoPorId);
router.get("/:id/imagenes", obtenerImagenesProducto);
router.get("/:id/stock", obtenerStockProducto);
router.get("/:id/compatibilidades", obtenerCompatibilidadesProducto);

/* ─── ESCRITURA (solo gerente — requireAuth primero) ────── */
router.post("/", requireAuth, requireGerente, crearProducto);
router.put("/:id", requireAuth, requireGerente, actualizarProducto);
router.delete("/:id", requireAuth, requireGerente, eliminarProducto);

router.post("/:id/imagen", requireAuth, requireGerente, uploadProductos.single("imagen"), subirImagenProducto);
router.put("/:id/imagenes/:idImagen/principal", requireAuth, requireGerente, marcarImagenPrincipal);
router.delete("/:id/imagenes/:idImagen", requireAuth, requireGerente, eliminarImagenProducto);

router.post("/:id/stock", requireAuth, requireGerente, agregarStock);

router.post("/:id/compatibilidades", requireAuth, requireGerente, crearCompatibilidad);
router.put("/compatibilidades/:idCompatibilidad", requireAuth, requireGerente, actualizarCompatibilidad);
router.delete("/compatibilidades/:idCompatibilidad", requireAuth, requireGerente, eliminarCompatibilidad);

module.exports = router;