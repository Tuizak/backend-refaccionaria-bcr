const express = require("express");
const { requireAuth, requireGerente, requireSuperAdmin } = require("../middlewares/auth");
const {
  login,
  verificarSesion,
  listarUsuarios,
  crearUsuario,
  toggleUsuario,
  actualizarUsuario,
} = require("../controllers/auth.controller");

const router = express.Router();

/* ─── PÚBLICO (sin auth) ───────────────────────────────── */
router.post("/login", login);

/* ─── VERIFICAR SESIÓN (requiere auth) ──────────────────── */
router.post("/verificar", requireAuth, verificarSesion);

/* ─── GESTIÓN DE USUARIOS (gerente: solo su sucursal, superadmin: todos) ── */
router.get("/usuarios", requireAuth, requireGerente, listarUsuarios);
router.post("/usuarios", requireAuth, requireGerente, crearUsuario);
router.put("/usuarios/:id", requireAuth, requireGerente, actualizarUsuario);
router.patch("/usuarios/:id/toggle", requireAuth, requireGerente, toggleUsuario);

module.exports = router;
