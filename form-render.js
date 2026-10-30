// Renderizado y lectura de formularios, compartido por la página pública y la vista previa del panel.
(function () {
  const TYPES = [
    { v: "text", l: "Texto corto" }, { v: "textarea", l: "Texto largo" }, { v: "number", l: "Número" },
    { v: "radio", l: "Selección única" }, { v: "checkbox", l: "Selección múltiple" }, { v: "select", l: "Lista desplegable" },
    { v: "yesno", l: "Sí / No" }, { v: "rating", l: "Calificación de 1 a 5" }, { v: "date", l: "Fecha" },
  ];
  const CHOICE = ["radio", "checkbox", "select"];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function fieldHTML(q, prefix) {
    const id = `${prefix}-${q.id}`;
    const req = q.required ? `<span class="req">Obligatoria</span>` : "";
    const err = `<div class="errmsg">Responde esta pregunta para continuar.</div>`;
    const choices = (opts, type) => opts.map((o) => `<label class="opt"><input type="${type}" name="${q.id}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join("");
    switch (q.type) {
      case "radio": return `<fieldset class="ask" data-q="${q.id}"><legend>${esc(q.label)}${req}</legend>${choices(q.options || [], "radio")}${err}</fieldset>`;
      case "checkbox": return `<fieldset class="ask" data-q="${q.id}"><legend>${esc(q.label)}${req}</legend>${choices(q.options || [], "checkbox")}${err}</fieldset>`;
      case "yesno": return `<fieldset class="ask" data-q="${q.id}"><legend>${esc(q.label)}${req}</legend><div class="seg">${["Sí", "No"].map((o) => `<label><input type="radio" name="${q.id}" value="${o}"><span>${o}</span></label>`).join("")}</div>${err}</fieldset>`;
      case "rating": return `<fieldset class="ask" data-q="${q.id}"><legend>${esc(q.label)}${req}</legend><div class="seg">${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="${q.id}" value="${n}" aria-label="${n} de 5"><span>${n}</span></label>`).join("")}</div><div class="scale"><span>Muy malo</span><span>Excelente</span></div>${err}</fieldset>`;
      case "select": return `<div class="ask" data-q="${q.id}"><label class="qt" for="${id}">${esc(q.label)}${req}</label><select class="in" id="${id}" name="${q.id}"><option value="">Elige una opción</option>${(q.options || []).map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join("")}</select>${err}</div>`;
      case "textarea": return `<div class="ask" data-q="${q.id}"><label class="qt" for="${id}">${esc(q.label)}${req}</label><textarea class="in" id="${id}" name="${q.id}" rows="4" maxlength="4000"></textarea>${err}</div>`;
      case "number": return `<div class="ask" data-q="${q.id}"><label class="qt" for="${id}">${esc(q.label)}${req}</label><input class="in" type="number" step="any" inputmode="decimal" id="${id}" name="${q.id}">${err}</div>`;
      case "date": return `<div class="ask" data-q="${q.id}"><label class="qt" for="${id}">${esc(q.label)}${req}</label><input class="in" type="date" id="${id}" name="${q.id}">${err}</div>`;
      default: return `<div class="ask" data-q="${q.id}"><label class="qt" for="${id}">${esc(q.label)}${req}</label><input class="in" type="text" id="${id}" name="${q.id}" maxlength="255" autocomplete="off">${err}</div>`;
    }
  }

  function renderForm(f, { preview = false, submitLabel = "Enviar respuesta" } = {}) {
    const prefix = preview ? "pv" : "fx";
    return `<div class="fill-head"><div class="inner">
      <img src="/assets/logo-honor-blanco.png" alt="HONOR Servicios de Seguridad">
      <h1 class="fill-title" style="font-weight:800;font-size:clamp(30px,7vw,46px);line-height:1.02;letter-spacing:-.01em">${esc(f.title)}</h1>
      ${f.description ? `<p class="desc">${esc(f.description)}</p>` : ""}
    </div></div>
    <div class="fill has-head">
      <form data-qrform novalidate>
        ${(f.fields || []).map((q) => fieldHTML(q, prefix)).join("")}
        <div class="hp" aria-hidden="true"><label>No llenar<input name="__hp" tabindex="-1" autocomplete="off"></label></div>
        <div class="formerr" role="alert"></div>
        <button class="btn send block" type="submit" style="min-height:52px;font-size:16px;margin-top:8px">${esc(submitLabel)}</button>
      </form></div>`;
  }

  function collect(formEl, f) {
    const answers = {}, errors = [];
    (f.fields || []).forEach((q) => {
      const els = [...formEl.querySelectorAll(`[name="${q.id}"]`)];
      let v;
      if (["radio", "yesno", "rating"].includes(q.type)) { const c = els.find((e) => e.checked); v = c ? (q.type === "rating" ? Number(c.value) : c.value) : ""; }
      else if (q.type === "checkbox") v = els.filter((e) => e.checked).map((e) => e.value);
      else if (q.type === "number") v = els[0] && els[0].value !== "" ? Number(els[0].value) : "";
      else v = els[0] ? els[0].value.trim() : "";
      const empty = v === "" || v === null || (Array.isArray(v) && !v.length) || (typeof v === "number" && isNaN(v));
      const box = formEl.querySelector(`[data-q="${q.id}"]`);
      if (box) box.classList.toggle("err", q.required && empty);
      if (q.required && empty) errors.push(box);
      if (!empty) answers[q.id] = v;
    });
    const hpEl = formEl.querySelector('[name="__hp"]');
    return { answers, errors, hp: hpEl ? hpEl.value : "" };
  }

  function markServerErrors(formEl, ids) {
    const boxes = (ids || []).map((id) => formEl.querySelector(`[data-q="${id}"]`)).filter(Boolean);
    boxes.forEach((b) => b.classList.add("err"));
    return boxes;
  }

  window.QRForms = { TYPES, CHOICE, esc, renderForm, collect, markServerErrors };
})();
