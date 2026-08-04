const app = require("./app");
const pool = require("./config/db");
require("dotenv").config();

const PORT = Number(process.env.PORT) || 4000;

const startServer = async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Conexión a MySQL correcta");
    connection.release();

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Error al conectar con MySQL:", error.message);
    process.exit(1);
  }
};

startServer();