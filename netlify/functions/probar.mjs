// Envía una notificación de prueba inmediata
import { json, limpiarId, enviarAUsuario } from "../lib/comun.mjs";
export default async req => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  let datos; try { datos = await req.json(); } catch { return json({ error: "Datos inválidos" }, 400); }
  const usuario = limpiarId(datos.usuario);
  if (!usuario) return json({ error: "Falta el usuario" }, 400);
  const enviados = await enviarAUsuario(usuario, {
    titulo: "Honor · Prueba de aviso",
    cuerpo: "Revisa tu agenda de Honor. Así te llegarán tus recordatorios.",
    id: "prueba"
  });
  return json({ ok: true, enviados });
};
export const config = { path: "/api/probar" };
