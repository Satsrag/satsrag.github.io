import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  hasSameGeneratedScaffold,
  normalizeMappingPayload,
  serializeMappingPayload,
  updateMappingEntry,
} from "../workbench-model.mjs";

const fixture = JSON.parse(
  await readFile(new URL("../data/zvvnmod-utn57-map.json", import.meta.url), "utf8"),
);

test("editing both sides preserves ordered multi-code sequences", () => {
  const row = fixture.mappings.find((entry) => entry.id === "target:A:isol");
  const edited = updateMappingEntry(
    row,
    ["U+E000", "U+E001"],
    ["A:isol", "Aa:isol"],
    "manual alignment",
  );

  assert.deepEqual(edited.sources, ["U+E000", "U+E001"]);
  assert.deepEqual(edited.targets, ["A:isol", "Aa:isol"]);
  assert.equal(edited.mode, "special");
  assert.equal(edited.note, "manual alignment");
});

test("restoring both generated sides restores direct or unmapped mode", () => {
  const direct = fixture.mappings.find((entry) => entry.id === "source:U+E000");
  const edited = updateMappingEntry(direct, ["U+E001"], ["Hx:medi"], "temporary");
  const restored = updateMappingEntry(
    edited,
    direct.defaultSources,
    direct.defaultTargets,
    "",
  );
  assert.equal(restored.mode, "direct");

  const rightOnly = fixture.mappings.find((entry) => entry.id === "target:A:isol");
  const restoredRightOnly = updateMappingEntry(
    rightOnly,
    rightOnly.defaultSources,
    rightOnly.defaultTargets,
    "",
  );
  assert.deepEqual(restoredRightOnly.sources, []);
  assert.equal(restoredRightOnly.mode, "unmapped");
});

test("normalization accepts left-only and right-only rows", () => {
  const normalized = normalizeMappingPayload(structuredClone(fixture));
  assert.ok(normalized.mappings.some((entry) => entry.sources.length === 0 && entry.targets.length));
  assert.ok(normalized.mappings.some((entry) => entry.sources.length && entry.targets.length === 0));
});

test("normalization rejects a row with both current sides empty", () => {
  const empty = structuredClone(fixture);
  empty.mappings[0].sources = [];
  empty.mappings[0].targets = [];
  empty.mappings[0].mode = "special";
  assert.throws(() => normalizeMappingPayload(empty), /both sides empty/i);
});

test("normalization rejects unknown source and target IDs", () => {
  const unknownSource = structuredClone(fixture);
  unknownSource.mappings[0].sources = ["U+FFFF"];
  assert.throws(() => normalizeMappingPayload(unknownSource), /unknown ZVVNMOD source/i);

  const unknownTarget = structuredClone(fixture);
  unknownTarget.mappings[0].targets = ["Unknown:medi"];
  assert.throws(() => normalizeMappingPayload(unknownTarget), /unknown UTN57 target/i);
});

test("normalization rejects tampered catalogue order", () => {
  const sourceOrder = structuredClone(fixture);
  sourceOrder.sources[0].order = 99;
  assert.throws(() => normalizeMappingPayload(sourceOrder), /source order/i);

  const targetOrder = structuredClone(fixture);
  targetOrder.targets[0].order = 99;
  assert.throws(() => normalizeMappingPayload(targetOrder), /target order/i);
});

test("normalization rejects non-string notes and unknown schema fields", () => {
  const malformed = structuredClone(fixture);
  malformed.mappings[0].note = 42;
  assert.throws(() => normalizeMappingPayload(malformed), /note must be a string/i);

  const extraRoot = structuredClone(fixture);
  extraRoot.extra = true;
  assert.throws(() => normalizeMappingPayload(extraRoot), /root fields/i);

  const extraSource = structuredClone(fixture);
  extraSource.sources[0].extra = true;
  assert.throws(() => normalizeMappingPayload(extraSource), /source fields/i);

  const extraTarget = structuredClone(fixture);
  extraTarget.targets[0].extra = true;
  assert.throws(() => normalizeMappingPayload(extraTarget), /target fields/i);

  const extraMapping = structuredClone(fixture);
  extraMapping.mappings[0].extra = true;
  assert.throws(() => normalizeMappingPayload(extraMapping), /mapping fields/i);
});

test("import scaffold permits both-side overrides but rejects generated changes", () => {
  const override = structuredClone(fixture);
  override.mappings[0] = updateMappingEntry(
    override.mappings[0],
    ["U+E001", "U+E002"],
    ["Hx:medi"],
    "reviewed",
  );
  assert.equal(hasSameGeneratedScaffold(fixture, override), true);

  const changedSourceCatalogue = structuredClone(override);
  changedSourceCatalogue.sources[0].glyph = "tampered";
  assert.equal(hasSameGeneratedScaffold(fixture, changedSourceCatalogue), false);

  const changedTargetCatalogue = structuredClone(override);
  changedTargetCatalogue.targets[0].glyph = "tampered";
  assert.equal(hasSameGeneratedScaffold(fixture, changedTargetCatalogue), false);

  const changedDefaults = structuredClone(override);
  changedDefaults.mappings[0].defaultSources = ["U+E001"];
  assert.equal(hasSameGeneratedScaffold(fixture, changedDefaults), false);

  const reordered = structuredClone(override);
  [reordered.mappings[0], reordered.mappings[1]] = [reordered.mappings[1], reordered.mappings[0]];
  assert.equal(hasSameGeneratedScaffold(fixture, reordered), false);
});

test("download serialization round-trips a multi-code special alignment", () => {
  const payload = normalizeMappingPayload(structuredClone(fixture));
  payload.mappings[0] = updateMappingEntry(
    payload.mappings[0],
    ["U+E000", "U+E001"],
    ["A:init", "Aa:fina"],
    "manual mapping",
  );

  const roundTrip = normalizeMappingPayload(JSON.parse(serializeMappingPayload(payload)));
  assert.deepEqual(roundTrip.mappings[0].sources, ["U+E000", "U+E001"]);
  assert.deepEqual(roundTrip.mappings[0].targets, ["A:init", "Aa:fina"]);
  assert.equal(roundTrip.mappings[0].mode, "special");
  assert.equal(roundTrip.mappings[0].note, "manual mapping");
});
