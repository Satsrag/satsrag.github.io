const SCHEMA = "zvvnmod-utn57-map-v1";
const ROOT_FIELDS = ["schema", "description", "targets", "mappings"];
const TARGET_FIELDS = ["id", "unit", "position", "glyph", "order"];
const MAPPING_FIELDS = [
  "source",
  "sourceName",
  "sourceConst",
  "sourceValue",
  "defaultTargets",
  "targets",
  "mode",
  "note",
];
const GENERATED_MAPPING_FIELDS = ["source", "sourceName", "sourceConst", "sourceValue", "defaultTargets"];

function requireExactFields(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!sameSequence(actual, wanted)) {
    throw new Error(`${label} must contain exactly these fields: ${wanted.join(", ")}`);
  }
}

function sameSequence(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function requireStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings`);
  }
  return [...value];
}

function normalizedMode(defaultTargets, targets) {
  if (!sameSequence(defaultTargets, targets)) return "special";
  return defaultTargets.length ? "direct" : "unmapped";
}

export function updateMappingEntry(entry, targets, note = entry.note || "") {
  const defaultTargets = requireStringArray(entry.defaultTargets, "defaultTargets");
  const nextTargets = requireStringArray(targets, "targets");
  return {
    ...entry,
    defaultTargets,
    targets: nextTargets,
    mode: normalizedMode(defaultTargets, nextTargets),
    note: String(note),
  };
}

export function normalizeMappingPayload(input) {
  if (!input || typeof input !== "object" || input.schema !== SCHEMA) {
    throw new Error(`mapping schema must be ${SCHEMA}`);
  }
  requireExactFields(input, ROOT_FIELDS, "mapping root fields");
  if (typeof input.description !== "string") throw new Error("mapping description must be a string");
  if (!Array.isArray(input.targets) || !Array.isArray(input.mappings)) {
    throw new Error("mapping payload must contain targets and mappings arrays");
  }
  if (!input.targets.length) throw new Error("mapping payload must contain at least one UTN57 target");

  const targetIds = new Set();
  const targets = input.targets.map((target, order) => {
    if (!target || typeof target !== "object" || typeof target.id !== "string") {
      throw new Error(`invalid UTN57 target at index ${order}`);
    }
    requireExactFields(target, TARGET_FIELDS, `UTN57 target fields at index ${order}`);
    if (targetIds.has(target.id)) throw new Error(`duplicate UTN57 target: ${target.id}`);
    if (!Number.isInteger(target.order) || target.order !== order) {
      throw new Error(`UTN57 target order mismatch at index ${order}`);
    }
    targetIds.add(target.id);
    return { ...target };
  });

  const sourceKeys = new Set();
  const mappings = input.mappings.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`invalid mapping at index ${index}`);
    requireExactFields(entry, MAPPING_FIELDS, `mapping fields at index ${index}`);
    if (typeof entry.note !== "string") throw new Error(`mapping ${index} note must be a string`);
    const source = requireStringArray(entry.source, `mapping ${index} source`);
    if (!source.length) throw new Error(`mapping ${index} source must not be empty`);
    const sourceKey = JSON.stringify(source);
    if (sourceKeys.has(sourceKey)) throw new Error(`duplicate source sequence: ${source.join(" ")}`);
    sourceKeys.add(sourceKey);

    const defaultTargets = requireStringArray(entry.defaultTargets, `mapping ${index} defaultTargets`);
    const currentTargets = requireStringArray(entry.targets, `mapping ${index} targets`);
    for (const target of [...defaultTargets, ...currentTargets]) {
      if (!targetIds.has(target)) throw new Error(`unknown UTN57 target: ${target}`);
    }

    return updateMappingEntry(
      {
        ...entry,
        source,
        defaultTargets,
        note: entry.note,
      },
      currentTargets,
      entry.note,
    );
  });

  return {
    schema: SCHEMA,
    description: input.description,
    targets,
    mappings,
  };
}

export function hasSameGeneratedScaffold(source, candidate) {
  if (!source || !candidate || source.schema !== candidate.schema) return false;
  if (source.description !== candidate.description) return false;
  if (JSON.stringify(source.targets) !== JSON.stringify(candidate.targets)) return false;
  if (!Array.isArray(source.mappings) || source.mappings.length !== candidate.mappings?.length) return false;
  return source.mappings.every((entry, index) => {
    const candidateEntry = candidate.mappings[index];
    return GENERATED_MAPPING_FIELDS.every(
      (field) => JSON.stringify(entry[field]) === JSON.stringify(candidateEntry?.[field]),
    );
  });
}

export function serializeMappingPayload(payload) {
  return `${JSON.stringify(normalizeMappingPayload(payload), null, 2)}\n`;
}
