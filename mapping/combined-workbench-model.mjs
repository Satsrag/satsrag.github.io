import {
  hasSameParticleScaffold,
  normalizeParticlePayload,
} from "./particle-model.mjs?v=4";
import {
  hasSameGeneratedScaffold,
  normalizeMappingPayload,
} from "./workbench-model.mjs?v=4";

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

export function normalizeCombinedPayload(input, { expectedBaseline } = {}) {
  requireExactFields(input, ROOT_FIELDS, "combined root fields");
  if (input.schema !== SCHEMA) throw new TypeError(`combined schema must be ${SCHEMA}`);
  if (typeof input.baseline !== "string" || !BASELINE.test(input.baseline)) {
    throw new TypeError("combined baseline must be a sha256 digest");
  }
  if (expectedBaseline !== undefined && input.baseline !== expectedBaseline) {
    throw new TypeError("combined baseline does not match the loaded Git baseline");
  }
  const mapping = normalizeMappingPayload(input.mapping);
  const particleMappings = normalizeParticlePayload(input.particleMappings, {
    sourceIds: new Set(mapping.sources.map((source) => source.id)),
    targetIds: new Set(mapping.targets.map((target) => target.id)),
  });
  return { schema: SCHEMA, baseline: input.baseline, mapping, particleMappings };
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

export function serializeCombinedPayload(payload) {
  return `${JSON.stringify(normalizeCombinedPayload(payload), null, 2)}\n`;
}
