import { json, adminOnly } from "../lib/auth.mjs";
import { getForm, listResponses } from "../lib/store.mjs";

export default adminOnly(async (req, context) => {
  const form = await getForm(context.params.id);
  if (!form) return json(404, { error: "El formulario no existe" });
  return json(200, { responses: await listResponses(form) });
});

export const config = { path: "/api/manage/responses/:id" };
