const ROOT_KEYS = new Set(["schema", "description", "sources", "mappings"]);
const SOURCE_KEYS = new Set(["mongfontbuilder", "meco"]);
const MONGFONTBUILDER_KEYS = new Set(["repository", "commit", "particlesPath", "aliasesPath"]);
const MECO_KEYS = new Set(["repository", "commit"]);
const ROW_KEYS = new Set([
  "id",
  "pattern",
  "particleIndices",
  "nominalCodePoints",
  "rawZvvnmodCodes",
  "defaultZvvnmodCodes",
  "zvvnmodCodes",
  "utn57Shapes",
  "utn57GlyphNames",
  "mode",
  "note",
]);
const GENERATED_ROW_KEYS = [
  "id",
  "pattern",
  "particleIndices",
  "nominalCodePoints",
  "rawZvvnmodCodes",
  "defaultZvvnmodCodes",
  "utn57Shapes",
  "utn57GlyphNames",
];
const SCHEMA = "zvvnmod-utn57-particles-v2";
const DESCRIPTION =
  "Mongfontbuilder MNG particle patterns with editable ZVVNMOD slots aligned one-for-one " +
  "to observed UTN57 shapes; unmatched semantic counterparts remain null for review.";
const CODE_ID = /^U\+[0-9A-F]{4,6}$/;
const COMMIT = /^[0-9a-f]{40}$/;

function sameSequence(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertPlainObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function assertExactKeys(value, expected, label) {
  assertPlainObject(value, label);
  const actual = Object.keys(value);
  const unexpected = actual.filter((key) => !expected.has(key));
  const missing = [...expected].filter((key) => !Object.hasOwn(value, key));
  if (unexpected.length || missing.length) {
    throw new TypeError(
      `${label} has unexpected fields or missing fields: unexpected=${unexpected.join(",")} missing=${missing.join(",")}`,
    );
  }
}

function stringArray(value, label, { nonempty = false, codeIds = false } = {}) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new TypeError(`${label} must be an array of strings`);
  }
  if (nonempty && value.length === 0) throw new TypeError(`${label} cannot be empty`);
  if (codeIds && value.some((entry) => !CODE_ID.test(entry))) {
    throw new TypeError(`${label} contains an invalid code ID`);
  }
  return [...value];
}

function slotArray(value, label) {
  if (
    !Array.isArray(value)
    || value.some((entry) => entry !== null && (typeof entry !== "string" || !CODE_ID.test(entry)))
  ) {
    throw new TypeError(`${label} must be an array of ZVVNMOD code IDs or null slots`);
  }
  return [...value];
}

function normalizedMode(defaultSlots, slots) {
  if (!sameSequence(defaultSlots, slots)) return "special";
  return slots.every((slot) => slot !== null) ? "direct" : "unmapped";
}

export function updateParticleEntry(entry, slots, note = entry.note || "") {
  const defaultZvvnmodCodes = slotArray(entry.defaultZvvnmodCodes, "defaultZvvnmodCodes");
  const zvvnmodCodes = slotArray(slots, "zvvnmodCodes");
  if (zvvnmodCodes.length !== entry.utn57Shapes.length) {
    throw new TypeError("particle row must contain one ZVVNMOD slot per UTN57 shape");
  }
  return {
    ...entry,
    defaultZvvnmodCodes,
    zvvnmodCodes,
    mode: normalizedMode(defaultZvvnmodCodes, zvvnmodCodes),
    note: String(note),
  };
}

function normalizeSources(sources) {
  assertExactKeys(sources, SOURCE_KEYS, "sources");
  assertExactKeys(sources.mongfontbuilder, MONGFONTBUILDER_KEYS, "sources.mongfontbuilder");
  assertExactKeys(sources.meco, MECO_KEYS, "sources.meco");
  for (const [label, source] of Object.entries(sources)) {
    if (typeof source.repository !== "string" || !source.repository.startsWith("https://github.com/")) {
      throw new TypeError(`${label} repository must be a GitHub URL`);
    }
    if (typeof source.commit !== "string" || !COMMIT.test(source.commit)) {
      throw new TypeError(`${label} commit must be a 40-character lowercase SHA`);
    }
  }
  for (const pathKey of ["particlesPath", "aliasesPath"]) {
    if (
      typeof sources.mongfontbuilder[pathKey] !== "string"
      || sources.mongfontbuilder[pathKey].length === 0
    ) {
      throw new TypeError(`Mongfontbuilder ${pathKey} must be a nonempty string`);
    }
  }
  return {
    mongfontbuilder: { ...sources.mongfontbuilder },
    meco: { ...sources.meco },
  };
}

function validateSlots(slots, sourceIds, label) {
  for (const code of slots) {
    if (code === null) continue;
    const value = Number.parseInt(code.slice(2), 16);
    if (value >= 0xe140 && value <= 0xe143) {
      throw new TypeError(`${label} contains a legacy control`);
    }
    if (!sourceIds.has(code)) throw new TypeError(`${label} contains unknown ZVVNMOD code ${code}`);
  }
}

function normalizeRow(row, index, sourceIds, targetIds) {
  const label = `mappings[${index}]`;
  assertExactKeys(row, ROW_KEYS, label);
  const expectedId = `particle:${String(index + 1).padStart(2, "0")}`;
  if (row.id !== expectedId) throw new TypeError(`${label} must have ID ${expectedId}`);
  if (typeof row.pattern !== "string" || row.pattern.trim() !== row.pattern || !row.pattern) {
    throw new TypeError(`${label} pattern must be a nonempty normalized string`);
  }
  const nominalCodePoints = stringArray(row.nominalCodePoints, `${label}.nominalCodePoints`, {
    nonempty: true,
    codeIds: true,
  });
  if (row.pattern.split(" ").length !== nominalCodePoints.length) {
    throw new TypeError(`${label} pattern and nominal code-point lengths differ`);
  }
  if (
    !Array.isArray(row.particleIndices)
    || row.particleIndices.length === 0
    || row.particleIndices.some(
      (value) => !Number.isInteger(value) || value < 0 || value >= nominalCodePoints.length,
    )
  ) {
    throw new TypeError(`${label}.particleIndices is invalid`);
  }
  const rawZvvnmodCodes = stringArray(row.rawZvvnmodCodes, `${label}.rawZvvnmodCodes`, {
    nonempty: true,
    codeIds: true,
  });
  const defaultZvvnmodCodes = slotArray(row.defaultZvvnmodCodes, `${label}.defaultZvvnmodCodes`);
  const zvvnmodCodes = slotArray(row.zvvnmodCodes, `${label}.zvvnmodCodes`);
  const utn57Shapes = stringArray(row.utn57Shapes, `${label}.utn57Shapes`, { nonempty: true });
  if (
    defaultZvvnmodCodes.length !== utn57Shapes.length
    || zvvnmodCodes.length !== utn57Shapes.length
  ) {
    throw new TypeError(`${label} must contain one ZVVNMOD slot per UTN57 shape`);
  }
  validateSlots(defaultZvvnmodCodes, sourceIds, `${label}.defaultZvvnmodCodes`);
  validateSlots(zvvnmodCodes, sourceIds, `${label}.zvvnmodCodes`);
  for (const shape of utn57Shapes) {
    if (!targetIds.has(shape)) throw new TypeError(`${label} contains unknown UTN57 shape ${shape}`);
  }
  const utn57GlyphNames = stringArray(row.utn57GlyphNames, `${label}.utn57GlyphNames`, {
    nonempty: true,
  });
  if (typeof row.note !== "string") throw new TypeError(`${label}.note must be a string`);
  const normalized = updateParticleEntry(
    {
      id: row.id,
      pattern: row.pattern,
      particleIndices: [...row.particleIndices],
      nominalCodePoints,
      rawZvvnmodCodes,
      defaultZvvnmodCodes,
      zvvnmodCodes,
      utn57Shapes,
      utn57GlyphNames,
      mode: row.mode,
      note: row.note,
    },
    zvvnmodCodes,
    row.note,
  );
  if (row.mode !== normalized.mode) {
    throw new TypeError(`${label}.mode must be ${normalized.mode}`);
  }
  return normalized;
}

export function normalizeParticlePayload(payload, { sourceIds, targetIds }) {
  assertExactKeys(payload, ROOT_KEYS, "particle payload");
  if (payload.schema !== SCHEMA) throw new TypeError(`unsupported particle schema: ${payload.schema}`);
  if (payload.description !== DESCRIPTION) throw new TypeError("particle description does not match v2");
  if (!(sourceIds instanceof Set) || !(targetIds instanceof Set)) {
    throw new TypeError("particle catalogues must be Sets");
  }
  if (!Array.isArray(payload.mappings) || payload.mappings.length !== 47) {
    throw new TypeError("particle payload must contain 47 mappings");
  }
  const mappings = payload.mappings.map((row, index) =>
    normalizeRow(row, index, sourceIds, targetIds));
  if (new Set(mappings.map((row) => row.pattern)).size !== mappings.length) {
    throw new TypeError("particle patterns must be unique");
  }
  return {
    schema: payload.schema,
    description: payload.description,
    sources: normalizeSources(payload.sources),
    mappings,
  };
}

export function hasSameParticleScaffold(source, candidate) {
  if (!source || !candidate || source.schema !== candidate.schema) return false;
  if (source.description !== candidate.description) return false;
  if (JSON.stringify(source.sources) !== JSON.stringify(candidate.sources)) return false;
  if (!Array.isArray(source.mappings) || source.mappings.length !== candidate.mappings?.length) return false;
  return source.mappings.every((row, index) => {
    const candidateRow = candidate.mappings[index];
    return GENERATED_ROW_KEYS.every(
      (field) => JSON.stringify(row[field]) === JSON.stringify(candidateRow?.[field]),
    );
  });
}

export function serializeParticlePayload(payload, catalogues) {
  const normalized = catalogues ? normalizeParticlePayload(payload, catalogues) : payload;
  return `${JSON.stringify(normalized, null, 2)}\n`;
}
