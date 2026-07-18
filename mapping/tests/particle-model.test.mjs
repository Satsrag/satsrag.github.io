import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeParticlePayload } from "../particle-model.mjs";

const root = new URL("../../", import.meta.url);

async function currentPayload() {
  return JSON.parse(await readFile(new URL("mapping/data/zvvnmod-utn57-particles.json", root), "utf8"));
}

async function currentCatalogues() {
  const mapping = JSON.parse(await readFile(new URL("mapping/data/zvvnmod-utn57-map.json", root), "utf8"));
  return {
    sourceIds: new Set(mapping.sources.map((source) => source.id)),
    targetIds: new Set(["MVS", ...mapping.targets.map((target) => target.id)]),
  };
}

test("normalizes the generated 47-row particle payload", async () => {
  const payload = await currentPayload();
  const normalized = normalizeParticlePayload(payload, await currentCatalogues());

  assert.equal(normalized.mappings.length, 47);
  assert.equal(normalized.mappings.filter((row) => row.ambiguous).length, 10);
  assert.deepEqual(
    normalized.mappings.find((row) => row.pattern === "mvs i").utn57Shapes,
    ["MVS", "I:isol"],
  );
});

test("rejects unknown fields and catalogue IDs", async () => {
  const payload = await currentPayload();
  const catalogues = await currentCatalogues();

  const extra = structuredClone(payload);
  extra.mappings[0].html = "<img src=x onerror=alert(1)>";
  assert.throws(() => normalizeParticlePayload(extra, catalogues), /unexpected fields/);

  const unknownSource = structuredClone(payload);
  unknownSource.mappings[0].zvvnmodCodes[0] = "U+FFFF";
  assert.throws(() => normalizeParticlePayload(unknownSource, catalogues), /unknown ZVVNMOD code/);

  const unknownTarget = structuredClone(payload);
  unknownTarget.mappings[0].utn57Shapes[0] = "Unknown:isol";
  assert.throws(() => normalizeParticlePayload(unknownTarget, catalogues), /unknown UTN57 shape/);
});

test("rejects legacy controls, empty sequences, and incorrect ambiguity flags", async () => {
  const payload = await currentPayload();
  const catalogues = await currentCatalogues();

  const legacy = structuredClone(payload);
  legacy.mappings[0].zvvnmodCodes[0] = "U+E143";
  assert.throws(() => normalizeParticlePayload(legacy, catalogues), /legacy control/);

  const empty = structuredClone(payload);
  empty.mappings[0].utn57Shapes = [];
  assert.throws(() => normalizeParticlePayload(empty, catalogues), /cannot be empty/);

  const wrongAmbiguity = structuredClone(payload);
  const ambiguous = wrongAmbiguity.mappings.find((row) => row.ambiguous);
  ambiguous.ambiguous = false;
  assert.throws(() => normalizeParticlePayload(wrongAmbiguity, catalogues), /ambiguity flag/);
});
