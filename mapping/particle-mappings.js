import {
  normalizeParticlePayload,
  particleMode,
  updateParticleEntry,
} from "./particle-model.mjs?v=4";

const rowsElement = document.querySelector("#particle-mapping-rows");
const statusElement = document.querySelector("#particle-mapping-status");
const tableShell = document.querySelector(".particle-table-shell");

let payload;
let baselinePayload;
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
    sequence.append(element(
      particleIndices.has(tokenIndex) ? "mark" : "span",
      "pattern-token",
      token,
    ));
  });
  const actions = element("div", "particle-row-actions");
  const mode = particleMode(baselinePayload.mappings[index], row);
  const badge = element("span", `mode-badge ${mode}`, mode);
  const edit = element("button", "button-like particle-edit-button", "Edit mapping");
  edit.type = "button";
  edit.dataset.action = "edit-particle";
  edit.dataset.index = String(index);
  edit.setAttribute("aria-expanded", String(editingIndex === index));
  edit.setAttribute("aria-label", `Edit particle mapping ${row.pattern}`);
  if (editingIndex === index) edit.setAttribute("aria-controls", `particle-editor-${index}`);
  actions.append(badge, edit);
  cell.append(sequence, actions);
  return cell;
}

function renderSourceChip(sourceId) {
  const source = sources.get(sourceId);
  const chip = element("span", "particle-chip zvvnmod-particle-chip");
  if (!source) {
    chip.classList.add("invalid");
    chip.textContent = sourceId;
    return chip;
  }
  chip.title = `${source.id} · ${source.name} · ${source.codepoint}`;
  const glyph = element("span", "particle-glyph zvvnmod-font", source.glyph);
  glyph.setAttribute("aria-hidden", "true");
  chip.append(
    glyph,
    element("span", "particle-chip-name", source.id),
    element("span", "particle-chip-code", source.codepoint),
  );
  return chip;
}

function renderTargetChip(targetId) {
  const target = targets.get(targetId);
  const chip = element("span", "particle-chip utn57-particle-chip");
  if (!target) {
    chip.classList.add("invalid");
    chip.textContent = targetId;
    return chip;
  }
  chip.title = `${target.unit} · ${target.position} · ${target.id}`;
  const glyph = element("span", "particle-glyph utn-font", target.glyph);
  glyph.setAttribute("aria-hidden", "true");
  chip.append(glyph, element("span", "particle-chip-name", target.id));
  return chip;
}

function renderSequenceCell(row, side) {
  const cell = document.createElement("td");
  const isSource = side === "source";
  const values = isSource ? row.sources : row.targets;
  const sequence = element("div", `particle-sequence ${isSource ? "zvvnmod" : "utn57"}-particle-sequence`);
  sequence.setAttribute(
    "aria-label",
    `${isSource ? "ZVVNMOD" : "UTN57"} ordered sequence for ${row.pattern}`,
  );
  if (!values.length) {
    sequence.append(element("span", "blank-particle-chip", "Blank sequence"));
  } else {
    values.forEach((value, index) => {
      const item = element("span", "particle-aligned-slot");
      item.append(
        element("span", "particle-slot-number", String(index + 1)),
        isSource ? renderSourceChip(value) : renderTargetChip(value),
      );
      sequence.append(item);
    });
  }
  cell.append(sequence);
  return cell;
}

function sourceOptionList(selectedValue = "") {
  const select = element("select", "source-select");
  for (const source of catalogue.sources) {
    const option = document.createElement("option");
    option.value = source.id;
    option.textContent = `${source.id} · ${source.name} · ${source.codepoint}`;
    option.selected = source.id === selectedValue;
    select.append(option);
  }
  return select;
}

function targetOptionList(selectedValue = "") {
  const select = element("select", "target-select");
  for (const target of catalogue.targets) {
    const option = document.createElement("option");
    option.value = target.id;
    option.textContent = `${target.unit} · ${target.position}`;
    option.selected = target.id === selectedValue;
    select.append(option);
  }
  return select;
}

function iconButton(label, action, side, position, disabled, ariaLabel) {
  const button = element("button", "icon-action", label);
  button.type = "button";
  button.dataset.action = action;
  button.dataset.side = side;
  button.dataset.position = String(position);
  button.disabled = disabled;
  button.setAttribute("aria-label", ariaLabel);
  return button;
}

function sequenceEditor(side, index) {
  const isSource = side === "source";
  const values = draft[`${side}s`];
  const noun = isSource ? "ZVVNMOD source" : "UTN57 target";
  const section = element("section", `sequence-editor ${side}-sequence-editor`);
  section.append(element("h3", "", `${noun} sequence`));
  const list = element("div", "sequence-editor-list");
  if (!values.length) list.append(element("p", `mapping-empty-${side}`, `Blank — add a ${noun} below.`));
  values.forEach((value, position) => {
    const itemRow = element("div", "sequence-editor-row");
    const select = isSource ? sourceOptionList(value) : targetOptionList(value);
    select.dataset.action = "change-particle-sequence";
    select.dataset.side = side;
    select.dataset.position = String(position);
    select.setAttribute("aria-label", `${noun} ${position + 1}`);
    itemRow.append(
      element("span", "target-order", String(position + 1)),
      select,
      iconButton("↑", "move-particle-up", side, position, position === 0, `Move ${noun} ${position + 1} up`),
      iconButton("↓", "move-particle-down", side, position, position === values.length - 1, `Move ${noun} ${position + 1} down`),
      iconButton("Remove", "remove-particle-value", side, position, false, `Remove ${noun} ${position + 1}`),
    );
    list.append(itemRow);
  });
  section.append(list);

  const addRow = element("div", "sequence-add-row");
  const firstId = isSource ? catalogue.sources[0]?.id : catalogue.targets[0]?.id;
  const addSelect = isSource ? sourceOptionList(firstId) : targetOptionList(firstId);
  addSelect.dataset.role = `add-particle-${side}-select`;
  addSelect.setAttribute("aria-label", `${noun} to add`);
  const addButton = element("button", "button-like", `Add ${side}`);
  addButton.type = "button";
  addButton.dataset.action = "add-particle-value";
  addButton.dataset.side = side;
  addButton.dataset.index = String(index);
  addRow.append(addSelect, addButton);
  section.append(addRow);
  return section;
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
    element("h3", "", `Edit mapping for “${row.pattern}”`),
    element("p", "particle-editor-help", "Both ordered sequences are independent. Add, remove, or reorder either side; their lengths may differ."),
  );
  const grid = element("div", "mapping-editor-grid");
  grid.append(sequenceEditor("source", index), sequenceEditor("target", index));
  panel.append(grid);

  const noteLabel = element("label", "mapping-note-label", "Particle mapping note");
  const note = document.createElement("input");
  note.type = "text";
  note.value = draft.note;
  note.placeholder = "Why was this mapping changed?";
  note.dataset.action = "edit-particle-note";
  noteLabel.append(note);
  panel.append(noteLabel);

  const actions = element("div", "mapping-editor-actions");
  for (const [label, action, className] of [
    ["Save particle mapping", "save-particle", "primary-action"],
    ["Restore Git baseline", "restore-particle", "button-like"],
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
  if (!payload || !baselinePayload || !catalogue) return;
  const fragment = document.createDocumentFragment();
  const counts = { direct: 0, special: 0, unmapped: 0 };
  for (const [index, row] of payload.mappings.entries()) {
    const mode = particleMode(baselinePayload.mappings[index], row);
    counts[mode] += 1;
    const tableRow = document.createElement("tr");
    tableRow.className = `particle-mapping-row mode-${mode}`;
    tableRow.dataset.index = String(index);
    tableRow.append(
      renderPattern(row, index),
      renderSequenceCell(row, "source"),
      renderSequenceCell(row, "target"),
    );
    fragment.append(tableRow);
    if (editingIndex === index) fragment.append(renderEditor(row, index));
  }
  rowsElement.replaceChildren(fragment);
  statusElement.classList.remove("error");
  statusElement.textContent =
    `${payload.mappings.length} Mongfontbuilder patterns · ${counts.direct} direct · `
    + `${counts.special} edited · ${counts.unmapped} unresolved · independent sequence lengths`;
  tableShell.setAttribute("aria-busy", "false");
  tableShell.inert = busy || mainDraftOpen;
}

function publishDraftState(open) {
  window.dispatchEvent(new CustomEvent("particle-mapping-draft-state", { detail: { open } }));
}

function focusDraftSequence(side, position = 0) {
  const controls = rowsElement.querySelectorAll(
    `.particle-editor-row [data-action="change-particle-sequence"][data-side="${side}"]`,
  );
  const control = controls[position]
    || rowsElement.querySelector(`[data-role="add-particle-${side}-select"]`)
    || rowsElement.querySelector('.particle-editor-row [data-action="save-particle"]');
  control?.focus();
}

function focusDraft() {
  focusDraftSequence("source");
}

function beginEdit(index) {
  if (busy || mainDraftOpen || editingIndex !== -1) return;
  editingIndex = index;
  const row = payload.mappings[index];
  draft = { sources: [...row.sources], targets: [...row.targets], note: row.note || "" };
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
  if (focus) rowsElement.querySelector(`[data-action="edit-particle"][data-index="${index}"]`)?.focus();
}

function commitParticleEntry(index, entry) {
  const candidate = structuredClone(payload);
  candidate.mappings[index] = entry;
  payload = normalizeParticlePayload(candidate, {
    sourceIds: new Set(sources.keys()),
    targetIds: new Set(targets.keys()),
  });
}

function publishUpdate(message) {
  window.dispatchEvent(new CustomEvent("particle-mapping-updated", {
    detail: { payload: structuredClone(payload) },
  }));
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
    if (!draft.sources.length && !draft.targets.length) {
      statusElement.classList.add("error");
      statusElement.textContent = "A particle mapping cannot have both sequences blank.";
      focusDraft();
      return;
    }
    const saved = updateParticleEntry(
      payload.mappings[index], draft.sources, draft.targets, draft.note,
    );
    commitParticleEntry(index, saved);
    closeEditor();
    publishUpdate(`Saved particle mapping ${payload.mappings[index].pattern}. Download the runtime CSV to keep it.`);
    return;
  }
  if (action === "restore-particle") {
    const row = payload.mappings[index];
    const baseline = baselinePayload.mappings[index];
    const restored = updateParticleEntry(row, baseline.sources, baseline.targets, baseline.note);
    commitParticleEntry(index, restored);
    closeEditor();
    publishUpdate(`Restored Git baseline particle mapping ${row.pattern}.`);
    return;
  }

  const side = button.dataset.side;
  if (!side || !draft) return;
  const values = draft[`${side}s`];
  if (action === "add-particle-value") {
    const select = rowsElement.querySelector(`[data-role="add-particle-${side}-select"]`);
    values.push(select.value);
    render();
    focusDraftSequence(side, values.length - 1);
    return;
  }
  const position = Number(button.dataset.position);
  if (action === "remove-particle-value") {
    values.splice(position, 1);
    render();
    focusDraftSequence(side, Math.min(position, values.length - 1));
    return;
  }
  const next = action === "move-particle-up" ? position - 1 : position + 1;
  if (next < 0 || next >= values.length) return;
  [values[position], values[next]] = [values[next], values[position]];
  render();
  focusDraftSequence(side, next);
});

rowsElement.addEventListener("change", (event) => {
  if (tableShell.inert || event.target.dataset.action !== "change-particle-sequence") return;
  draft[`${event.target.dataset.side}s`][Number(event.target.dataset.position)] = event.target.value;
});

rowsElement.addEventListener("input", (event) => {
  if (tableShell.inert || event.target.dataset.action !== "edit-particle-note") return;
  draft.note = event.target.value;
});

window.addEventListener("particle-mapping-payload", (event) => {
  catalogue = event.detail.catalogue;
  sources = new Map(catalogue.sources.map((source) => [source.id, source]));
  targets = new Map(catalogue.targets.map((target) => [target.id, target]));
  const catalogues = { sourceIds: new Set(sources.keys()), targetIds: new Set(targets.keys()) };
  baselinePayload = normalizeParticlePayload(event.detail.baseline, catalogues);
  payload = normalizeParticlePayload(event.detail.payload, catalogues);
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
  const cell = element("td", "particle-load-error", "Particle mappings are unavailable. Reload the Git CSV baseline to retry.");
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
