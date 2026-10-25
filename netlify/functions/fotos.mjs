// Fotos de las notas, guardadas en línea
import crypto from "node:crypto";
import { tienda, json, sesion, noAutorizado, idValido } from "../lib/comun.mjs";
export default async req => {
  const s = await sesion(req);
  if (!s) return noAutorizado();
  const st = tienda();
  const id = new URL(req.url).searchParams.get("id");

  if (req.method === "GET") {
    if (!idValido(id)) return new Response("Foto inválida", { status: 400 });
    const r = await st.getWithMetadata(`fotos/${s.usuario}/${id}`, { type: "arrayBuffer" });
    if (!r) return new Response("No encontrada", { status: 404 });
    return new Response(r.data, { headers: {
      "content-type": (r.metadata && r.metadata.tipo) || "image/jpeg",
      "cache-control": "private, max-age=31536000, immutable" } });
  }
  if (req.method === "POST") {
    const tipo = (req.headers.get("content-type") || "").split(";")[0].trim();
    if (!/^image\//.test(tipo)) return json({ error: "Solo se permiten imágenes" }, 400);
    const datos = await req.arrayBuffer();
    if (!datos.byteLength) return json({ error: "Imagen vacía" }, 400);
    if (datos.byteLength > 5 * 1024 * 1024) return json({ error: "La foto es muy pesada (máximo 5 MB)" }, 413);
    const nuevo = "f" + crypto.randomBytes(10).toString("hex");
    await st.set(`fotos/${s.usuario}/${nuevo}`, datos, { metadata: { tipo } });
    return json({ id: nuevo });
  }
  if (req.method === "DELETE") {
    if (idValido(id)) await st.delete(`fotos/${s.usuario}/${id}`);
    return json({ ok: true });
  }
  return json({ error: "Método no permitido" }, 405);
};
export const config = { path: "/api/fotos" };
