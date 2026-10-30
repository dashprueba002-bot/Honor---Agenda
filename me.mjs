import { json, readSession } from "../lib/auth.mjs";

export default async (req) => {
  try {
    const s = readSession(req);
    return s ? json(200, { user: s.u, role: "admin" }) : json(401, { error: "Sin sesión" });
  } catch (e) {
    return json(500, { error: e.message });
  }
};

export const config = { path: "/api/me" };
