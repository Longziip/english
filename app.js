const STORAGE_KEY = "moyenneCalc:v1";
const DEFAULT_TD_WEIGHT = 50;
const DEFAULT_SCALE = 20;
const MODULES = [
  { id: "oral-tech-1", name: "Technique of Oral language 1", coef: 3 },
  { id: "written-tech-1", name: "Technique of Written language 1", coef: 3 },
  { id: "esp", name: "English for specific purposes", short: "ESP", coef: 1 },
  { id: "ethics", name: "ETHICS", coef: 1 },
  { id: "spec-translation", name: "Specialized translation", coef: 1 },
  { id: "library-research", name: "Library research", coef: 2 },
  { id: "writing-reports", name: "Writing reports", coef: 1 },
  { id: "advanced-grammar", name: "Advanced grammar", coef: 1 },
  { id: "cpw", name: "Communication and professional terms", short: "CPW", coef: 1 },
  { id: "epp", name: "English for professional purposes", short: "EPP", coef: 1 },
  { id: "english-presentation", name: "English for presentation", coef: 1 },
];

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function isNumber(x) {
  return typeof x === "number" && Number.isFinite(x);
}

function parseMaybeNumber(v) {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function withinScale(n, scale) {
  return isNumber(n) && n >= 0 && n <= scale;
}

function getState() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    raw = null;
  }

  const marks = raw?.marks && typeof raw.marks === "object" ? raw.marks : {};

  return { marks };
}

function setState(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function computeModuleMark({ td, exam }, tdWeight, scale) {
  const hasTd = withinScale(td, scale);
  const hasExam = withinScale(exam, scale);

  if (hasTd && hasExam) {
    const examWeight = 100 - tdWeight;
    const mark = (td * tdWeight + exam * examWeight) / 100;
    return { mark, mode: "td+exam" };
  }

  if (hasExam) return { mark: exam, mode: "exam-only" };
  if (hasTd) return { mark: td, mode: "td-only" };

  return { mark: null, mode: "missing" };
}

function renderModulesTable(state) {
  const tbody = $("modulesTbody");
  tbody.innerHTML = "";

  for (const mod of MODULES) {
    const row = document.createElement("tr");
    row.dataset.moduleId = mod.id;

    const title = document.createElement("div");
    title.className = "module-title";
    title.textContent = mod.name;

    const sub = document.createElement("div");
    sub.className = "module-sub";
    sub.textContent = mod.short ? mod.short : " ";

    const tdCell = document.createElement("td");
    tdCell.appendChild(makeMarkInput(mod.id, "td", state));

    const examCell = document.createElement("td");
    examCell.appendChild(makeMarkInput(mod.id, "exam", state));

    const computedCell = document.createElement("td");
    const computed = document.createElement("span");
    computed.className = "computed missing";
    computed.textContent = "—";
    computedCell.appendChild(computed);

    const moduleCell = document.createElement("td");
    moduleCell.appendChild(title);
    moduleCell.appendChild(sub);

    const coefCell = document.createElement("td");
    const coefPill = document.createElement("span");
    coefPill.className = "coef-pill";
    coefPill.textContent = String(mod.coef);
    coefCell.appendChild(coefPill);

    row.appendChild(moduleCell);
    row.appendChild(coefCell);
    row.appendChild(tdCell);
    row.appendChild(examCell);
    row.appendChild(computedCell);

    tbody.appendChild(row);
  }
}

function makeMarkInput(moduleId, kind, state) {
  const wrapper = document.createElement("div");
  wrapper.className = "cell-input";

  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.placeholder = "—";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.dataset.moduleId = moduleId;
  input.dataset.kind = kind;
  input.value = state.marks?.[moduleId]?.[kind] ?? "";

  input.addEventListener("input", () => {
    const s = getState();
    s.marks = s.marks || {};
    s.marks[moduleId] = s.marks[moduleId] || {};
    s.marks[moduleId][kind] = input.value;
    setState(s);
    recomputeAndRender();
  });

  wrapper.appendChild(input);
  return wrapper;
}

function recomputeAndRender() {
  const state = getState();
  const tdWeight = DEFAULT_TD_WEIGHT;
  const scale = DEFAULT_SCALE;

  let sum = 0;
  let coefCounted = 0;
  let modulesCounted = 0;

  for (const mod of MODULES) {
    const row = document.querySelector(`tr[data-module-id="${mod.id}"]`);
    const computedEl = row?.querySelector(".computed");
    if (!computedEl) continue;

    const td = parseMaybeNumber(state.marks?.[mod.id]?.td);
    const exam = parseMaybeNumber(state.marks?.[mod.id]?.exam);

    const result = computeModuleMark({ td, exam }, tdWeight, scale);
    const mark = result.mark;

    if (mark == null) {
      computedEl.textContent = "—";
      computedEl.classList.add("missing");
      computedEl.classList.remove("bad");
    } else {
      const shown = round2(mark);
      computedEl.textContent = `${shown} / ${scale}`;
      computedEl.classList.remove("missing");

      computedEl.classList.toggle("bad", !withinScale(mark, scale));
    }

    if (withinScale(mark, scale)) {
      sum += mark * mod.coef;
      coefCounted += mod.coef;
      modulesCounted += 1;
    }
  }

  $("coefCounted").textContent = String(coefCounted);

  if (coefCounted === 0) {
    $("avgValue").textContent = "—";
    $("avgMeta").textContent = "Fill at least one module.";
  } else {
    const avg = sum / coefCounted;
    $("avgValue").textContent = `${round2(avg)} / ${scale}`;
    $("avgMeta").textContent = `Calculated from ${modulesCounted} module(s).`;
  }
}

function wireSettings() {
  const resetBtn = $("btnReset");

  resetBtn.addEventListener("click", () => {
    if (!confirm("Reset all marks and settings?")) return;
    localStorage.removeItem(STORAGE_KEY);
    const s = getState();
    renderModulesTable(s);
    recomputeAndRender();
  });
}

function init() {
  const state = getState();
  renderModulesTable(state);
  wireSettings();
  recomputeAndRender();
}

init();


