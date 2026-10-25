// Registra el celular de un trabajador para recibir notificaciones
import { tienda, json, limpiarId } from "../lib/comun.mjs";
export default async req => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  let datos; try { datos = await req.json(); } catch { return json({ error: "Datos inválidos" }, 400); }
  const usuario = limpiarId(datos.usuario);
  const sub = datos.sub;
  if (!usuario || !sub || typeof sub.endpoint !== "string" || !sub.keys) return json({ error: "Faltan datos" }, 400);
  const st = tienda();
  const clave = "subs/" + usuario;
  const subs = ((await st.get(clave, { type: "json" })) || []).filter(s => s.endpoint !== sub.endpoint);
  subs.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  await st.setJSON(clave, subs.slice(-5)); // hasta 5 celulares por usuario
  return json({ ok: true });
};
export const config = { path: "/api/suscribir" };
