import { normalizeParticlePayload } from "./particle-model.mjs?v=1";
import { normalizeMappingPayload } from "./workbench-model.mjs?v=3";

const rowsElement = document.querySelector("#particle-mapping-rows");
const statusElement = document.querySelector("#particle-mapping-status");
const tableShell = document.querySelector(".particle-table-shell");

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderPattern(row) {
  const cell = document.createElement("td");
  const sequence = element("div", "particle-pattern");
  const particleIndices = new Set(row.particleIndices);
  row.pattern.split(" ").forEach((token, index) => {
    const tokenElement = element(particleIndices.has(index) ? "mark" : "span", "pattern-token", token);
    tokenElement.title = row.nominalCodePoints[index];
    sequence.append(tokenElement);
  });
  const codePoints = element("div", "particle-codepoints", row.nominalCodePoints.join(" "));
  cell.append(sequence, codePoints);
  if (row.ambiguous) {
    const warning = element("span", "ambiguity-badge", "Nominal context required");
    warning.setAttribute(
      "aria-label",
      "Nominal context required. This canonical ZVVNMOD sequence has multiple UTN57 outcomes; use the nominal particle pattern to disambiguate it.",
    );
    cell.append(warning);
  }
  return cell;
}

function renderZvvnmodChip(codeId, sources) {
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

function renderUtn57Chip(shapeId, targets) {
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

function renderSequenceCell(ids, className, renderChip, catalogue, label) {
  const cell = document.createElement("td");
  const sequence = element("div", `particle-sequence ${className}`);
  sequence.setAttribute("aria-label", label);
  ids.forEach((id) => sequence.append(renderChip(id, catalogue)));
  cell.append(sequence);
  return cell;
}

function render(payload, mappingCatalogue) {
  const sources = new Map(mappingCatalogue.sources.map((source) => [source.id, source]));
  const targets = new Map(mappingCatalogue.targets.map((target) => [target.id, target]));
  const fragment = document.createDocumentFragment();
  for (const row of payload.mappings) {
    const tableRow = document.createElement("tr");
    if (row.ambiguous) tableRow.className = "ambiguous-particle-row";
    tableRow.append(
      renderPattern(row),
      renderSequenceCell(
        row.zvvnmodCodes,
        "zvvnmod-particle-sequence",
        renderZvvnmodChip,
        sources,
        `Canonical ZVVNMOD sequence for ${row.pattern}`,
      ),
      renderSequenceCell(
        row.utn57Shapes,
        "utn57-particle-sequence",
        renderUtn57Chip,
        targets,
        `UTN57 shape sequence for ${row.pattern}`,
      ),
    );
    fragment.append(tableRow);
  }
  rowsElement.replaceChildren(fragment);
  const ambiguous = payload.mappings.filter((row) => row.ambiguous).length;
  const uniqueSources = new Set(payload.mappings.map((row) => row.zvvnmodCodes.join(" "))).size;
  statusElement.textContent =
    `${payload.mappings.length} Mongfontbuilder patterns · ${uniqueSources} canonical ZVVNMOD sequences · ` +
    `${ambiguous} context-dependent rows`;
}

async function loadParticleMappings() {
  try {
    const [particleResponse, mappingResponse] = await Promise.all([
      fetch("./data/zvvnmod-utn57-particles.json?v=1", { cache: "no-cache" }),
      fetch("./data/zvvnmod-utn57-map.json?v=2", { cache: "no-cache" }),
    ]);
    if (!particleResponse.ok || !mappingResponse.ok) {
      throw new Error(
        `Particle data request failed (${particleResponse.status}/${mappingResponse.status})`,
      );
    }
    const [particlePayload, mappingPayload] = await Promise.all([
      particleResponse.json(),
      mappingResponse.json(),
    ]);
    const mappingCatalogue = normalizeMappingPayload(mappingPayload);
    const payload = normalizeParticlePayload(particlePayload, {
      sourceIds: new Set(mappingCatalogue.sources.map((source) => source.id)),
      targetIds: new Set(["MVS", ...mappingCatalogue.targets.map((target) => target.id)]),
    });
    render(payload, mappingCatalogue);
  } catch (error) {
    statusElement.classList.add("error");
    statusElement.textContent = `Could not load particle mappings: ${error.message}`;
    const row = document.createElement("tr");
    const cell = element("td", "particle-load-error", "Particle mappings are unavailable.");
    cell.colSpan = 3;
    row.append(cell);
    rowsElement.replaceChildren(row);
  } finally {
    tableShell.setAttribute("aria-busy", "false");
  }
}

loadParticleMappings();
