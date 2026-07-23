import {
  hasSameParticleScaffold,
  normalizeParticlePayload,
} from "./particle-model.mjs?v=5";
import {
  hasSameGeneratedScaffold,
  normalizeMappingPayload,
} from "./workbench-model.mjs?v=6";

const SCHEMA = "zvvnmod-utn57-workbench-v2";
const ROOT_FIELDS = ["schema", "baseline", "mapping", "particleMappings"];
const BASELINE = /^sha256:[0-9a-f]{64}$/;

function requireExactFields(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new TypeError(`${label} must contain exactly these fields: ${wanted.join(", ")}`);
  }
}

export function normalizeCombinedPayload(input, { expectedBaseline, sources, targets } = {}) {
  requireExactFields(input, ROOT_FIELDS, "combined root fields");
  if (input.schema !== SCHEMA) throw new TypeError(`combined schema must be ${SCHEMA}`);
  if (typeof input.baseline !== "string" || !BASELINE.test(input.baseline)) {
    throw new TypeError("combined baseline must be a sha256 digest");
  }
  if (expectedBaseline !== undefined && input.baseline !== expectedBaseline) {
    throw new TypeError("combined baseline does not match the loaded Git baseline");
  }
  const mapping = normalizeMappingPayload(input.mapping, { sources, targets });
  const particleMappings = normalizeParticlePayload(input.particleMappings, {
    sourceIds: new Set(sources.map((source) => source.id)),
    targetIds: new Set(targets.map((target) => target.id)),
  });
  return { schema: SCHEMA, baseline: input.baseline, mapping, particleMappings };
}

export function applyRuntimeRelations(source, relations, options = {}) {
  const candidate = structuredClone(normalizeCombinedPayload(source, options));
  const rows = [...candidate.mapping.mappings, ...candidate.particleMappings.mappings];
  const byId = new Map(rows.map((row) => [row.id, row]));

  for (const row of candidate.mapping.mappings) {
    if (row.id.startsWith("target:")) row.sources = [];
    else row.targets = [];
  }
  for (const row of candidate.particleMappings.mappings) {
    if (row.sources.length) row.targets = [];
    else row.sources = [];
  }

  for (const relation of relations) {
    const row = byId.get(relation.id);
    if (!row) throw new Error(`Runtime CSV contains unknown row ID: ${relation.id}`);
    row.sources = [...relation.sources];
    row.targets = [...relation.targets];
    row.note = relation.note || "";
  }
  return normalizeCombinedPayload(candidate, options);
}

export function hasSameCombinedScaffold(source, candidate) {
  return Boolean(
    source
    && candidate
    && source.schema === SCHEMA
    && candidate.schema === SCHEMA
    && source.baseline === candidate.baseline
    && hasSameGeneratedScaffold(source.mapping, candidate.mapping)
    && hasSameParticleScaffold(source.particleMappings, candidate.particleMappings)
  );
}
