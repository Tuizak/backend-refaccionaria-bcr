const multer = require("multer");
const path = require("path");
const fs = require("fs");

/**
 * Carpeta física donde se guardarán las imágenes de promociones.
 */
const uploadDir = path.join(process.cwd(), "uploads", "promociones");
fs.mkdirSync(uploadDir, { recursive: true });

/**
 * Limpia el nombre del archivo para evitar caracteres raros.
 */
const sanitizeFileName = (fileName) => {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 60);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = sanitizeFileName(file.originalname);
    const fileName = `${Date.now()}-${baseName}${ext}`;
    cb(null, fileName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error("Solo se permiten imágenes JPG, PNG o WEBP"));
  }

  cb(null, true);
};

const uploadPromocion = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = uploadPromocion;