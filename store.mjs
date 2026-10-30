// Formularios y respuestas guardados en listas de SharePoint.
//
// Lista de definiciones (QR_Formularios): un elemento por formulario.
//   Title       → título del formulario
//   Clave       → clave aleatoria que va en el QR (evita adivinar formularios)
//   Definicion  → JSON con descripción y preguntas
//   ListaId     → id de la lista de respuestas de ese formulario
//   ListaUrl    → enlace a esa lista en SharePoint
//   Activo      → si acepta respuestas
//
// Lista de respuestas: una por formulario, con una columna por pregunta.

import crypto from "node:crypto";
import { graph, graphAll, site } from "./graph.mjs";

const TYPES = new Set(["text", "textarea", "number", "radio", "checkbox", "select", "yesno", "rating", "date"]);
const CHOICE = new Set(["radio", "checkbox", "select"]);
const YESNO = ["Sí", "No"];

let defsListId = process.env.DEFS_LIST_ID || null;
const defsName = () => process.env.DEFS_LIST_NAME || "QR_Formularios";

/* ---------- Lista de definiciones ---------- */
async function getDefsListId({ create = false } = {}) {
  if (defsListId) return defsListId;
  const lists = await graphAll(`${site()}/lists?$select=id,displayName`);
  const found = lists.find((l) => l.displayName === defsName());
  if (found) return (defsListId = found.id);
  if (!create) throw Object.assign(new Error("La lista de formularios aún no existe"), { status: 404 });
  const list = await graph(`${site()}/lists`, {
    method: "POST",
    body: {
      displayName: defsName(),
      list: { template: "genericList" },
      columns: [
        { name: "Clave", text: {} },
        { name: "Definicion", text: { allowMultipleLines: true, textType: "plain" } },
        { name: "ListaId", text: {} },
        { name: "ListaUrl", text: {} },
        { name: "Activo", boolean: {} },
      ],
    },
  });
  return (defsListId = list.id);
}

/* ---------- Limpieza de la definición que llega del navegador ---------- */
function str(v, max) {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanDefinition(input) {
  const title = str(input.title, 200) || "Formulario sin título";
  const description = String(input.description ?? "").trim().slice(0, 2000);
  const seenIds = new Set();
  const seenLabels = new Map();
  const fields = (Array.isArray(input.fields) ? input.fields : []).slice(0, 60).map((q) => {
    let id = /^q[a-z0-9]{3,30}$/i.test(q?.id || "") ? q.id : "q" + crypto.randomBytes(5).toString("hex");
    while (seenIds.has(id)) id = "q" + crypto.randomBytes(5).toString("hex");
    seenIds.add(id);
    let label = str(q?.label, 240) || "Pregunta sin texto";
    const n = (seenLabels.get(label.toLowerCase()) || 0) + 1;
    seenLabels.set(label.toLowerCase(), n);
    if (n > 1) label = `${label} (${n})`;
    const type = TYPES.has(q?.type) ? q.type : "text";
    const options = CHOICE.has(type)
      ? [...new Set((Array.isArray(q.options) ? q.options : []).map((o) => str(o, 200)).filter(Boolean))].slice(0, 50)
      : [];
    return { id, label, type, required: !!q?.required, options };
  });
  if (!fields.length) throw Object.assign(new Error("El formulario necesita al menos una pregunta"), { status: 400 });
  const bad = fields.find((q) => CHOICE.has(q.type) && q.options.length < 2);
  if (bad) throw Object.assign(new Error(`“${bad.label}” necesita al menos dos opciones`), { status: 400 });
  return { title, description, fields };
}

/* ---------- Columnas de la lista de respuestas ---------- */
function columnFor(q) {
  const base = { name: q.id, displayName: q.label };
  if (q.type === "number" || q.type === "rating") return { ...base, number: {} };
  if (q.type === "date") return { ...base, dateTime: { format: "dateOnly" } };
  if (q.type === "textarea" || q.type === "checkbox")
    return { ...base, text: { allowMultipleLines: true, textType: "plain" } };
  return { ...base, text: {} };
}

function safeListName(title) {
  const clean = title.replace(/[~"#%&*:<>?/\\{|}.]/g, " ").replace(/\s+/g, " ").trim().slice(0, 70);
  return `QR - ${clean || "Formulario"} ${crypto.randomBytes(2).toString("hex")}`;
}

async function createResponseList(def) {
  const list = await graph(`${site()}/lists`, {
    method: "POST",
    body: {
      displayName: safeListName(def.title),
      list: { template: "genericList" },
      columns: [
        { name: "FechaRespuesta", displayName: "Fecha de respuesta", dateTime: { format: "dateTime" } },
        ...def.fields.map(columnFor),
      ],
    },
  });
  return { id: list.id, webUrl: list.webUrl };
}

// Agrega columnas para preguntas nuevas y actualiza el nombre visible de las existentes.
// Las columnas de preguntas eliminadas se conservan para no perder respuestas antiguas.
async function syncColumns(listId, def) {
  const cols = await graphAll(`${site()}/lists/${listId}/columns`);
  const byName = new Map(cols.map((c) => [c.name, c]));
  for (const q of def.fields) {
    const c = byName.get(q.id);
    if (!c) {
      await graph(`${site()}/lists/${listId}/columns`, { method: "POST", body: columnFor(q) });
    } else if (c.displayName !== q.label) {
      await graph(`${site()}/lists/${listId}/columns/${c.id}`, { method: "PATCH", body: { displayName: q.label } });
    }
  }
}

/* ---------- Formularios ---------- */
function toForm(item) {
  const f = item.fields || {};
  let def = {};
  try { def = JSON.parse(f.Definicion || "{}"); } catch {}
  return {
    id: String(item.id),
    key: f.Clave,
    title: f.Title || def.title || "Formulario",
    description: def.description || "",
    fields: def.fields || [],
    active: f.Activo !== false,
    listId: f.ListaId,
    listUrl: f.ListaUrl,
    createdAt: item.createdDateTime,
    updatedAt: item.lastModifiedDateTime,
  };
}

async function listForms() {
  const id = await getDefsListId({ create: true });
  const items = await graphAll(`${site()}/lists/${id}/items?$expand=fields&$top=500`);
  return items.map(toForm).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function getForm(id) {
  if (!/^\d{1,9}$/.test(String(id))) return null;
  const listId = await getDefsListId();
  try {
    return toForm(await graph(`${site()}/lists/${listId}/items/${id}?$expand=fields`));
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function saveForm(input) {
  const def = cleanDefinition(input);
  const defs = await getDefsListId({ create: true });
  const active = input.active !== false;

  if (!input.id) {
    const list = await createResponseList(def);
    const item = await graph(`${site()}/lists/${defs}/items`, {
      method: "POST",
      body: {
        fields: {
          Title: def.title,
          Clave: crypto.randomBytes(9).toString("base64url"),
          Definicion: JSON.stringify(def),
          ListaId: list.id,
          ListaUrl: list.webUrl,
          Activo: active,
        },
      },
    });
    return getForm(item.id);
  }

  const current = await getForm(input.id);
  if (!current) throw Object.assign(new Error("El formulario no existe"), { status: 404 });
  await syncColumns(current.listId, def);
  await graph(`${site()}/lists/${defs}/items/${current.id}/fields`, {
    method: "PATCH",
    body: { Title: def.title, Definicion: JSON.stringify(def), Activo: active },
  });
  return getForm(current.id);
}

// No borra datos: desactiva el formulario. La lista de respuestas queda intacta en SharePoint.
async function deactivateForm(id) {
  const defs = await getDefsListId();
  await graph(`${site()}/lists/${defs}/items/${id}/fields`, { method: "PATCH", body: { Activo: false } });
}

/* ---------- Respuestas ---------- */
function validateAnswers(form, raw) {
  const answers = {};
  const errors = [];
  const src = raw && typeof raw === "object" ? raw : {};
  for (const q of form.fields) {
    let v = src[q.id];
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length);
    if (empty) {
      if (q.required) errors.push(q.id);
      continue;
    }
    let ok = true;
    switch (q.type) {
      case "text": v = String(v).trim().slice(0, 255); break;
      case "textarea": v = String(v).trim().slice(0, 4000); break;
      case "number": v = Number(v); ok = Number.isFinite(v); break;
      case "rating": v = Number(v); ok = Number.isInteger(v) && v >= 1 && v <= 5; break;
      case "date": v = String(v); ok = /^\d{4}-\d{2}-\d{2}$/.test(v); break;
      case "yesno": ok = YESNO.includes(v); break;
      case "radio": case "select": ok = q.options.includes(v); break;
      case "checkbox": ok = Array.isArray(v) && v.every((o) => q.options.includes(o)); v = ok ? [...new Set(v)] : v; break;
      default: ok = false;
    }
    if (!ok) errors.push(q.id);
    else answers[q.id] = v;
  }
  return { answers, errors };
}

async function addResponse(form, answers) {
  const now = new Date().toISOString();
  const fields = { Title: now, FechaRespuesta: now };
  for (const q of form.fields) {
    const v = answers[q.id];
    if (v === undefined) continue;
    if (q.type === "checkbox") fields[q.id] = v.join("; ");
    else if (q.type === "date") fields[q.id] = `${v}T12:00:00Z`;
    else fields[q.id] = v;
  }
  await graph(`${site()}/lists/${form.listId}/items`, { method: "POST", body: { fields } });
}

async function listResponses(form) {
  const items = await graphAll(`${site()}/lists/${form.listId}/items?$expand=fields&$top=500`);
  return items
    .map((it) => {
      const f = it.fields || {};
      const answers = {};
      for (const q of form.fields) {
        const v = f[q.id];
        if (v === undefined || v === null || v === "") continue;
        if (q.type === "checkbox") answers[q.id] = String(v).split("; ").filter(Boolean);
        else if (q.type === "date") answers[q.id] = String(v).slice(0, 10);
        else answers[q.id] = v;
      }
      return { at: f.FechaRespuesta || it.createdDateTime, answers };
    })
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

export { listForms, getForm, saveForm, deactivateForm, validateAnswers, addResponse, listResponses };
