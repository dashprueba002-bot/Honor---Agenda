import { json, clearCookie } from "../lib/auth.mjs";

export default async () => json(200, { ok: true }, { "Set-Cookie": clearCookie() });

export const config = { path: "/api/logout" };
