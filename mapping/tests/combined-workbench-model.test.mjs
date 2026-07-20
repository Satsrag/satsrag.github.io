import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  hasSameCombinedScaffold,
  normalizeCombinedPayload,
  serializeCombinedPayload,
} from "../combined-workbench-model.mjs";
import { updateMappingEntry } from "../workbench-model.mjs";
import { updateParticleEntry } from "../particle-model.mjs";

const mapping = JSON.parse(await readFile(new URL("../data/zvvnmod-utn57-map.json", import.meta.url), "utf8"));
const particleMappings = JSON.parse(
  await readFile(new URL("../data/zvvnmod-utn57-particles.json", import.meta.url), "utf8"),
);
const baseline = `sha256:${"a".repeat(64)}`;
const source = normalizeCombinedPayload({
  schema: "zvvnmod-utn57-workbench-v2",
  baseline,
  mapping,
  particleMappings,
});

test("one compact JSON round-trips unequal-length main and particle sequences", () => {
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

  const roundTrip = normalizeCombinedPayload(JSON.parse(serializeCombinedPayload(edited)));
  assert.deepEqual(roundTrip.mapping.mappings[0].sources, ["O_INIT", "I_MEDI"]);
  assert.deepEqual(roundTrip.mapping.mappings[0].targets, ["O:init"]);
  assert.deepEqual(roundTrip.particleMappings.mappings[particleIndex].sources, ["I_INIT"]);
  assert.deepEqual(
    roundTrip.particleMappings.mappings[particleIndex].targets,
    ["I:init", "I:medi", "R:fina"],
  );
  assert.equal(Object.hasOwn(roundTrip.mapping.mappings[0], "mode"), false);
  assert.equal(Object.hasOwn(roundTrip.particleMappings.mappings[particleIndex], "mode"), false);
  assert.equal(hasSameCombinedScaffold(source, roundTrip), true);
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
  assert.throws(() => normalizeCombinedPayload(extra), /combined root fields/);
});

test("combined import is bound to the exact Git baseline digest", () => {
  assert.equal(source.baseline, baseline);
  assert.throws(
    () => normalizeCombinedPayload(source, { expectedBaseline: `sha256:${"b".repeat(64)}` }),
    /baseline does not match/,
  );
  const changed = { ...structuredClone(source), baseline: `sha256:${"b".repeat(64)}` };
  assert.equal(hasSameCombinedScaffold(source, changed), false);
});
