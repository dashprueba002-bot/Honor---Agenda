// Administración de usuarios y cambio de contraseña
import { tienda, json, sesion, noAutorizado, limpiarId, hashClave, verificarClave } from "../lib/comun.mjs";
export default async req => {
  const s = await sesion(req);
  if (!s) return noAutorizado();
  const st = tienda();

  if (req.method === "GET") {
    if (!s.admin) return json({ error: "Solo para administradores" }, 403);
    const { blobs } = await st.list({ prefix: "usuarios/" });
    const lista = (await Promise.all(blobs.map(b => st.get(b.key, { type: "json" })))).filter(Boolean)
      .map(u => ({ usuario: u.usuario, nombre: u.nombre || "", admin: !!u.admin, creado: u.creado || 0 }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    return json({ usuarios: lista });
  }
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  let d; try { d = await req.json(); } catch { return json({ error: "Datos inválidos" }, 400); }

  // Cualquier usuario: cambiar su propia contraseña
  if (d.accion === "miClave") {
    const yo = await st.get("usuarios/" + s.usuario, { type: "json" });
    if (!verificarClave(d.actual || "", yo && yo.clave)) return json({ error: "La contraseña actual no es correcta." }, 400);
    if (String(d.nueva || "").length < 6) return json({ error: "La nueva contraseña debe tener al menos 6 caracteres." }, 400);
    yo.clave = hashClave(d.nueva);
    await st.setJSON("usuarios/" + s.usuario, yo);
    return json({ ok: true });
  }

  if (!s.admin) return json({ error: "Solo para administradores" }, 403);
  const usuario = limpiarId(d.usuario);
  if (!usuario) return json({ error: "Escribe el número de cédula." }, 400);
  const clave = "usuarios/" + usuario;

  if (d.accion === "crear") {
    if (await st.get(clave, { type: "json" })) return json({ error: "Ya existe un usuario con esa cédula." }, 400);
    if (String(d.clave || "").length < 6) return json({ error: "La contraseña debe tener al menos 6 caracteres." }, 400);
    await st.setJSON(clave, { usuario, nombre: String(d.nombre || "").slice(0, 80), admin: !!d.admin, clave: hashClave(d.clave), creado: Date.now() });
    return json({ ok: true });
  }
  if (d.accion === "restablecer") {
    const u = await st.get(clave, { type: "json" });
    if (!u) return json({ error: "Ese usuario no existe." }, 404);
    if (String(d.clave || "").length < 6) return json({ error: "La contraseña debe tener al menos 6 caracteres." }, 400);
    u.clave = hashClave(d.clave);
    await st.setJSON(clave, u);
    return json({ ok: true });
  }
  if (d.accion === "eliminar") {
    if (usuario === s.usuario) return json({ error: "No puedes eliminar tu propio usuario." }, 400);
    await st.delete(clave);   // sus sesiones dejan de servir; sus notas quedan guardadas
    return json({ ok: true });
  }
  return json({ error: "Acción no válida" }, 400);
};
export const config = { path: "/api/usuarios" };
