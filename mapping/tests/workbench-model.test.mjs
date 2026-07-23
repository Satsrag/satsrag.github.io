import assert from "node:assert/strict";
import test from "node:test";

import {
  hasSameGeneratedScaffold,
  longestSourceMatches,
  mappingMode,
  normalizeMappingPayload,
  updateMappingEntry,
} from "../workbench-model.mjs";

import { mapping as fixture, mappingOptions, sources, targets } from "./fixtures.mjs";

const ROW_KEYS = ["id", "note", "sources", "targets"];

function assertCompactRow(row) {
  assert.deepEqual(Object.keys(row).sort(), ROW_KEYS);
  assert.equal(Object.hasOwn(row, "defaultSources"), false);
  assert.equal(Object.hasOwn(row, "defaultTargets"), false);
  assert.equal(Object.hasOwn(row, "mode"), false);
}

test("v3 uses Rust constants as ZVVNMOD IDs and compact mapping rows", () => {
  const normalized = normalizeMappingPayload(structuredClone(fixture), mappingOptions);
  assert.equal(normalized.schema, "zvvnmod-utn57-map-v3");
  assert.equal(sources[0].id, "A_INIT");
  assert.equal(sources[0].codepoint, "U+E000");
  assert.equal(Object.hasOwn(sources[0], "const"), false);
  assert.equal(normalized.mappings[0].id, "source:A_INIT");
  assert.deepEqual(normalized.mappings[0].sources, ["A_INIT"]);
  normalized.mappings.forEach(assertCompactRow);
});

test("editing both sides preserves independent ordered sequences of different lengths", () => {
  const row = fixture.mappings.find((entry) => entry.id === "target:A:isol");
  const edited = updateMappingEntry(
    row,
    ["A_INIT", "O_INIT", "I_MEDI"],
    ["A:isol"],
    "manual alignment",
  );
  assert.deepEqual(edited, {
    id: "target:A:isol",
    sources: ["A_INIT", "O_INIT", "I_MEDI"],
    targets: ["A:isol"],
    note: "manual alignment",
  });
});

test("mode is derived against the Git-loaded baseline and never serialized", () => {
  const direct = fixture.mappings.find((entry) => entry.id === "source:A_INIT");
  assert.equal(mappingMode(direct, direct), "direct");

  const rightOnly = fixture.mappings.find((entry) => entry.id === "target:Gx:init");
  assert.equal(mappingMode(rightOnly, rightOnly), "unmapped");

  const edited = updateMappingEntry(direct, ["O_INIT"], ["O:init"], "");
  assert.equal(mappingMode(direct, edited), "special");
  assertCompactRow(edited);
});

test("longest matching returns only all equal-longest mapping alternatives", () => {
  for (const [source, rowId] of [
    [["M_FINA", "AA_FINA"], "chachlag:M_FINA_AA_FINA"],
    [["L_FINA", "AA_FINA"], "chachlag:L_FINA_AA_FINA"],
    [["S_FINA", "AA_FINA"], "chachlag:S_FINA_AA_FINA"],
    [["R_FINA", "AA_FINA"], "chachlag:R_FINA_AA_FINA"],
  ]) {
    assert.deepEqual(longestSourceMatches(fixture.mappings, source).map((row) => row.id), [rowId]);
  }

  assert.deepEqual(
    longestSourceMatches(fixture.mappings, ["I_MEDI", "AA_FINA", "AA_FINA"]).map((row) => row.id),
    ["target:G:fina"],
  );
  assert.deepEqual(
    longestSourceMatches(fixture.mappings, ["AA_FINA", "AA_FINA"]).map((row) => row.id),
    ["source:AA_FINA"],
  );
  assert.deepEqual(
    longestSourceMatches(fixture.mappings, ["A_FINA", "AA_FINA"]).map((row) => row.id),
    ["source:A_FINA"],
  );

  const iIsol = longestSourceMatches(fixture.mappings, ["I_ISOL", "AA_FINA"]);
  assert.deepEqual(iIsol.map((row) => row.id), ["chachlag:I_ISOL_AA_FINA"]);

  const chachlag = longestSourceMatches(fixture.mappings, ["I_FINA", "AA_FINA"]);
  assert.deepEqual(chachlag.map((row) => row.id), ["chachlag:I_FINA_AA_FINA"]);

  const a = longestSourceMatches(fixture.mappings, ["A_INIT", "AA_FINA"]);
  assert.deepEqual(a.map((row) => row.id), ["target:A:isol"]);

  const aa = longestSourceMatches(fixture.mappings, ["AA_FINA"]);
  assert.deepEqual(aa.map((row) => row.id), ["source:AA_FINA"]);
});

test("normalization accepts left-only and right-only rows but rejects both empty", () => {
  const normalized = normalizeMappingPayload(structuredClone(fixture), mappingOptions);
  assert.ok(normalized.mappings.some((entry) => entry.sources.length === 0 && entry.targets.length));
  assert.ok(normalized.mappings.some((entry) => entry.sources.length && entry.targets.length === 0));

  const empty = structuredClone(fixture);
  empty.mappings[0].sources = [];
  empty.mappings[0].targets = [];
  assert.throws(() => normalizeMappingPayload(empty, mappingOptions), /both sides empty/i);
});

test("normalization rejects unknown Rust source constants and target IDs", () => {
  const unknownSource = structuredClone(fixture);
  unknownSource.mappings[0].sources = ["NOT_A_RUST_CONST"];
  assert.throws(() => normalizeMappingPayload(unknownSource, mappingOptions), /unknown ZVVNMOD source/i);

  const unknownTarget = structuredClone(fixture);
  unknownTarget.mappings[0].targets = ["Unknown:medi"];
  assert.throws(() => normalizeMappingPayload(unknownTarget, mappingOptions), /unknown UTN57 target/i);
});

test("target catalogue IDs are unique nonempty sequence tokens", () => {
  for (const invalidId of ["", "A target", "A\ttarget", "A\ntarget"]) {
    const invalidTargets = structuredClone(targets);
    invalidTargets[0].id = invalidId;
    assert.throws(
      () => normalizeMappingPayload(fixture, { ...mappingOptions, targets: invalidTargets }),
      /invalid UTN57 target metadata/,
    );
  }

  const duplicateTargets = structuredClone(targets);
  duplicateTargets[1].id = duplicateTargets[0].id;
  assert.throws(
    () => normalizeMappingPayload(fixture, { ...mappingOptions, targets: duplicateTargets }),
    /duplicate UTN57 target/,
  );
});

test("normalization is fail-closed for compact schema fields and external catalogue order", () => {
  const extraMapping = structuredClone(fixture);
  extraMapping.mappings[0].mode = "direct";
  assert.throws(() => normalizeMappingPayload(extraMapping, mappingOptions), /mapping fields/i);

  const extraSources = structuredClone(sources);
  extraSources[0].const = "A_INIT";
  assert.throws(
    () => normalizeMappingPayload(fixture, { ...mappingOptions, sources: extraSources }),
    /source fields/i,
  );

  const sourceOrder = structuredClone(sources);
  sourceOrder[0].order = 99;
  assert.throws(
    () => normalizeMappingPayload(fixture, { ...mappingOptions, sources: sourceOrder }),
    /source order/i,
  );
});

test("Git baseline scaffold permits value edits but rejects row identity changes", () => {
  const override = structuredClone(fixture);
  override.mappings[0] = updateMappingEntry(
    override.mappings[0],
    ["O_INIT", "I_MEDI"],
    ["Hx:medi"],
    "reviewed",
  );
  assert.equal(hasSameGeneratedScaffold(fixture, override), true);

  const changedId = structuredClone(override);
  changedId.mappings[0].id = "source:O_INIT";
  assert.equal(hasSameGeneratedScaffold(fixture, changedId), false);

  const reordered = structuredClone(override);
  [reordered.mappings[0], reordered.mappings[1]] = [reordered.mappings[1], reordered.mappings[0]];
  assert.equal(hasSameGeneratedScaffold(fixture, reordered), false);
});

test("normalization preserves compact variable-length alignments", () => {
  const payload = normalizeMappingPayload(structuredClone(fixture), mappingOptions);
  payload.mappings[0] = updateMappingEntry(
    payload.mappings[0],
    ["A_INIT", "O_INIT"],
    ["A:init"],
    "manual mapping",
  );
  const normalized = normalizeMappingPayload(payload, mappingOptions);
  assert.deepEqual(normalized.mappings[0], {
    id: "source:A_INIT",
    sources: ["A_INIT", "O_INIT"],
    targets: ["A:init"],
    note: "manual mapping",
  });
});
