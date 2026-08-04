const pool = require("../config/db");

const login = async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin || !/^\d{4,6}$/.test(String(pin))) {
      return res.status(400).json({
        ok: false,
        message: "PIN inválido. Debe ser numérico de 4 a 6 dígitos.",
      });
    }

    const [rows] = await pool.query(
      `
      SELECT id_usuario, nombre, email, rol, id_sucursal, activo
      FROM usuarios
      WHERE pin = ? AND activo = 1
      LIMIT 1
      `,
      [String(pin)]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        ok: false,
        message: "PIN incorrecto o usuario inactivo",
      });
    }

    const usuario = rows[0];

    await pool.query(
      `UPDATE usuarios SET ultimo_acceso = NOW() WHERE id_usuario = ?`,
      [usuario.id_usuario]
    );

    return res.status(200).json({
      ok: true,
      data: {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        id_sucursal: usuario.id_sucursal,
      },
    });
  } catch (error) {
    console.error("Error en login:", error);
    return res.status(500).json({
      ok: false,
      message: "Error interno del servidor",
    });
  }
};

const verificarSesion = async (req, res) => {
  try {
    const { id_usuario } = req.body;

    if (!id_usuario) {
      return res.status(400).json({
        ok: false,
        message: "ID de usuario requerido",
      });
    }

    const [rows] = await pool.query(
      `
      SELECT id_usuario, nombre, email, rol, id_sucursal
      FROM usuarios
      WHERE id_usuario = ? AND activo = 1
      LIMIT 1
      `,
      [id_usuario]
    );

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, message: "Sesión inválida" });
    }

    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    console.error("Error en verificarSesion:", error);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
};

/* GET /api/auth/usuarios — Listar todos los usuarios (gerente only) */
const listarUsuarios = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id_usuario, nombre, email, rol, id_sucursal, activo, ultimo_acceso
       FROM usuarios
       ORDER BY id_usuario ASC`
    );
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error("Error en listarUsuarios:", error);
    return res.status(500).json({ ok: false, message: "Error al listar usuarios" });
  }
};

/* POST /api/auth/usuarios — Crear usuario (gerente only) */
const crearUsuario = async (req, res) => {
  try {
    const { nombre, email, pin, rol, id_sucursal } = req.body;

    if (!nombre || !pin) {
      return res.status(400).json({ ok: false, message: "Nombre y PIN son obligatorios" });
    }

    if (!/^\d{4,6}$/.test(String(pin))) {
      return res.status(400).json({ ok: false, message: "El PIN debe ser numérico de 4 a 6 dígitos" });
    }

    const rolValido = ["gerente", "empleado", "admin", "superadmin"];
    if (rol && !rolValido.includes(rol)) {
      return res.status(400).json({ ok: false, message: "Rol no válido" });
    }

    const [resultado] = await pool.query(
      `INSERT INTO usuarios (nombre, email, pin, rol, id_sucursal, activo)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [
        nombre.trim(),
        email?.trim() || null,
        String(pin),
        rol || "empleado",
        id_sucursal || null,
      ]
    );

    return res.status(201).json({
      ok: true,
      message: "Usuario creado correctamente",
      data: { id_usuario: resultado.insertId },
    });
  } catch (error) {
    console.error("Error en crearUsuario:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, message: "Ya existe un usuario con ese email o PIN" });
    }
    return res.status(500).json({ ok: false, message: "Error al crear usuario" });
  }
};

/* PATCH /api/auth/usuarios/:id/toggle — Activar/desactivar usuario (gerente only) */
const toggleUsuario = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: "ID no válido" });
    }

    const [rows] = await pool.query(
      "SELECT activo FROM usuarios WHERE id_usuario = ? LIMIT 1",
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ ok: false, message: "Usuario no encontrado" });
    }

    const nuevoEstado = rows[0].activo ? 0 : 1;
    await pool.query("UPDATE usuarios SET activo = ? WHERE id_usuario = ?", [nuevoEstado, id]);

    return res.status(200).json({
      ok: true,
      message: nuevoEstado ? "Usuario activado" : "Usuario desactivado",
    });
  } catch (error) {
    console.error("Error en toggleUsuario:", error);
    return res.status(500).json({ ok: false, message: "Error al cambiar estado" });
  }
};

/* PUT /api/auth/usuarios/:id — Actualizar datos de usuario (gerente only) */
const actualizarUsuario = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombre, email, pin, rol, id_sucursal } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: "ID no válido" });
    }

    const [existe] = await pool.query("SELECT id_usuario FROM usuarios WHERE id_usuario = ? LIMIT 1", [id]);
    if (!existe.length) {
      return res.status(404).json({ ok: false, message: "Usuario no encontrado" });
    }

    const updates = [];
    const params = [];

    if (nombre) { updates.push("nombre = ?"); params.push(nombre.trim()); }
    if (email !== undefined) { updates.push("email = ?"); params.push(email?.trim() || null); }
    if (pin) {
      if (!/^\d{4,6}$/.test(String(pin))) {
        return res.status(400).json({ ok: false, message: "El PIN debe ser numérico de 4 a 6 dígitos" });
      }
      updates.push("pin = ?"); params.push(String(pin));
    }
    if (rol) { updates.push("rol = ?"); params.push(rol); }
    if (id_sucursal !== undefined) { updates.push("id_sucursal = ?"); params.push(id_sucursal || null); }

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, message: "No hay campos para actualizar" });
    }

    params.push(id);
    await pool.query(`UPDATE usuarios SET ${updates.join(", ")} WHERE id_usuario = ?`, params);

    return res.status(200).json({ ok: true, message: "Usuario actualizado correctamente" });
  } catch (error) {
    console.error("Error en actualizarUsuario:", error);
    return res.status(500).json({ ok: false, message: "Error al actualizar usuario" });
  }
};

module.exports = {
  login,
  verificarSesion,
  listarUsuarios,
  crearUsuario,
  toggleUsuario,
  actualizarUsuario,
};
