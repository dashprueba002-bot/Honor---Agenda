// Envía una notificación de prueba inmediata
import { json, sesion, noAutorizado, enviarAUsuario } from "../lib/comun.mjs";
export default async req => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const s = await sesion(req);
  if (!s) return noAutorizado();
  const enviados = await enviarAUsuario(s.usuario, {
    titulo: "Honor · Prueba de aviso",
    cuerpo: "Revisa tu agenda de Honor. Así te llegarán tus recordatorios.",
    id: "prueba"
  });
  return json({ ok: true, enviados });
};
export const config = { path: "/api/probar" };
