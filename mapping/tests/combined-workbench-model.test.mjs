import assert from "node:assert/strict";
import test from "node:test";

import {
  applyRuntimeRelations,
  hasSameCombinedScaffold,
  normalizeCombinedPayload,
} from "../combined-workbench-model.mjs";
import { updateMappingEntry } from "../workbench-model.mjs";
import { updateParticleEntry } from "../particle-model.mjs";

import { mapping, mappingOptions, particleMappings } from "./fixtures.mjs";

const baseline = `sha256:${"a".repeat(64)}`;
const source = normalizeCombinedPayload(
  {
    schema: "zvvnmod-utn57-workbench-v2",
    baseline,
    mapping,
    particleMappings,
  },
  mappingOptions,
);

test("internal combined model preserves unequal-length main and particle sequences", () => {
  const edited = structuredClone(source);
  edited.mapping.mappings[0] = updateMappingEntry(
    edited.mapping.mappings[0],
    ["O_INIT", "I_MEDI"],
    ["O:init"],
    "main edit",
  );
  const particleIndex = edited.particleMappings.mappings.findIndex(
    (row) => row.id === "particle:07",
  );
  edited.particleMappings.mappings[particleIndex] = updateParticleEntry(
    edited.particleMappings.mappings[particleIndex],
    ["I_INIT"],
    ["I:init", "I:medi", "R:fina"],
    "particle edit",
  );

  const normalized = normalizeCombinedPayload(edited, mappingOptions);
  assert.deepEqual(normalized.mapping.mappings[0].sources, ["O_INIT", "I_MEDI"]);
  assert.deepEqual(normalized.mapping.mappings[0].targets, ["O:init"]);
  assert.deepEqual(normalized.particleMappings.mappings[particleIndex].sources, ["I_INIT"]);
  assert.deepEqual(
    normalized.particleMappings.mappings[particleIndex].targets,
    ["I:init", "I:medi", "R:fina"],
  );
  assert.equal(Object.hasOwn(normalized.mapping.mappings[0], "mode"), false);
  assert.equal(Object.hasOwn(normalized.particleMappings.mappings[particleIndex], "mode"), false);
  assert.equal(hasSameCombinedScaffold(source, normalized), true);
});

test("runtime import treats omitted relations as disabled instead of restoring direct defaults", () => {
  const relations = [...source.mapping.mappings, ...source.particleMappings.mappings]
    .filter((row) => row.sources.length && row.targets.length)
    .filter((row) => !["source:A_INIT", "particle:07"].includes(row.id));
  const imported = applyRuntimeRelations(source, relations, mappingOptions);
  const main = imported.mapping.mappings.find((row) => row.id === "source:A_INIT");
  const particle = imported.particleMappings.mappings.find((row) => row.id === "particle:07");

  assert.deepEqual(main.sources, ["A_INIT"]);
  assert.deepEqual(main.targets, []);
  assert.ok(particle.sources.length > 0);
  assert.deepEqual(particle.targets, []);
  assert.equal(hasSameCombinedScaffold(source, imported), true);

  const targetOnlySource = structuredClone(source);
  const targetOnlyBaseline = targetOnlySource.particleMappings.mappings.find(
    (row) => row.id === "particle:07",
  );
  targetOnlyBaseline.sources = [];
  const targetOnlyRelations = [
    ...targetOnlySource.mapping.mappings,
    ...targetOnlySource.particleMappings.mappings,
  ].filter((row) => row.sources.length && row.targets.length);
  const targetOnlyImported = applyRuntimeRelations(
    targetOnlySource,
    targetOnlyRelations,
    mappingOptions,
  );
  const targetOnlyParticle = targetOnlyImported.particleMappings.mappings.find(
    (row) => row.id === "particle:07",
  );
  assert.deepEqual(targetOnlyParticle.sources, []);
  assert.deepEqual(targetOnlyParticle.targets, targetOnlyBaseline.targets);

  assert.throws(
    () => applyRuntimeRelations(source, [{ id: "unknown", sources: ["A_INIT"], targets: ["A:init"], note: "" }], mappingOptions),
    /unknown row ID/,
  );
});

test("combined scaffold rejects catalogue and row identity changes", () => {
  const changedMain = structuredClone(source);
  changedMain.mapping.mappings[0].id = "source:O_INIT";
  assert.equal(hasSameCombinedScaffold(source, changedMain), false);

  const changedParticle = structuredClone(source);
  changedParticle.particleMappings.mappings[0].pattern = "tampered";
  assert.equal(hasSameCombinedScaffold(source, changedParticle), false);
});

test("combined root rejects unknown fields", () => {
  const extra = { ...structuredClone(source), html: "<script>alert(1)</script>" };
  assert.throws(() => normalizeCombinedPayload(extra, mappingOptions), /combined root fields/);
});

test("combined import is bound to the exact Git baseline digest", () => {
  assert.equal(source.baseline, baseline);
  assert.throws(
    () => normalizeCombinedPayload(source, {
      ...mappingOptions,
      expectedBaseline: `sha256:${"b".repeat(64)}`,
    }),
    /baseline does not match/,
  );
  const changed = { ...structuredClone(source), baseline: `sha256:${"b".repeat(64)}` };
  assert.equal(hasSameCombinedScaffold(source, changed), false);
});
