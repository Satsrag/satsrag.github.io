import {
  normalizeParticlePayload,
  updateParticleEntry,
} from "./particle-model.mjs?v=2";

const rowsElement = document.querySelector("#particle-mapping-rows");
const statusElement = document.querySelector("#particle-mapping-status");
const tableShell = document.querySelector(".particle-table-shell");

let payload;
let catalogue;
let sources = new Map();
let targets = new Map();
let editingIndex = -1;
let draft = null;
let busy = true;
let mainDraftOpen = false;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderPattern(row, index) {
  const cell = document.createElement("td");
  const sequence = element("div", "particle-pattern");
  const particleIndices = new Set(row.particleIndices);
  row.pattern.split(" ").forEach((token, tokenIndex) => {
    const tokenElement = element(
      particleIndices.has(tokenIndex) ? "mark" : "span",
      "pattern-token",
      token,
    );
    tokenElement.title = row.nominalCodePoints[tokenIndex];
    sequence.append(tokenElement);
  });
  const codePoints = element("div", "particle-codepoints", row.nominalCodePoints.join(" "));
  const actions = element("div", "particle-row-actions");
  const badge = element("span", `mode-badge ${row.mode}`, row.mode);
  const edit = element("button", "button-like particle-edit-button", "Edit mapping");
  edit.type = "button";
  edit.dataset.action = "edit-particle";
  edit.dataset.index = String(index);
  edit.setAttribute("aria-expanded", String(editingIndex === index));
  edit.setAttribute("aria-label", `Edit particle mapping ${row.pattern}`);
  if (editingIndex === index) edit.setAttribute("aria-controls", `particle-editor-${index}`);
  actions.append(badge, edit);
  cell.append(sequence, codePoints, actions);
  return cell;
}

function renderZvvnmodChip(codeId, shapeId) {
  if (codeId === null) {
    const chip = element("span", "particle-chip blank-particle-chip");
    chip.setAttribute("aria-label", `Blank ZVVNMOD slot for ${shapeId}`);
    chip.append(
      element("span", "particle-blank-glyph", "Blank"),
      element("span", "particle-chip-code", `for ${shapeId}`),
    );
    return chip;
  }
  const source = sources.get(codeId);
  const chip = element("span", "particle-chip zvvnmod-particle-chip");
  chip.title = `${source.name} · ${source.const} · ${source.id}`;
  const glyph = element("span", "particle-glyph zvvnmod-font", source.glyph);
  glyph.setAttribute("aria-hidden", "true");
  chip.append(
    glyph,
    element("span", "particle-chip-name", source.const),
    element("span", "particle-chip-code", source.id),
  );
  return chip;
}

function renderUtn57Chip(shapeId) {
  const chip = element("span", "particle-chip utn57-particle-chip");
  if (shapeId === "MVS") {
    chip.classList.add("structural-chip");
    chip.title = "Mongolian Vowel Separator · U+180E";
    chip.append(
      element("span", "particle-structural-glyph", "MVS"),
      element("span", "particle-chip-code", "U+180E"),
    );
    return chip;
  }
  const target = targets.get(shapeId);
  chip.title = `${target.unit} · ${target.position} · ${target.id}`;
  const glyph = element("span", "particle-glyph utn-font", target.glyph);
  glyph.setAttribute("aria-hidden", "true");
  chip.append(
    glyph,
    element("span", "particle-chip-name", target.id),
  );
  return chip;
}

function renderZvvnmodCell(row) {
  const cell = document.createElement("td");
  const sequence = element("div", "particle-sequence zvvnmod-particle-sequence");
  sequence.setAttribute("aria-label", `ZVVNMOD slots aligned to UTN57 shapes for ${row.pattern}`);
  row.zvvnmodCodes.forEach((codeId, index) => {
    const slot = element("span", "particle-aligned-slot");
    slot.append(
      element("span", "particle-slot-number", String(index + 1)),
      renderZvvnmodChip(codeId, row.utn57Shapes[index]),
    );
    sequence.append(slot);
  });
  cell.append(sequence);
  return cell;
}

function renderUtn57Cell(row) {
  const cell = document.createElement("td");
  const sequence = element("div", "particle-sequence utn57-particle-sequence");
  sequence.setAttribute("aria-label", `UTN57 shape sequence for ${row.pattern}`);
  row.utn57Shapes.forEach((shapeId, index) => {
    const slot = element("span", "particle-aligned-slot");
    slot.append(
      element("span", "particle-slot-number", String(index + 1)),
      renderUtn57Chip(shapeId),
    );
    sequence.append(slot);
  });
  cell.append(sequence);
  return cell;
}

function sourceSelect(selected, position, shapeId) {
  const select = element("select", "source-select particle-slot-select");
  select.dataset.action = "change-particle-slot";
  select.dataset.position = String(position);
  select.setAttribute("aria-label", `ZVVNMOD slot ${position + 1} for ${shapeId}`);
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = `Blank — no known counterpart for ${shapeId}`;
  blank.selected = selected === null;
  select.append(blank);
  for (const source of catalogue.sources) {
    const option = document.createElement("option");
    option.value = source.id;
    option.textContent = `${source.const} · ${source.name} · ${source.id}`;
    option.selected = selected === source.id;
    select.append(option);
  }
  return select;
}

function renderEditor(row, index) {
  const editorRow = document.createElement("tr");
  editorRow.className = "particle-editor-row";
  const cell = document.createElement("td");
  cell.colSpan = 3;
  const panel = element("section", "particle-editor mapping-editor");
  panel.id = `particle-editor-${index}`;
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", `Edit particle mapping ${row.pattern}`);
  panel.append(
    element("h3", "", `Edit ZVVNMOD slots for “${row.pattern}”`),
    element(
      "p",
      "particle-editor-help",
      "Each numbered ZVVNMOD slot corresponds to the UTN57 shape with the same number. Leave an unknown counterpart blank.",
    ),
  );
  const list = element("div", "particle-slot-editor-list");
  row.utn57Shapes.forEach((shapeId, position) => {
    const slotRow = element("div", "particle-slot-editor-row");
    slotRow.append(
      element("span", "target-order", String(position + 1)),
      renderUtn57Chip(shapeId),
      element("span", "particle-slot-arrow", "→"),
      sourceSelect(draft.slots[position], position, shapeId),
    );
    list.append(slotRow);
  });
  panel.append(list);

  const noteLabel = element("label", "mapping-note-label", "Particle mapping note");
  const note = document.createElement("input");
  note.type = "text";
  note.value = draft.note;
  note.placeholder = "Why was this semantic correspondence changed?";
  note.dataset.action = "edit-particle-note";
  noteLabel.append(note);
  panel.append(noteLabel);

  const actions = element("div", "mapping-editor-actions");
  for (const [label, action, className] of [
    ["Save particle mapping", "save-particle", "primary-action"],
    ["Restore generated", "restore-particle", "button-like"],
    ["Cancel", "cancel-particle", "button-like"],
  ]) {
    const button = element("button", className, label);
    button.type = "button";
    button.dataset.action = action;
    button.dataset.index = String(index);
    actions.append(button);
  }
  panel.append(actions);
  cell.append(panel);
  editorRow.append(cell);
  return editorRow;
}

function render() {
  if (!payload || !catalogue) return;
  const fragment = document.createDocumentFragment();
  for (const [index, row] of payload.mappings.entries()) {
    const tableRow = document.createElement("tr");
    tableRow.className = `particle-mapping-row mode-${row.mode}`;
    tableRow.dataset.index = String(index);
    tableRow.append(
      renderPattern(row, index),
      renderZvvnmodCell(row),
      renderUtn57Cell(row),
    );
    fragment.append(tableRow);
    if (editingIndex === index) fragment.append(renderEditor(row, index));
  }
  rowsElement.replaceChildren(fragment);
  const counts = { direct: 0, special: 0, unmapped: 0 };
  let blanks = 0;
  for (const row of payload.mappings) {
    counts[row.mode] += 1;
    blanks += row.zvvnmodCodes.filter((code) => code === null).length;
  }
  statusElement.classList.remove("error");
  statusElement.textContent =
    `${payload.mappings.length} Mongfontbuilder patterns · ${counts.direct} direct · `
    + `${counts.special} edited · ${counts.unmapped} generated unresolved · ${blanks} blank slots`;
  tableShell.setAttribute("aria-busy", "false");
  tableShell.inert = busy || mainDraftOpen;
}

function publishDraftState(open) {
  window.dispatchEvent(new CustomEvent("particle-mapping-draft-state", { detail: { open } }));
}

function focusDraft() {
  const control = rowsElement.querySelector(
    `.particle-editor-row [data-action="change-particle-slot"], .particle-editor-row [data-action="save-particle"]`,
  );
  control?.focus();
}

function beginEdit(index) {
  if (busy || mainDraftOpen || editingIndex !== -1) return;
  editingIndex = index;
  const row = payload.mappings[index];
  draft = { slots: [...row.zvvnmodCodes], note: row.note || "" };
  publishDraftState(true);
  render();
  focusDraft();
}

function closeEditor({ focus = true } = {}) {
  const index = editingIndex;
  editingIndex = -1;
  draft = null;
  publishDraftState(false);
  render();
  if (focus) {
    rowsElement.querySelector(`[data-action="edit-particle"][data-index="${index}"]`)?.focus();
  }
}

function commitParticleEntry(index, entry) {
  const candidate = structuredClone(payload);
  candidate.mappings[index] = entry;
  payload = normalizeParticlePayload(candidate, {
    sourceIds: new Set(sources.keys()),
    targetIds: new Set(["MVS", ...targets.keys()]),
  });
}

function publishUpdate(message) {
  window.dispatchEvent(
    new CustomEvent("particle-mapping-updated", {
      detail: { payload: structuredClone(payload) },
    }),
  );
  statusElement.textContent = message;
}

rowsElement.addEventListener("click", (event) => {
  if (tableShell.inert) return;
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const index = Number(button.dataset.index ?? editingIndex);
  if (action === "edit-particle") return beginEdit(index);
  if (action === "cancel-particle") return closeEditor();
  if (action === "save-particle") {
    const saved = updateParticleEntry(payload.mappings[index], draft.slots, draft.note);
    commitParticleEntry(index, saved);
    closeEditor();
    publishUpdate(`Saved particle mapping ${payload.mappings[index].pattern}. Download the combined JSON to keep it.`);
    return;
  }
  if (action === "restore-particle") {
    const row = payload.mappings[index];
    const restored = updateParticleEntry(row, row.defaultZvvnmodCodes, "");
    commitParticleEntry(index, restored);
    closeEditor();
    publishUpdate(`Restored generated particle mapping ${row.pattern}.`);
  }
});

rowsElement.addEventListener("change", (event) => {
  if (tableShell.inert || event.target.dataset.action !== "change-particle-slot") return;
  draft.slots[Number(event.target.dataset.position)] = event.target.value || null;
});

rowsElement.addEventListener("input", (event) => {
  if (tableShell.inert || event.target.dataset.action !== "edit-particle-note") return;
  draft.note = event.target.value;
});

window.addEventListener("particle-mapping-payload", (event) => {
  catalogue = event.detail.catalogue;
  sources = new Map(catalogue.sources.map((source) => [source.id, source]));
  targets = new Map(catalogue.targets.map((target) => [target.id, target]));
  payload = normalizeParticlePayload(event.detail.payload, {
    sourceIds: new Set(sources.keys()),
    targetIds: new Set(["MVS", ...targets.keys()]),
  });
  editingIndex = -1;
  draft = null;
  publishDraftState(false);
  busy = false;
  render();
});

window.addEventListener("particle-mapping-unavailable", (event) => {
  busy = true;
  statusElement.classList.add("error");
  statusElement.textContent = `Could not load particle mappings: ${event.detail.message}`;
  const row = document.createElement("tr");
  const cell = element("td", "particle-load-error", "Particle mappings are unavailable. Reload source JSON files to retry.");
  cell.colSpan = 3;
  row.append(cell);
  rowsElement.replaceChildren(row);
  tableShell.inert = true;
  tableShell.setAttribute("aria-busy", "false");
});

window.addEventListener("combined-workbench-busy", (event) => {
  busy = Boolean(event.detail.busy);
  tableShell.inert = busy || mainDraftOpen;
  tableShell.setAttribute("aria-busy", String(busy));
});

window.addEventListener("main-mapping-draft-state", (event) => {
  mainDraftOpen = Boolean(event.detail.open);
  tableShell.inert = busy || mainDraftOpen;
});

window.addEventListener("particle-mapping-focus-draft", focusDraft);
window.dispatchEvent(new CustomEvent("particle-mapping-request-payload"));
