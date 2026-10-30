// Público: recibe la respuesta, la valida contra el formulario y la guarda en SharePoint.
import { json, limited } from "../lib/auth.mjs";
import { getForm, validateAnswers, addResponse } from "../lib/store.mjs";

export default async (req, context) => {
  if (req.method !== "POST") return json(405, { error: "Método no permitido" });
  try {
    if (limited("submit:" + (context.ip || "anon"), 20, 60 * 1000))
      return json(429, { error: "Demasiados envíos seguidos. Espera un minuto." });
    const body = await req.json().catch(() => ({}));
    if (body.hp) return json(200, { ok: true }); // trampa para bots
    const form = await getForm(body.id);
    if (!form || !body.k || form.key !== body.k) return json(404, { error: "Formulario no disponible" });
    if (!form.active) return json(410, { error: "Este formulario ya no recibe respuestas" });
    const { answers, errors } = validateAnswers(form, body.answers);
    if (errors.length) return json(400, { error: "Revisa las preguntas marcadas", fields: errors });
    await addResponse(form, answers);
    return json(201, { ok: true });
  } catch (e) {
    console.error(e);
    return json(500, { error: "No se pudo guardar la respuesta. Inténtalo de nuevo." });
  }
};

export const config = { path: "/api/public/submit" };
