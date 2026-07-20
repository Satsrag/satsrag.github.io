const SCHEMA = "zvvnmod-utn57-map-v3";
const ROOT_FIELDS = ["schema", "description", "sources", "targets", "mappings"];
const SOURCE_FIELDS = ["id", "name", "codepoint", "value", "glyph", "order"];
const TARGET_FIELDS = ["id", "unit", "position", "glyph", "order"];
const MAPPING_FIELDS = ["id", "sources", "targets", "note"];
const RUST_CONST = /^[A-Z][A-Z0-9_]*$/;
const CODEPOINT = /^U\+[0-9A-F]{4,6}$/;

function sameSequence(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function requireExactFields(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!sameSequence(actual, wanted)) {
    throw new Error(`${label} must contain exactly these fields: ${wanted.join(", ")}`);
  }
}

function requireStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings`);
  }
  return [...value];
}

export function mappingMode(baseline, current) {
  if (!sameSequence(baseline.sources, current.sources)
      || !sameSequence(baseline.targets, current.targets)) {
    return "special";
  }
  return baseline.sources.length && baseline.targets.length ? "direct" : "unmapped";
}

export function updateMappingEntry(entry, sources, targets, note = entry.note || "") {
  const nextSources = requireStringArray(sources, "sources");
  const nextTargets = requireStringArray(targets, "targets");
  if (!nextSources.length && !nextTargets.length) {
    throw new Error("mapping row cannot have both sides empty");
  }
  return {
    id: entry.id,
    sources: nextSources,
    targets: nextTargets,
    note: String(note),
  };
}

function normalizeCatalogue(items, fields, label, validate) {
  if (!Array.isArray(items) || !items.length) {
    throw new Error(`mapping payload must contain at least one ${label}`);
  }
  const ids = new Set();
  return items.map((item, order) => {
    if (!item || typeof item !== "object" || typeof item.id !== "string") {
      throw new Error(`invalid ${label} at index ${order}`);
    }
    requireExactFields(item, fields, `${label} fields at index ${order}`);
    if (ids.has(item.id)) throw new Error(`duplicate ${label}: ${item.id}`);
    if (!Number.isInteger(item.order) || item.order !== order) {
      throw new Error(`${label} order mismatch at index ${order}`);
    }
    validate(item);
    ids.add(item.id);
    return { ...item };
  });
}

export function normalizeMappingPayload(input) {
  if (!input || typeof input !== "object" || input.schema !== SCHEMA) {
    throw new Error(`mapping schema must be ${SCHEMA}`);
  }
  requireExactFields(input, ROOT_FIELDS, "mapping root fields");
  if (typeof input.description !== "string") throw new Error("mapping description must be a string");
  if (!Array.isArray(input.mappings)) throw new Error("mapping payload must contain a mappings array");

  const sources = normalizeCatalogue(input.sources, SOURCE_FIELDS, "ZVVNMOD source", (source) => {
    if (
      !RUST_CONST.test(source.id)
      || typeof source.name !== "string"
      || typeof source.codepoint !== "string"
      || !CODEPOINT.test(source.codepoint)
      || !Number.isInteger(source.value)
      || typeof source.glyph !== "string"
    ) {
      throw new Error(`invalid ZVVNMOD source metadata: ${source.id}`);
    }
  });
  const targets = normalizeCatalogue(input.targets, TARGET_FIELDS, "UTN57 target", (target) => {
    if (
      typeof target.unit !== "string"
      || typeof target.position !== "string"
      || typeof target.glyph !== "string"
    ) {
      throw new Error(`invalid UTN57 target metadata: ${target.id}`);
    }
  });
  const sourceIds = new Set(sources.map((source) => source.id));
  const targetIds = new Set(targets.map((target) => target.id));
  const rowIds = new Set();

  const mappings = input.mappings.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`invalid mapping at index ${index}`);
    requireExactFields(entry, MAPPING_FIELDS, `mapping fields at index ${index}`);
    if (typeof entry.id !== "string" || !entry.id) throw new Error(`mapping ${index} id must be a string`);
    if (rowIds.has(entry.id)) throw new Error(`duplicate mapping id: ${entry.id}`);
    rowIds.add(entry.id);
    if (typeof entry.note !== "string") throw new Error(`mapping ${index} note must be a string`);

    const currentSources = requireStringArray(entry.sources, `mapping ${index} sources`);
    const currentTargets = requireStringArray(entry.targets, `mapping ${index} targets`);
    if (!currentSources.length && !currentTargets.length) {
      throw new Error(`mapping ${index} has both sides empty`);
    }
    for (const source of currentSources) {
      if (!sourceIds.has(source)) throw new Error(`unknown ZVVNMOD source: ${source}`);
    }
    for (const target of currentTargets) {
      if (!targetIds.has(target)) throw new Error(`unknown UTN57 target: ${target}`);
    }
    return updateMappingEntry(entry, currentSources, currentTargets, entry.note);
  });

  return {
    schema: SCHEMA,
    description: input.description,
    sources,
    targets,
    mappings,
  };
}

export function hasSameGeneratedScaffold(source, candidate) {
  if (!source || !candidate || source.schema !== candidate.schema) return false;
  if (source.description !== candidate.description) return false;
  if (JSON.stringify(source.sources) !== JSON.stringify(candidate.sources)) return false;
  if (JSON.stringify(source.targets) !== JSON.stringify(candidate.targets)) return false;
  if (!Array.isArray(source.mappings) || source.mappings.length !== candidate.mappings?.length) return false;
  return source.mappings.every((entry, index) => entry.id === candidate.mappings[index]?.id);
}

export function serializeMappingPayload(payload) {
  return `${JSON.stringify(normalizeMappingPayload(payload), null, 2)}\n`;
}
