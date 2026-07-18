import {
  hasSameParticleScaffold,
  normalizeParticlePayload,
} from "./particle-model.mjs?v=2";
import {
  hasSameGeneratedScaffold,
  normalizeMappingPayload,
} from "./workbench-model.mjs?v=3";

const SCHEMA = "zvvnmod-utn57-workbench-v1";
const ROOT_FIELDS = ["schema", "mapping", "particleMappings"];

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

export function normalizeCombinedPayload(input) {
  requireExactFields(input, ROOT_FIELDS, "combined root fields");
  if (input.schema !== SCHEMA) throw new TypeError(`combined schema must be ${SCHEMA}`);
  const mapping = normalizeMappingPayload(input.mapping);
  const particleMappings = normalizeParticlePayload(input.particleMappings, {
    sourceIds: new Set(mapping.sources.map((source) => source.id)),
    targetIds: new Set(["MVS", ...mapping.targets.map((target) => target.id)]),
  });
  return { schema: SCHEMA, mapping, particleMappings };
}

export function hasSameCombinedScaffold(source, candidate) {
  return Boolean(
    source
    && candidate
    && source.schema === SCHEMA
    && candidate.schema === SCHEMA
    && hasSameGeneratedScaffold(source.mapping, candidate.mapping)
    && hasSameParticleScaffold(source.particleMappings, candidate.particleMappings)
  );
}

export function serializeCombinedPayload(payload) {
  return `${JSON.stringify(normalizeCombinedPayload(payload), null, 2)}\n`;
}
