const express = require("express");
const {
  getMarcas,
  getModelosByMarca,
  getAniosByModelo,
} = require("../controllers/vehiculos.controller");

const router = express.Router();

router.get("/marcas", getMarcas);
router.get("/modelos/:idMarca", getModelosByMarca);
router.get("/anios/:idModelo", getAniosByModelo);

module.exports = router;