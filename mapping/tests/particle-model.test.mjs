import assert from "node:assert/strict";
import test from "node:test";

import {
  hasSameParticleScaffold,
  normalizeParticlePayload,
  particleMode,
  updateParticleEntry,
} from "../particle-model.mjs";

import {
  particleCatalogues as catalogues,
  particleMappings as particlePayload,
} from "./fixtures.mjs";
const ROW_KEYS = ["id", "note", "particleIndices", "pattern", "sources", "targets"];

test("v3 particle rows are compact Rust-name sequence mappings without leading MVS context", () => {
  const normalized = normalizeParticlePayload(particlePayload, catalogues);
  assert.equal(normalized.schema, "zvvnmod-utn57-particles-v3");
  assert.equal(normalized.mappings.length, 47);
  for (const row of normalized.mappings) {
    assert.deepEqual(Object.keys(row).sort(), ROW_KEYS);
    assert.equal(row.pattern.startsWith("mvs "), false);
    assert.equal(row.targets.includes("MVS"), false);
    assert.equal(row.sources.some((value) => value.startsWith("U+")), false);
    assert.ok(row.sources.length || row.targets.length);
  }

  const sample = normalized.mappings.find((row) => row.id === "particle:07");
  assert.deepEqual(sample, {
    id: "particle:07",
    pattern: "i y a r",
    particleIndices: [0, 1],
    sources: ["I_INIT", "I_MEDI", "A_MEDI", "R_FINA"],
    targets: ["I:init", "I:medi", "A:medi", "R:fina"],
    note: "",
  });
});

test("particle edits preserve independent ordered sequences with unequal lengths", () => {
  const baseline = particlePayload.mappings.find((row) => row.id === "particle:07");
  const edited = updateParticleEntry(
    baseline,
    ["I_INIT", "A_MEDI"],
    ["I:init", "I:medi", "A:medi", "R:fina", "A:fina"],
    "many-to-many review",
  );
  assert.deepEqual(edited.sources, ["I_INIT", "A_MEDI"]);
  assert.deepEqual(edited.targets, ["I:init", "I:medi", "A:medi", "R:fina", "A:fina"]);
  assert.equal(edited.note, "many-to-many review");
});

test("particle mode is derived from the Git baseline and is not serialized", () => {
  const baseline = particlePayload.mappings[0];
  assert.equal(particleMode(baseline, baseline), "direct");
  const edited = updateParticleEntry(baseline, ["A_INIT"], baseline.targets, "");
  assert.equal(particleMode(baseline, edited), "special");
  assert.equal(Object.hasOwn(edited, "mode"), false);
});

test("particle normalization rejects unknown constants, targets, and both-empty rows", () => {
  const unknownSource = structuredClone(particlePayload);
  unknownSource.mappings[0].sources = ["UNKNOWN_CONST"];
  assert.throws(() => normalizeParticlePayload(unknownSource, catalogues), /unknown ZVVNMOD source/);

  const unknownTarget = structuredClone(particlePayload);
  unknownTarget.mappings[0].targets = ["Unknown:medi"];
  assert.throws(() => normalizeParticlePayload(unknownTarget, catalogues), /unknown UTN57 target/);

  const empty = structuredClone(particlePayload);
  empty.mappings[0].sources = [];
  empty.mappings[0].targets = [];
  assert.throws(() => normalizeParticlePayload(empty, catalogues), /both sides empty/);
});

test("particle schema is fail-closed and validates adjusted context indices", () => {
  const legacyField = structuredClone(particlePayload);
  legacyField.mappings[0].rawZvvnmodCodes = [];
  assert.throws(() => normalizeParticlePayload(legacyField, catalogues), /unexpected fields/);

  const invalidIndex = structuredClone(particlePayload);
  invalidIndex.mappings[3].particleIndices = [99];
  assert.throws(() => normalizeParticlePayload(invalidIndex, catalogues), /particleIndices/);
});

test("particle scaffold permits sequence and note edits but rejects identity/context changes", () => {
  const edited = structuredClone(particlePayload);
  edited.mappings[6] = updateParticleEntry(
    edited.mappings[6],
    ["I_INIT"],
    ["I:init", "R:fina"],
    "reviewed",
  );
  assert.equal(hasSameParticleScaffold(particlePayload, edited), true);

  const changedPattern = structuredClone(edited);
  changedPattern.mappings[6].pattern = "tampered";
  assert.equal(hasSameParticleScaffold(particlePayload, changedPattern), false);

  const changedIndices = structuredClone(edited);
  changedIndices.mappings[6].particleIndices = [0];
  assert.equal(hasSameParticleScaffold(particlePayload, changedIndices), false);
});

test("particle normalization preserves variable-length compact mappings", () => {
  const edited = structuredClone(particlePayload);
  edited.mappings[6] = updateParticleEntry(
    edited.mappings[6],
    ["I_INIT"],
    ["I:init", "I:medi", "R:fina"],
    "reviewed",
  );
  const normalized = normalizeParticlePayload(edited, catalogues);
  assert.deepEqual(normalized.mappings[6].sources, ["I_INIT"]);
  assert.deepEqual(normalized.mappings[6].targets, ["I:init", "I:medi", "R:fina"]);
});
