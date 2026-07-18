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
  "zvvnmodCodes",
  "utn57Shapes",
  "utn57GlyphNames",
  "ambiguous",
]);
const SCHEMA = "zvvnmod-utn57-particles-v1";
const DESCRIPTION =
  "Mongfontbuilder MNG particle patterns aligned from canonical ZVVNMOD shape sequences " +
  "to UTN57 shape sequences; nominal pattern context is retained because some canonical " +
  "ZVVNMOD sequences are ambiguous.";
const CODE_ID = /^U\+[0-9A-F]{4,6}$/;
const COMMIT = /^[0-9a-f]{40}$/;

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
      typeof sources.mongfontbuilder[pathKey] !== "string" ||
      sources.mongfontbuilder[pathKey].length === 0
    ) {
      throw new TypeError(`Mongfontbuilder ${pathKey} must be a nonempty string`);
    }
  }
  return {
    mongfontbuilder: { ...sources.mongfontbuilder },
    meco: { ...sources.meco },
  };
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
    !Array.isArray(row.particleIndices) ||
    row.particleIndices.length === 0 ||
    row.particleIndices.some(
      (value) => !Number.isInteger(value) || value < 0 || value >= nominalCodePoints.length,
    )
  ) {
    throw new TypeError(`${label}.particleIndices is invalid`);
  }
  const rawZvvnmodCodes = stringArray(row.rawZvvnmodCodes, `${label}.rawZvvnmodCodes`, {
    nonempty: true,
    codeIds: true,
  });
  const zvvnmodCodes = stringArray(row.zvvnmodCodes, `${label}.zvvnmodCodes`, {
    nonempty: true,
    codeIds: true,
  });
  for (const code of zvvnmodCodes) {
    const value = Number.parseInt(code.slice(2), 16);
    if (value >= 0xe140 && value <= 0xe143) {
      throw new TypeError(`${label} canonical sequence contains a legacy control`);
    }
    if (!sourceIds.has(code)) throw new TypeError(`${label} contains unknown ZVVNMOD code ${code}`);
  }
  const utn57Shapes = stringArray(row.utn57Shapes, `${label}.utn57Shapes`, { nonempty: true });
  for (const shape of utn57Shapes) {
    if (!targetIds.has(shape)) throw new TypeError(`${label} contains unknown UTN57 shape ${shape}`);
  }
  const utn57GlyphNames = stringArray(row.utn57GlyphNames, `${label}.utn57GlyphNames`, {
    nonempty: true,
  });
  if (typeof row.ambiguous !== "boolean") throw new TypeError(`${label}.ambiguous must be boolean`);
  return {
    id: row.id,
    pattern: row.pattern,
    particleIndices: [...row.particleIndices],
    nominalCodePoints,
    rawZvvnmodCodes,
    zvvnmodCodes,
    utn57Shapes,
    utn57GlyphNames,
    ambiguous: row.ambiguous,
  };
}

export function normalizeParticlePayload(payload, { sourceIds, targetIds }) {
  assertExactKeys(payload, ROOT_KEYS, "particle payload");
  if (payload.schema !== SCHEMA) throw new TypeError(`unsupported particle schema: ${payload.schema}`);
  if (payload.description !== DESCRIPTION) throw new TypeError("particle description does not match v1");
  if (!(sourceIds instanceof Set) || !(targetIds instanceof Set)) {
    throw new TypeError("particle catalogues must be Sets");
  }
  if (!Array.isArray(payload.mappings) || payload.mappings.length !== 47) {
    throw new TypeError("particle payload must contain 47 mappings");
  }
  const mappings = payload.mappings.map((row, index) =>
    normalizeRow(row, index, sourceIds, targetIds),
  );
  if (new Set(mappings.map((row) => row.pattern)).size !== mappings.length) {
    throw new TypeError("particle patterns must be unique");
  }

  const targetsBySource = new Map();
  for (const row of mappings) {
    const sourceKey = row.zvvnmodCodes.join("\u0000");
    const targetKey = row.utn57Shapes.join("\u0000");
    if (!targetsBySource.has(sourceKey)) targetsBySource.set(sourceKey, new Set());
    targetsBySource.get(sourceKey).add(targetKey);
  }
  for (const row of mappings) {
    const expected = targetsBySource.get(row.zvvnmodCodes.join("\u0000")).size > 1;
    if (row.ambiguous !== expected) {
      throw new TypeError(`${row.id} ambiguity flag does not match the observed mappings`);
    }
  }

  return {
    schema: payload.schema,
    description: payload.description,
    sources: normalizeSources(payload.sources),
    mappings,
  };
}
