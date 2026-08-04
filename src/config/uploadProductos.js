const multer = require("multer");
const path = require("path");
const fs = require("fs");

const carpetaDestino = path.join(process.cwd(), "uploads", "productos");

if (!fs.existsSync(carpetaDestino)) {
  fs.mkdirSync(carpetaDestino, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, carpetaDestino);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const nombreSeguro = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${extension}`;

    cb(null, nombreSeguro);
  },
});

const fileFilter = (req, file, cb) => {
  const extensionesPermitidas = /jpg|jpeg|png|webp/;

  const extensionValida = extensionesPermitidas.test(
    path.extname(file.originalname).toLowerCase()
  );

  const mimeValido = extensionesPermitidas.test(file.mimetype);

  if (extensionValida && mimeValido) {
    return cb(null, true);
  }

  cb(new Error("Solo se permiten imágenes JPG, JPEG, PNG o WEBP"));
};

const uploadProductos = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = uploadProductos;