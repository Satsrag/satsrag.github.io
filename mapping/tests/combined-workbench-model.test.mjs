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
const source = normalizeCombinedPayload({
  schema: "zvvnmod-utn57-workbench-v1",
  mapping,
  particleMappings,
});

test("one JSON round-trips main mapping and particle edits", () => {
  const edited = structuredClone(source);
  edited.mapping.mappings[0] = updateMappingEntry(
    edited.mapping.mappings[0],
    ["U+E001"],
    ["O:init"],
    "main edit",
  );
  const particleIndex = edited.particleMappings.mappings.findIndex(
    (row) => row.pattern === "mvs i",
  );
  edited.particleMappings.mappings[particleIndex] = updateParticleEntry(
    edited.particleMappings.mappings[particleIndex],
    edited.particleMappings.mappings[particleIndex].zvvnmodCodes.map(
      (code) => code || "U+E000",
    ),
    "particle edit",
  );

  const roundTrip = normalizeCombinedPayload(JSON.parse(serializeCombinedPayload(edited)));
  assert.deepEqual(roundTrip.mapping.mappings[0].sources, ["U+E001"]);
  assert.deepEqual(roundTrip.mapping.mappings[0].targets, ["O:init"]);
  assert.equal(roundTrip.mapping.mappings[0].note, "main edit");
  assert.deepEqual(
    roundTrip.particleMappings.mappings[particleIndex].zvvnmodCodes,
    ["U+E000", "U+E01A"],
  );
  assert.equal(roundTrip.particleMappings.mappings[particleIndex].mode, "special");
  assert.equal(roundTrip.particleMappings.mappings[particleIndex].note, "particle edit");
  assert.equal(hasSameCombinedScaffold(source, roundTrip), true);
});

test("combined scaffold rejects generated changes on either mapping family", () => {
  const changedMain = structuredClone(source);
  changedMain.mapping.mappings[0].defaultTargets = ["A:isol"];
  assert.equal(hasSameCombinedScaffold(source, changedMain), false);

  const changedParticle = structuredClone(source);
  changedParticle.particleMappings.mappings[0].defaultZvvnmodCodes[0] = null;
  assert.equal(hasSameCombinedScaffold(source, changedParticle), false);
});

test("combined root rejects unknown fields", () => {
  const extra = { ...structuredClone(source), html: "<script>alert(1)</script>" };
  assert.throws(() => normalizeCombinedPayload(extra), /combined root fields/);
});
