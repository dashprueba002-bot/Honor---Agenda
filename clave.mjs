// Entrega la clave pública para registrar el celular
import { claves, json } from "../lib/comun.mjs";
export default async () => {
  const k = await claves();
  return json({ publicKey: k.publicKey });
};
export const config = { path: "/api/clave" };
