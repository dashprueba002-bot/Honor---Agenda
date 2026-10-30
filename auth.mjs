// Sesión del administrador: cookie firmada (HMAC), HttpOnly, válida 8 horas.
// El usuario y la contraseña viven en variables de entorno de Netlify, nunca en el código publicado.
import crypto from "node:crypto";

const COOKIE = "honor_session";
const MAX_AGE = 8 * 60 * 60;

export const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("Falta SESSION_SECRET (mínimo 16 caracteres) en Netlify");
  return s;
}
const sign = (data) => crypto.createHmac("sha256", secret()).update(data).digest("base64url");
const sameText = (a, b) =>
  crypto.timingSafeEqual(
    crypto.createHash("sha256").update(String(a)).digest(),
    crypto.createHash("sha256").update(String(b)).digest()
  );

export function checkCredentials(user, password) {
  const U = process.env.ADMIN_USER, P = process.env.ADMIN_PASSWORD;
  if (!U || !P) throw new Error("Faltan ADMIN_USER o ADMIN_PASSWORD en Netlify");
  const okUser = sameText(String(user ?? "").trim(), U);
  const okPass = sameText(String(password ?? ""), P);
  return okUser && okPass;
}

export function sessionCookie(user) {
  const payload = Buffer.from(JSON.stringify({ u: user, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`;
}

export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export function readSession(req) {
  const raw = req.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)honor_session=([^;]+)/);
  if (!m) return null;
  const [payload, sig] = m[1].split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.exp || data.exp < Date.now()) return null;
    if (data.u !== process.env.ADMIN_USER) return null; // si cambias el usuario, las sesiones viejas dejan de valer
    return data;
  } catch {
    return null;
  }
}

// Envuelve un endpoint del panel: exige sesión válida y convierte errores en JSON.
export function adminOnly(handler) {
  return async (req, context) => {
    let session = null;
    try { session = readSession(req); } catch (e) { return json(500, { error: e.message }); }
    if (!session) return json(401, { error: "Inicia sesión" });
    if (req.method !== "GET" && !String(req.headers.get("content-type") || "").includes("application/json") && req.method !== "DELETE")
      return json(415, { error: "Formato no permitido" });
    try {
      return await handler(req, context, session);
    } catch (e) {
      console.error(e);
      return json(e.status && e.status < 500 ? e.status : 500, { error: e.message || "Error inesperado" });
    }
  };
}

// Límite sencillo en memoria (por instancia). Sirve para frenar intentos repetidos.
const buckets = new Map();
export function limited(key, max, windowMs) {
  const now = Date.now();
  const list = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) { buckets.set(key, list); return true; }
  list.push(now);
  buckets.set(key, list);
  if (buckets.size > 5000) buckets.clear();
  return false;
}
