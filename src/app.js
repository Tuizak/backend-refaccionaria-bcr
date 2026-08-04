const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { requireAuth, requireEmpleado } = require("./middlewares/auth");
const vehiculosRoutes = require("./routes/vehiculos.routes");
const promocionesRoutes = require("./routes/promociones.routes");
const productosRoutes = require("./routes/productos.routes");
const authRoutes = require("./routes/auth.routes");

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Permitir requests sin origin (curl, Postman, apps móviles)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
      return callback(null, true); // Temporalmente permitir todo para desarrollo
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Hace pública la carpeta uploads.
 */
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/* ─── HEALTH (sin auth) ────────────────────────────────── */
app.get("/api/health", (req, res) => {
  return res.status(200).json({
    ok: true,
    message: "Backend funcionando correctamente",
  });
});

/* ─── AUTH (login sin auth middleware) ──────────────────── */
app.use("/api/auth", authRoutes);

/* ─── RUTAS PÚBLICAS (lectura — la web las necesita) ────── */
app.use("/api/vehiculos", vehiculosRoutes);
app.use("/api/promociones", promocionesRoutes);
app.use("/api/productos", productosRoutes);

/* ─── NOTA: La protección de escritura (POST/PUT/DELETE)
   se aplica DENTRO de cada archivo de rutas con requireGerente.
   Las rutas GET son públicas para que la web funcione sin login.
*/

app.use((req, res) => {
  return res.status(404).json({
    ok: false,
    message: "Ruta no encontrada",
  });
});

module.exports = app;