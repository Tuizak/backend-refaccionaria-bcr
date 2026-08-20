const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("dotenv").config();

const { requireAuth, requireEmpleado } = require("./middlewares/auth");
const vehiculosRoutes = require("./routes/vehiculos.routes");
const promocionesRoutes = require("./routes/promociones.routes");
const productosRoutes = require("./routes/productos.routes");
const authRoutes = require("./routes/auth.routes");
const sucursalesRoutes = require("./routes/sucursales.routes");

const app = express();

/* ─── HELMET (headers de seguridad) ──────────────────────── */
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

/* ─── CORS restrictivo ──────────────────────────────────── */
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://lightpink-squirrel-140641.hostingersite.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);

/* ─── RATE LIMITING ──────────────────────────────────────── */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 intentos por ventana
  message: {
    ok: false,
    message: "Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // máximo 100 requests por minuto
  message: {
    ok: false,
    message: "Demasiadas solicitudes. Intenta de nuevo en un minuto.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/* ─── BODY PARSERS ───────────────────────────────────────── */
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

/* ─── AUTH (login con rate limiting) ─────────────────────── */
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth", authRoutes);

/* ─── RUTAS PÚBLICAS (lectura + rate limiting) ───────────── */
app.use("/api/vehiculos", apiLimiter, vehiculosRoutes);
app.use("/api/promociones", apiLimiter, promocionesRoutes);
app.use("/api/productos", apiLimiter, productosRoutes);
app.use("/api/sucursales", apiLimiter, sucursalesRoutes);

/* ─── 404 ───────────────────────────────────────────────── */
app.use((req, res) => {
  return res.status(404).json({
    ok: false,
    message: "Ruta no encontrada",
  });
});

module.exports = app;
