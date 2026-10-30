import { json, adminOnly } from "../lib/auth.mjs";
import { listForms, saveForm } from "../lib/store.mjs";

export default adminOnly(async (req) => {
  if (req.method === "GET") return json(200, { forms: await listForms() });
  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    return json(200, { form: await saveForm(body) });
  }
  return json(405, { error: "Método no permitido" });
});

export const config = { path: "/api/manage/forms" };
