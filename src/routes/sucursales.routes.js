const express = require("express");
const { requireAuth, requireGerente } = require("../middlewares/auth");
const { listarSucursales, obtenerSucursal } = require("../controllers/sucursales.controller");

const router = express.Router();

/* ─── PÚBLICO ───────────────────────────────────────────── */
router.get("/", listarSucursales);
router.get("/:id", obtenerSucursal);

module.exports = router;
