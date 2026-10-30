// Cliente mínimo de Microsoft Graph con credenciales de aplicación (client credentials).
// Requiere las variables TENANT_ID, CLIENT_ID, CLIENT_SECRET y SITE_ID.

const GRAPH = "https://graph.microsoft.com/v1.0";
let cached = { token: null, exp: 0 };

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de configuración ${name}`);
  return v;
}

async function getToken() {
  if (cached.token && Date.now() < cached.exp - 60_000) return cached.token;
  const body = new URLSearchParams({
    client_id: env("CLIENT_ID"),
    client_secret: env("CLIENT_SECRET"),
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const r = await fetch(`https://login.microsoftonline.com/${env("TENANT_ID")}/oauth2/v2.0/token`, {
    method: "POST",
    body,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`No se obtuvo token de Microsoft: ${data.error_description || r.status}`);
  cached = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

async function graph(path, { method = "GET", body, headers = {} } = {}) {
  const token = await getToken();
  const url = path.startsWith("http") ? path : `${GRAPH}${path}`;
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 204) return null;
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) {
    const e = new Error(`Graph ${r.status}: ${data?.error?.message || text}`);
    e.status = r.status;
    throw e;
  }
  return data;
}

// Recorre todas las páginas de una consulta de Graph.
async function graphAll(path) {
  let url = path;
  const out = [];
  while (url) {
    const page = await graph(url);
    out.push(...(page.value || []));
    url = page["@odata.nextLink"] || null;
  }
  return out;
}

const site = () => `/sites/${env("SITE_ID")}`;

export { graph, graphAll, site, env };
