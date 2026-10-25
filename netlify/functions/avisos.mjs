// Guarda la lista de avisos pendientes de un trabajador
import { tienda, json, limpiarId } from "../lib/comun.mjs";
export default async req => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  let datos; try { datos = await req.json(); } catch { return json({ error: "Datos inválidos" }, 400); }
  const usuario = limpiarId(datos.usuario);
  if (!usuario || !Array.isArray(datos.avisos)) return json({ error: "Faltan datos" }, 400);
  const ahora = Date.now();
  const avisos = datos.avisos
    .filter(a => a && typeof a.cuando === "number" && a.cuando > ahora - 60000)
    .slice(0, 200)
    .map(a => ({ id: String(a.id || "").slice(0, 40), cuando: a.cuando,
                 titulo: String(a.titulo || "").slice(0, 120), texto: String(a.texto || "").slice(0, 200) }));
  const st = tienda();
  if (avisos.length) await st.setJSON("avisos/" + usuario, avisos);
  else await st.delete("avisos/" + usuario);
  return json({ ok: true, pendientes: avisos.length });
};
export const config = { path: "/api/avisos" };
