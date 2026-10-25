// Utilidades compartidas por las funciones de Honor · Mi gestión (JF26)
import { getStore } from "@netlify/blobs";
import webpush from "web-push";
import crypto from "node:crypto";

export const tienda = () => getStore({ name: "honor-agenda", consistency: "strong" });

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

// Usuario = número de cédula
export const limpiarId = u => String(u || "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 40);
export const idValido = id => /^[A-Za-z0-9]{6,40}$/.test(String(id || ""));
export const esperar = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Contraseñas (scrypt con sal) ---------- */
export function hashClave(clave, sal = crypto.randomBytes(16).toString("hex")) {
  return { sal, h: crypto.scryptSync(String(clave), sal, 32).toString("hex") };
}
export function verificarClave(clave, reg) {
  if (!reg || !reg.sal || !reg.h) return false;
  const a = Buffer.from(hashClave(clave, reg.sal).h, "hex"), b = Buffer.from(reg.h, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Si no existe ningún usuario, crea el administrador inicial (cambiar la contraseña al entrar).
export async function asegurarAdmin() {
  const st = tienda();
  const { blobs } = await st.list({ prefix: "usuarios/" });
  if (blobs.length) return;
  await st.setJSON("usuarios/1095841966", {
    usuario: "1095841966", nombre: "Administrador", admin: true,
    clave: hashClave("123456"), creado: Date.now()
  });
}

/* ---------- Sesiones ---------- */
export async function crearSesion(usuario) {
  const token = crypto.randomBytes(32).toString("hex");
  await tienda().setJSON("sesiones/" + token, { usuario, vence: Date.now() + 30 * 864e5 });
  return token;
}
// Devuelve {token, usuario, nombre, admin} o null
export async function sesion(req) {
  const auth = req.headers.get("authorization") || "";
  let t = auth.startsWith("Bearer ") ? auth.slice(7) : (new URL(req.url).searchParams.get("t") || "");
  t = t.replace(/[^a-f0-9]/g, "");
  if (t.length !== 64) return null;
  const st = tienda();
  const s = await st.get("sesiones/" + t, { type: "json" });
  if (!s || s.vence < Date.now()) return null;
  const u = await st.get("usuarios/" + s.usuario, { type: "json" });
  if (!u) return null;
  return { token: t, usuario: u.usuario, nombre: u.nombre || "", admin: !!u.admin };
}
export const noAutorizado = () => json({ error: "Tu sesión venció. Ingresa de nuevo." }, 401);

/* ---------- Notificaciones push ---------- */
// Claves VAPID: se crean solas la primera vez y quedan guardadas.
export async function claves() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  const st = tienda();
  let k = await st.get("config/vapid", { type: "json" });
  if (!k) { k = webpush.generateVAPIDKeys(); await st.setJSON("config/vapid", k); }
  return k;
}

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
      vivas.push(s); enviados++;
    } catch (e) {
      if (e.statusCode !== 404 && e.statusCode !== 410) vivas.push(s);
    }
  }
  if (vivas.length !== subs.length) await st.setJSON(clave, vivas);
  return enviados;
}
