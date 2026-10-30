import { json, adminOnly } from "../lib/auth.mjs";
import { deactivateForm } from "../lib/store.mjs";

export default adminOnly(async (req, context) => {
  if (req.method !== "DELETE") return json(405, { error: "Método no permitido" });
  const id = context.params.id;
  if (!/^\d{1,9}$/.test(String(id))) return json(400, { error: "Id no válido" });
  await deactivateForm(id);
  return json(200, { ok: true });
});

export const config = { path: "/api/manage/forms/:id" };
