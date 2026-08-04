const express = require("express");
const { requireAuth, requireGerente } = require("../middlewares/auth");
const uploadPromocion = require("../config/uploadPromociones");
const {
  getPromociones,
  createPromocion,
  updatePromocion,
  deletePromocion,
  togglePromocionStatus,
} = require("../controllers/promociones.controller");

const router = express.Router();

/* ─── LECTURA (gerente y empleado) ──────────────────────── */
router.get("/", getPromociones);

/* ─── ESCRITURA (solo gerente — requireAuth primero) ────── */
router.post("/", requireAuth, requireGerente, uploadPromocion.single("imagen"), createPromocion);
router.put("/:id", requireAuth, requireGerente, uploadPromocion.single("imagen"), updatePromocion);
router.patch("/:id/toggle", requireAuth, requireGerente, togglePromocionStatus);
router.delete("/:id", requireAuth, requireGerente, deletePromocion);

module.exports = router;
