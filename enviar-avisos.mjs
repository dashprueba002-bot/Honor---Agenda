// Tarea programada: cada minuto revisa los avisos vencidos y envía las notificaciones
import { tienda, enviarAUsuario } from "../lib/comun.mjs";
export default async () => {
  const st = tienda();
  const { blobs } = await st.list({ prefix: "avisos/" });
  const ahora = Date.now();
  for (const b of blobs) {
    const lista = (await st.get(b.key, { type: "json" })) || [];
    const vencidos = lista.filter(a => a.cuando <= ahora);
    if (!vencidos.length) continue;
    const usuario = b.key.slice("avisos/".length);
    for (const a of vencidos) {
      try {
        await enviarAUsuario(usuario, {
          titulo: "Honor · Tienes un recordatorio pendiente",
          cuerpo: "Revisa tu agenda de Honor. " + (a.titulo || "Recordatorio") + (a.texto ? " — " + a.texto : ""),
          id: a.id
        });
      } catch (e) { console.error("Error enviando aviso", usuario, a.id, e.message); }
    }
    const resto = lista.filter(a => a.cuando > ahora);
    if (resto.length) await st.setJSON(b.key, resto); else await st.delete(b.key);
  }
};
export const config = { schedule: "* * * * *" };
