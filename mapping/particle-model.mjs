const ROOT_KEYS = new Set(["schema", "description", "provenance", "mappings"]);
const PROVENANCE_KEYS = new Set(["mongfontbuilder", "meco"]);
const MONGFONTBUILDER_KEYS = new Set(["repository", "commit", "particlesPath", "aliasesPath"]);
const MECO_KEYS = new Set(["repository", "commit"]);
const ROW_KEYS = new Set(["id", "pattern", "particleIndices", "sources", "targets", "note"]);
const GENERATED_ROW_KEYS = ["id", "pattern", "particleIndices"];
const SCHEMA = "zvvnmod-utn57-particles-v3";
const DESCRIPTION =
  "Compact editable Rust-named ZVVNMOD and UTN57 particle sequences with leading MVS/NNBSP "
  + "context omitted; either ordered side may contain a different number of values.";
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

function stringArray(value, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new TypeError(`${label} must be an array of strings`);
  }
  return [...value];
}

export function particleMode(baseline, current) {
  if (!sameSequence(baseline.sources, current.sources)
      || !sameSequence(baseline.targets, current.targets)) {
    return "special";
  }
  return baseline.sources.length && baseline.targets.length ? "direct" : "unmapped";
}

export function updateParticleEntry(entry, sources, targets, note = entry.note || "") {
  const nextSources = stringArray(sources, "sources");
  const nextTargets = stringArray(targets, "targets");
  if (!nextSources.length && !nextTargets.length) {
    throw new TypeError("particle row cannot have both sides empty");
  }
  return {
    id: entry.id,
    pattern: entry.pattern,
    particleIndices: [...entry.particleIndices],
    sources: nextSources,
    targets: nextTargets,
    note: String(note),
  };
}

function normalizeProvenance(provenance) {
  assertExactKeys(provenance, PROVENANCE_KEYS, "provenance");
  assertExactKeys(provenance.mongfontbuilder, MONGFONTBUILDER_KEYS, "provenance.mongfontbuilder");
  assertExactKeys(provenance.meco, MECO_KEYS, "provenance.meco");
  for (const [label, source] of Object.entries(provenance)) {
    if (typeof source.repository !== "string" || !source.repository.startsWith("https://github.com/")) {
      throw new TypeError(`${label} repository must be a GitHub URL`);
    }
    if (typeof source.commit !== "string" || !COMMIT.test(source.commit)) {
      throw new TypeError(`${label} commit must be a 40-character lowercase SHA`);
    }
  }
  for (const pathKey of ["particlesPath", "aliasesPath"]) {
    if (typeof provenance.mongfontbuilder[pathKey] !== "string"
        || provenance.mongfontbuilder[pathKey].length === 0) {
      throw new TypeError(`Mongfontbuilder ${pathKey} must be a nonempty string`);
    }
  }
  return {
    mongfontbuilder: { ...provenance.mongfontbuilder },
    meco: { ...provenance.meco },
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
  if (row.pattern.split(" ")[0] === "mvs" || row.pattern.split(" ")[0] === "nnbsp") {
    throw new TypeError(`${label} must omit leading MVS/NNBSP context`);
  }
  const patternLength = row.pattern.split(" ").length;
  if (!Array.isArray(row.particleIndices)
      || row.particleIndices.length === 0
      || row.particleIndices.some(
        (value) => !Number.isInteger(value) || value < 0 || value >= patternLength,
      )) {
    throw new TypeError(`${label}.particleIndices is invalid`);
  }
  const sources = stringArray(row.sources, `${label}.sources`);
  const targets = stringArray(row.targets, `${label}.targets`);
  if (!sources.length && !targets.length) throw new TypeError(`${label} has both sides empty`);
  for (const source of sources) {
    if (!sourceIds.has(source)) throw new TypeError(`${label} contains unknown ZVVNMOD source ${source}`);
  }
  for (const target of targets) {
    if (!targetIds.has(target)) throw new TypeError(`${label} contains unknown UTN57 target ${target}`);
  }
  if (typeof row.note !== "string") throw new TypeError(`${label}.note must be a string`);
  return updateParticleEntry(row, sources, targets, row.note);
}

export function normalizeParticlePayload(payload, { sourceIds, targetIds }) {
  assertExactKeys(payload, ROOT_KEYS, "particle payload");
  if (payload.schema !== SCHEMA) throw new TypeError(`unsupported particle schema: ${payload.schema}`);
  if (payload.description !== DESCRIPTION) throw new TypeError("particle description does not match v3");
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
    provenance: normalizeProvenance(payload.provenance),
    mappings,
  };
}

export function hasSameParticleScaffold(source, candidate) {
  if (!source || !candidate || source.schema !== candidate.schema) return false;
  if (source.description !== candidate.description) return false;
  if (JSON.stringify(source.provenance) !== JSON.stringify(candidate.provenance)) return false;
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
