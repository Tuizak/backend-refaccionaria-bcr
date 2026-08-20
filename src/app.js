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
  max: 5, // máximo 5 intentos por ventana (antes era 10)
  message: {
    ok: false,
    message: "Demasiados intentos de inicio de sesión. Tu IP ha sido bloqueada temporalmente.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
      || req.headers["x-real-ip"]
      || req.socket?.remoteAddress
      || "unknown";
  },
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60, // máximo 60 requests por minuto (antes era 100)
  message: {
    ok: false,
    message: "Demasiadas solicitudes. Intenta de nuevo en un minuto.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit estricto para endpoints de escritura
const writeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20, // máximo 20 escrituras por minuto
  message: {
    ok: false,
    message: "Demasiadas solicitudes de escritura. Espera un momento.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/* ─── BODY PARSERS ───────────────────────────────────────── */
app.use(express.json({ limit: "100kb" })); // Limitar tamaño de body
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

/* ─── SECURITY: Deshabilitar fingerprint del servidor ────── */
app.disable("x-powered-by");

/* ─── SECURITY: Prevenir cache de respuestas sensibles ───── */
app.use("/api/auth", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

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
