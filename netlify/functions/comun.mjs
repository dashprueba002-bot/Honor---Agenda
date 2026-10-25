// Utilidades compartidas por las funciones de avisos (JF26)
import { getStore } from "@netlify/blobs";
import webpush from "web-push";

export const tienda = () => getStore({ name: "honor-agenda", consistency: "strong" });

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

// Usuario = número de cédula del inicio de sesión
export const limpiarId = u => String(u || "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 40);

// Claves VAPID: se crean solas la primera vez y quedan guardadas.
// (Opcional: definir VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en Netlify para usar las propias.)
export async function claves() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  const st = tienda();
  let k = await st.get("config/vapid", { type: "json" });
  if (!k) {
    k = webpush.generateVAPIDKeys();
    await st.setJSON("config/vapid", k);
  }
  return k;
}

// Envía una notificación a todos los celulares registrados de un usuario.
export async function enviarAUsuario(usuario, datos) {
  const k = await claves();
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:avisos@honor-seguridad.app", k.publicKey, k.privateKey);
  const st = tienda();
  const clave = "subs/" + usuario;
  const subs = (await st.get(clave, { type: "json" })) || [];
  const vivas = [];
  let enviados = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(s, JSON.stringify(datos), { TTL: 3600, urgency: "high" });
      vivas.push(s);
      enviados++;
    } catch (e) {
      // 404/410: el celular ya no acepta esta suscripción; se descarta
      if (e.statusCode !== 404 && e.statusCode !== 410) vivas.push(s);
    }
  }
  if (vivas.length !== subs.length) await st.setJSON(clave, vivas);
  return enviados;
}
