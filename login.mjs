import { json, checkCredentials, sessionCookie, limited } from "../lib/auth.mjs";

export default async (req, context) => {
  if (req.method !== "POST") return json(405, { error: "Método no permitido" });
  const ip = context.ip || "anon";
  if (limited("login:" + ip, 10, 15 * 60 * 1000))
    return json(429, { error: "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo." });
  const body = await req.json().catch(() => ({}));
  try {
    if (!checkCredentials(body.user, body.password)) {
      await new Promise((r) => setTimeout(r, 600));
      return json(401, { error: "Usuario o contraseña incorrectos" });
    }
    const user = String(body.user).trim();
    return json(200, { ok: true, user }, { "Set-Cookie": sessionCookie(user) });
  } catch (e) {
    console.error(e);
    return json(500, { error: e.message });
  }
};

export const config = { path: "/api/login" };
