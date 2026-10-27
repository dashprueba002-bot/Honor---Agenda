// Notas de cada usuario, guardadas en línea
import { tienda, json, sesion, noAutorizado, idValido } from "../lib/comun.mjs";
const txt = (v, max) => String(v || "").slice(0, max);
async function actualizarAviso(st, usuario, id, aviso) {
  const clave = "avisos/" + usuario;
  const lista = ((await st.get(clave, { type: "json" })) || []).filter(a => a.id !== id);
  if (aviso) lista.push(aviso);
  if (lista.length) await st.setJSON(clave, lista.slice(-200)); else await st.delete(clave);
}
export default async req => {
  const s = await sesion(req);
  if (!s) return noAutorizado();
  const st = tienda();
  const pre = `notas/${s.usuario}/`;

  if (req.method === "GET") {
    const { blobs } = await st.list({ prefix: pre });
    const notas = (await Promise.all(blobs.map(b => st.get(b.key, { type: "json" })))).filter(Boolean);
    return json({ notas });
  }

  if (req.method === "POST") {
    let d; try { d = await req.json(); } catch { return json({ error: "Datos inválidos" }, 400); }
    const n = d && d.nota;
    if (!n || !idValido(n.id)) return json({ error: "Nota inválida" }, 400);
    const nota = {
      id: n.id,
      titulo: txt(n.titulo, 200),
      texto: txt(n.texto, 20000),
      fecha: /^\d{4}-\d{2}-\d{2}$/.test(n.fecha) ? n.fecha : new Date().toISOString().slice(0, 10),
      hora: /^\d{2}:\d{2}$/.test(n.hora) ? n.hora : "",
      urgente: !!n.urgente,
      aviso: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(n.aviso) ? n.aviso : "",
      avisado: !!n.avisado,
      fotos: (Array.isArray(n.fotos) ? n.fotos : []).filter(f => f && idValido(f.id) && f.src === "srv").slice(0, 30).map(f => ({ id: f.id, src: "srv" })),
      creado: Number(n.creado) || Date.now(),
      actualizado: Date.now()
    };
    await st.setJSON(pre + nota.id, nota);
    // Mantiene al día la lista de avisos del servidor (así funciona aunque la nota venga de Outlook)
    const cuando = Number(n.avisoCuando);
    if (!nota.aviso || nota.avisado || cuando > 0) {
      await actualizarAviso(st, s.usuario, nota.id,
        nota.aviso && !nota.avisado && cuando > Date.now() - 60000 && cuando < Date.now() + 400 * 864e5
          ? { id: nota.id, cuando, titulo: nota.titulo.slice(0, 120), texto: nota.texto.slice(0, 200) } : null);
    }
    return json({ ok: true, nota });
  }

  if (req.method === "DELETE") {
    const id = new URL(req.url).searchParams.get("id");
    if (!idValido(id)) return json({ error: "Nota inválida" }, 400);
    const n = await st.get(pre + id, { type: "json" });
    if (n) {
      for (const f of n.fotos || []) await st.delete(`fotos/${s.usuario}/${f.id}`);
      await st.delete(pre + id);
    }
    await actualizarAviso(st, s.usuario, id, null);
    return json({ ok: true });
  }
  return json({ error: "Método no permitido" }, 405);
};
export const config = { path: "/api/notas" };
