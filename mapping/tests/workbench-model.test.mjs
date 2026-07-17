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

test("editing a target sequence marks a mapping as special and preserves order", () => {
  const source = fixture.mappings.find((entry) => entry.source[0] === "U+E000");
  const edited = updateMappingEntry(source, ["Hx:medi", "A:fina"], "exception");

  assert.deepEqual(edited.targets, ["Hx:medi", "A:fina"]);
  assert.equal(edited.mode, "special");
  assert.equal(edited.note, "exception");
});

test("restoring generated targets restores direct mode", () => {
  const source = fixture.mappings.find((entry) => entry.source[0] === "U+E079");
  const edited = updateMappingEntry(source, ["Hx:medi"], "temporary");
  const restored = updateMappingEntry(edited, source.defaultTargets, "");

  assert.deepEqual(restored.targets, ["B:init", "I:fina"]);
  assert.equal(restored.mode, "direct");
});

test("normalization rejects duplicate source keys and unknown targets", () => {
  const duplicate = structuredClone(fixture);
  duplicate.mappings[1].source = [...duplicate.mappings[0].source];
  assert.throws(() => normalizeMappingPayload(duplicate), /duplicate source sequence/i);

  const unknown = structuredClone(fixture);
  unknown.mappings[0].targets = ["Unknown:medi"];
  assert.throws(() => normalizeMappingPayload(unknown), /unknown UTN57 target/i);
});

test("normalization rejects an empty target catalogue", () => {
  const empty = structuredClone(fixture);
  empty.targets = [];
  empty.mappings.forEach((entry) => {
    entry.defaultTargets = [];
    entry.targets = [];
  });
  assert.throws(() => normalizeMappingPayload(empty), /at least one UTN57 target/i);
});

test("normalization rejects tampered target order metadata", () => {
  const reordered = structuredClone(fixture);
  reordered.targets[0].order = 99;
  assert.throws(() => normalizeMappingPayload(reordered), /target order/i);
});

test("normalization rejects a non-string mapping note", () => {
  const malformed = structuredClone(fixture);
  malformed.mappings[0].note = 42;
  assert.throws(() => normalizeMappingPayload(malformed), /note must be a string/i);
});

test("normalization rejects unknown schema fields and scaffold locks root metadata", () => {
  const extraRoot = structuredClone(fixture);
  extraRoot.extra = true;
  assert.throws(() => normalizeMappingPayload(extraRoot), /root fields/i);

  const extraTarget = structuredClone(fixture);
  extraTarget.targets[0].extra = true;
  assert.throws(() => normalizeMappingPayload(extraTarget), /target fields/i);

  const extraMapping = structuredClone(fixture);
  extraMapping.mappings[0].extra = true;
  assert.throws(() => normalizeMappingPayload(extraMapping), /mapping fields/i);

  const changedDescription = structuredClone(fixture);
  changedDescription.description = "tampered";
  const normalized = normalizeMappingPayload(changedDescription);
  assert.equal(hasSameGeneratedScaffold(fixture, normalized), false);
});

test("import scaffold comparison permits overrides but rejects generated metadata changes", () => {
  const override = structuredClone(fixture);
  override.mappings[0].targets = ["Hx:medi"];
  override.mappings[0].mode = "special";
  assert.equal(hasSameGeneratedScaffold(fixture, override), true);

  const renamed = structuredClone(override);
  renamed.mappings[0].sourceName = "tampered";
  assert.equal(hasSameGeneratedScaffold(fixture, renamed), false);

  const changedCatalogue = structuredClone(override);
  changedCatalogue.targets[0].glyph = "tampered";
  assert.equal(hasSameGeneratedScaffold(fixture, changedCatalogue), false);

  const reordered = structuredClone(override);
  [reordered.mappings[0], reordered.mappings[1]] = [reordered.mappings[1], reordered.mappings[0]];
  assert.equal(hasSameGeneratedScaffold(fixture, reordered), false);
});

test("download serialization round-trips a special mapping", () => {
  const payload = normalizeMappingPayload(structuredClone(fixture));
  payload.mappings[0] = updateMappingEntry(payload.mappings[0], ["Hx:medi"], "manual mapping");

  const roundTrip = normalizeMappingPayload(JSON.parse(serializeMappingPayload(payload)));
  assert.deepEqual(roundTrip.mappings[0].targets, ["Hx:medi"]);
  assert.equal(roundTrip.mappings[0].mode, "special");
  assert.equal(roundTrip.mappings[0].note, "manual mapping");
});
