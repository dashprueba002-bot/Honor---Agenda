// Registra el celular del usuario para recibir notificaciones
import { tienda, json, sesion, noAutorizado } from "../lib/comun.mjs";
export default async req => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const s = await sesion(req);
  if (!s) return noAutorizado();
  let datos; try { datos = await req.json(); } catch { return json({ error: "Datos inválidos" }, 400); }
  const sub = datos.sub;
  if (!sub || typeof sub.endpoint !== "string" || !sub.keys) return json({ error: "Faltan datos" }, 400);
  const st = tienda();
  const clave = "subs/" + s.usuario;
  const subs = ((await st.get(clave, { type: "json" })) || []).filter(x => x.endpoint !== sub.endpoint);
  subs.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  await st.setJSON(clave, subs.slice(-5));
  return json({ ok: true });
};
export const config = { path: "/api/suscribir" };
