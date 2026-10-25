// Inicio y cierre de sesión
import { tienda, json, limpiarId, verificarClave, asegurarAdmin, crearSesion, sesion, noAutorizado, esperar } from "../lib/comun.mjs";
export default async req => {
  const st = tienda();
  if (req.method === "GET") {           // ¿la sesión sigue activa?
    const s = await sesion(req);
    return s ? json({ usuario: s.usuario, nombre: s.nombre, admin: s.admin }) : noAutorizado();
  }
  if (req.method === "DELETE") {        // cerrar sesión
    const s = await sesion(req);
    if (s) await st.delete("sesiones/" + s.token);
    return json({ ok: true });
  }
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  await asegurarAdmin();
  let d; try { d = await req.json(); } catch { return json({ error: "Datos inválidos" }, 400); }
  const usuario = limpiarId(d.usuario);
  const reg = usuario ? await st.get("usuarios/" + usuario, { type: "json" }) : null;
  if (!reg || !verificarClave(d.clave || "", reg.clave)) {
    await esperar(700);                 // frena los intentos repetidos
    return json({ error: "Usuario o contraseña incorrectos." }, 401);
  }
  const token = await crearSesion(usuario);
  return json({ token, usuario, nombre: reg.nombre || "", admin: !!reg.admin });
};
export const config = { path: "/api/login" };
