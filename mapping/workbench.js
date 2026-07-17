import {
  hasSameGeneratedScaffold,
  normalizeMappingPayload,
  serializeMappingPayload,
  updateMappingEntry,
} from "./workbench-model.mjs";

const DATA_URL = "data/zvvnmod-utn57-map.json";
const DOWNLOAD_NAME = "zvvnmod-utn57-map.json";

const rowsElement = document.getElementById("mapping-rows");
const shellElement = document.getElementById("mapping-shell");
const summaryElement = document.getElementById("mapping-summary");
const messageElement = document.getElementById("mapping-message");
const searchElement = document.getElementById("mapping-search");
const modeElement = document.getElementById("mapping-mode-filter");
const importElement = document.getElementById("import-mapping");
const importTriggerElement = document.getElementById("import-mapping-trigger");
const downloadElement = document.getElementById("download-mapping");
const resetElement = document.getElementById("reset-mapping");

let sourcePayload;
let payload;
let targetById = new Map();
let editingIndex = -1;
let draft = null;
let operationInProgress = false;

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function targetLabel(target) {
  return `${target.unit} · ${target.position}`;
}

function refreshTargetIndex() {
  targetById = new Map(payload.targets.map((target) => [target.id, target]));
}

function mappingSearchText(entry) {
  const targetText = entry.targets
    .map((targetId) => {
      const target = targetById.get(targetId);
      return target ? `${target.id} ${target.unit} ${target.position}` : targetId;
    })
    .join(" ");
  return `${entry.source.join(" ")} ${entry.sourceName || ""} ${entry.sourceConst || ""} ${targetText} ${entry.note || ""}`.toLowerCase();
}

function sourceCard(entry) {
  const card = make("div", "mapping-source-card");
  const glyph = make("span", "mapping-source-glyph");
  glyph.setAttribute("aria-hidden", "true");
  if (Number.isInteger(entry.sourceValue)) glyph.textContent = String.fromCodePoint(entry.sourceValue);
  card.append(glyph);

  const meta = make("span", "mapping-source-meta");
  meta.append(
    make("strong", "mapping-source-name", entry.sourceName || entry.source.join(" + ")),
    make("span", "mapping-source-code", entry.source.join(" + ")),
    make("span", "mapping-source-const", entry.sourceConst || "sequence"),
  );
  card.append(meta);
  return card;
}

function targetCard(targetId, compact = false) {
  const target = targetById.get(targetId);
  const card = make("span", compact ? "mapping-target-card compact" : "mapping-target-card");
  if (!target) {
    card.classList.add("invalid");
    card.textContent = targetId;
    return card;
  }

  const glyph = make("span", "mapping-target-glyph", target.glyph || "");
  glyph.setAttribute("aria-hidden", "true");
  const meta = make("span", "mapping-target-meta");
  meta.append(
    make("strong", "mapping-target-id", targetLabel(target)),
    make("span", "mapping-target-key", target.id),
  );
  card.append(glyph, meta);
  return card;
}

function targetSequence(entry) {
  const cell = make("div", "mapping-target-sequence");
  if (!entry.targets.length) {
    cell.append(make("span", "mapping-empty-target", "No UTN57 target assigned"));
    return cell;
  }
  entry.targets.forEach((targetId, index) => {
    if (index) cell.append(make("span", "sequence-plus", "+"));
    cell.append(targetCard(targetId));
  });
  return cell;
}

function optionList(selectedValue = "") {
  const select = make("select", "target-select");
  payload.targets.forEach((target) => {
    const option = document.createElement("option");
    option.value = target.id;
    option.textContent = targetLabel(target);
    option.selected = target.id === selectedValue;
    select.append(option);
  });
  return select;
}

function iconButton(label, action, position, disabled = false, ariaLabel = "") {
  const button = make("button", "icon-action", label);
  button.type = "button";
  button.dataset.action = action;
  button.dataset.position = String(position);
  button.disabled = disabled;
  if (ariaLabel) button.setAttribute("aria-label", ariaLabel);
  return button;
}

function editor(entry, index) {
  const panel = make("div", "mapping-editor");
  panel.dataset.index = String(index);

  const heading = make("div", "mapping-editor-heading");
  heading.append(
    make("strong", "", `Edit ${entry.sourceName || entry.source.join(" + ")}`),
    make("span", "", "Target order is significant."),
  );
  panel.append(heading);

  const list = make("div", "target-editor-list");
  if (!draft.targets.length) list.append(make("p", "mapping-empty-target", "No targets. Add one below."));
  draft.targets.forEach((targetId, position) => {
    const row = make("div", "target-editor-row");
    const select = optionList(targetId);
    select.dataset.action = "change-target";
    select.dataset.position = String(position);
    row.append(
      make("span", "target-order", String(position + 1)),
      select,
      iconButton("↑", "move-up", position, position === 0, `Move target ${position + 1} up`),
      iconButton("↓", "move-down", position, position === draft.targets.length - 1, `Move target ${position + 1} down`),
      iconButton("Remove", "remove-target", position),
    );
    list.append(row);
  });
  panel.append(list);

  const addRow = make("div", "target-add-row");
  const addSelect = optionList(payload.targets[0]?.id || "");
  addSelect.id = `add-target-${index}`;
  addSelect.dataset.role = "add-target-select";
  const addButton = make("button", "button-like", "Add target");
  addButton.type = "button";
  addButton.dataset.action = "add-target";
  addRow.append(addSelect, addButton);
  panel.append(addRow);

  const noteLabel = make("label", "mapping-note-label", "Mapping note");
  const note = document.createElement("input");
  note.type = "text";
  note.value = draft.note;
  note.placeholder = "Why is this mapping special?";
  note.dataset.action = "edit-note";
  noteLabel.append(note);
  panel.append(noteLabel);

  const actions = make("div", "mapping-editor-actions");
  for (const [label, action, className] of [
    ["Save mapping", "save-entry", "primary-action"],
    ["Restore generated", "restore-entry", "button-like"],
    ["Cancel", "cancel-entry", "button-like"],
  ]) {
    const button = make("button", className, label);
    button.type = "button";
    button.dataset.action = action;
    actions.append(button);
  }
  panel.append(actions);
  return panel;
}

function row(entry, index) {
  const item = make("article", `mapping-row mode-${entry.mode}`);
  item.dataset.index = String(index);
  item.dataset.mode = entry.mode;
  item.dataset.search = mappingSearchText(entry);

  item.append(sourceCard(entry));

  const connector = make("button", "mapping-connector");
  connector.type = "button";
  connector.dataset.action = "edit-entry";
  connector.setAttribute("aria-expanded", String(editingIndex === index));
  connector.setAttribute("aria-label", `Edit mapping for ${entry.sourceName || entry.source.join(" + ")}`);
  connector.append(
    make("span", "connector-line"),
    make("span", `mode-badge ${entry.mode}`, entry.mode === "special" ? "special" : entry.mode),
    make("span", "edit-label", "Edit"),
  );
  item.append(connector, targetSequence(entry));

  if (editingIndex === index) item.append(editor(entry, index));
  return item;
}

function render() {
  refreshTargetIndex();
  const query = searchElement.value.trim().toLowerCase();
  const requestedMode = modeElement.value;
  const fragment = document.createDocumentFragment();
  const counts = { direct: 0, special: 0, unmapped: 0 };
  let visible = 0;

  payload.mappings.forEach((entry, index) => {
    counts[entry.mode] += 1;
    const matchesQuery = !query || mappingSearchText(entry).includes(query);
    const matchesMode = requestedMode === "all" || entry.mode === requestedMode;
    if (!matchesQuery || !matchesMode) return;
    fragment.append(row(entry, index));
    visible += 1;
  });

  rowsElement.replaceChildren(fragment);
  summaryElement.replaceChildren(
    make("span", "summary-count", `${visible} shown`),
    make("span", "summary-count", `${payload.targets.length} UTN targets · ${targetLabel(payload.targets[0])} first`),
    make("span", "summary-count direct", `${counts.direct} direct`),
    make("span", "summary-count special", `${counts.special} special`),
    make("span", "summary-count unmapped", `${counts.unmapped} unmapped`),
  );
}

function focusDraftTarget(index, position = 0) {
  const item = rowsElement.querySelector(`.mapping-row[data-index="${index}"]`);
  const targets = item?.querySelectorAll("[data-action='change-target']");
  const target = targets?.[position]
    || item?.querySelector("[data-role='add-target-select']")
    || item?.querySelector("[data-action='save-entry']");
  target?.focus();
}

function focusEditButton(index) {
  const editButton = rowsElement.querySelector(
    `.mapping-row[data-index="${index}"] [data-action='edit-entry']`,
  );
  (editButton || searchElement).focus();
}

function guardActiveDraft(action) {
  if (editingIndex === -1) return false;
  setMessage(`Save or cancel the open mapping before ${action}.`, true);
  focusDraftTarget(editingIndex);
  return true;
}

function beginEdit(index) {
  if (guardActiveDraft("opening another mapping")) return;
  editingIndex = index;
  const entry = payload.mappings[index];
  draft = { targets: [...entry.targets], note: entry.note || "" };
  render();
  setDraftSensitiveControlsEnabled(false);
  focusDraftTarget(index);
}

function closeEditor() {
  const closedIndex = editingIndex;
  editingIndex = -1;
  draft = null;
  render();
  setDraftSensitiveControlsEnabled(true);
  focusEditButton(closedIndex);
}

function setMessage(message, isError = false) {
  messageElement.textContent = message;
  messageElement.classList.toggle("error", isError);
}

function setDraftSensitiveControlsEnabled(enabled) {
  downloadElement.disabled = !enabled;
  importTriggerElement.disabled = !enabled;
  resetElement.disabled = !enabled;
  searchElement.disabled = !enabled;
  modeElement.disabled = !enabled;
  importElement.disabled = !enabled;
}

function setWorkbenchControlsEnabled(enabled) {
  setDraftSensitiveControlsEnabled(enabled);
  shellElement.inert = !enabled;
}

function beginOperation() {
  if (operationInProgress) return false;
  operationInProgress = true;
  setWorkbenchControlsEnabled(false);
  shellElement.setAttribute("aria-busy", "true");
  return true;
}

function finishOperation() {
  operationInProgress = false;
  const hasSource = Boolean(sourcePayload);
  setWorkbenchControlsEnabled(hasSource);
  if (!hasSource) resetElement.disabled = false;
  shellElement.setAttribute("aria-busy", "false");
}

async function loadSourceMapping() {
  if (guardActiveDraft("reloading source JSON")) return;
  if (!beginOperation()) return;
  try {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Mapping JSON could not be loaded (${response.status}).`);
    const loaded = normalizeMappingPayload(await response.json());
    sourcePayload = structuredClone(loaded);
    payload = loaded;
    editingIndex = -1;
    draft = null;
    render();
    setMessage("Source JSON loaded. Edits stay in this browser tab until you download the JSON.");
  } finally {
    finishOperation();
  }
}

rowsElement.addEventListener("click", (event) => {
  if (shellElement.inert) return;
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const item = button.closest(".mapping-row");
  const index = Number(item?.dataset.index);
  const action = button.dataset.action;

  if (action === "edit-entry") return beginEdit(index);
  if (action === "cancel-entry") return closeEditor();
  if (action === "save-entry") {
    payload.mappings[index] = updateMappingEntry(payload.mappings[index], draft.targets, draft.note);
    setMessage(`Saved ${payload.mappings[index].sourceName} as ${payload.mappings[index].mode}. Download JSON to keep this edit.`);
    return closeEditor();
  }
  if (action === "restore-entry") {
    const entry = payload.mappings[index];
    payload.mappings[index] = updateMappingEntry(entry, entry.defaultTargets, "");
    setMessage(`Restored generated targets for ${entry.sourceName}.`);
    return closeEditor();
  }
  if (action === "add-target") {
    const select = item.querySelector("[data-role='add-target-select']");
    draft.targets.push(select.value);
    render();
    focusDraftTarget(index, draft.targets.length - 1);
    return;
  }

  const position = Number(button.dataset.position);
  if (action === "remove-target") {
    draft.targets.splice(position, 1);
    render();
    focusDraftTarget(index, Math.min(position, draft.targets.length - 1));
    return;
  }
  if (action === "move-up" && position > 0) {
    [draft.targets[position - 1], draft.targets[position]] = [draft.targets[position], draft.targets[position - 1]];
    render();
    focusDraftTarget(index, position - 1);
    return;
  }
  if (action === "move-down" && position < draft.targets.length - 1) {
    [draft.targets[position], draft.targets[position + 1]] = [draft.targets[position + 1], draft.targets[position]];
    render();
    focusDraftTarget(index, position + 1);
  }
});

rowsElement.addEventListener("change", (event) => {
  if (shellElement.inert) return;
  if (event.target.dataset.action !== "change-target") return;
  draft.targets[Number(event.target.dataset.position)] = event.target.value;
});

rowsElement.addEventListener("input", (event) => {
  if (shellElement.inert) return;
  if (event.target.dataset.action === "edit-note") draft.note = event.target.value;
});

function renderIfReady() {
  if (guardActiveDraft("filtering mapping rows")) return;
  if (payload) render();
}

searchElement.addEventListener("input", renderIfReady);
modeElement.addEventListener("change", renderIfReady);

downloadElement.addEventListener("click", () => {
  if (guardActiveDraft("downloading JSON")) return;
  if (!payload) {
    setMessage("Mapping JSON is not ready. Reload the source JSON before downloading.", true);
    return;
  }
  const blob = new Blob([serializeMappingPayload(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = DOWNLOAD_NAME;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  setMessage(`Downloaded ${DOWNLOAD_NAME}. Replace mapping/data/${DOWNLOAD_NAME} in the source to publish these mappings.`);
});

resetElement.addEventListener("click", () => {
  loadSourceMapping().catch((error) => setMessage(error.message, true));
});

importTriggerElement.addEventListener("click", () => importElement.click());

importElement.addEventListener("change", async () => {
  const file = importElement.files?.[0];
  importElement.value = "";
  if (!file) return;
  if (guardActiveDraft("importing JSON")) return;
  if (!sourcePayload) {
    setMessage("Source JSON must load before importing a mapping.", true);
    return;
  }
  if (!beginOperation()) return;
  setMessage(`Importing ${file.name}…`);
  try {
    if (file.size > 5_000_000) throw new Error("Mapping JSON must be smaller than 5 MB.");
    const imported = normalizeMappingPayload(JSON.parse(await file.text()));
    if (!hasSameGeneratedScaffold(sourcePayload, imported)) {
      throw new Error("Imported JSON does not match the current generated inventory scaffold.");
    }
    payload = imported;
    editingIndex = -1;
    draft = null;
    render();
    setMessage(`Imported ${file.name}. Download JSON after any further edits.`);
  } catch (error) {
    setMessage(`Import failed: ${error.message}`, true);
  } finally {
    finishOperation();
  }
});

loadSourceMapping().catch((error) => {
  rowsElement.replaceChildren(make("p", "empty-state", error.message));
  shellElement.setAttribute("aria-busy", "false");
  setMessage(error.message, true);
  console.error(error);
});
