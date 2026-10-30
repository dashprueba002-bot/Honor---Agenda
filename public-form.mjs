// Público: cualquier persona con el QR puede ver el formulario.
import { json } from "../lib/auth.mjs";
import { getForm } from "../lib/store.mjs";

export default async (req) => {
  try {
    const q = new URL(req.url).searchParams;
    const form = await getForm(q.get("id"));
    if (!form || !q.get("k") || form.key !== q.get("k")) return json(404, { error: "Formulario no disponible" });
    if (!form.active) return json(410, { error: "Este formulario ya no recibe respuestas" });
    const { title, description, fields } = form;
    return json(200, { title, description, fields });
  } catch (e) {
    console.error(e);
    return json(500, { error: "No se pudo cargar el formulario" });
  }
};

export const config = { path: "/api/public/form" };
