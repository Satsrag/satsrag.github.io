import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  hasSameParticleScaffold,
  normalizeParticlePayload,
  serializeParticlePayload,
  updateParticleEntry,
} from "../particle-model.mjs";

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

test("normalizes semantic ZVVNMOD slots aligned with all 47 UTN57 particle sequences", async () => {
  const payload = await currentPayload();
  const normalized = normalizeParticlePayload(payload, await currentCatalogues());

  assert.equal(normalized.schema, "zvvnmod-utn57-particles-v2");
  assert.equal(normalized.mappings.length, 47);
  const direct = normalized.mappings.find((row) => row.pattern === "u u");
  assert.deepEqual(direct.zvvnmodCodes, ["U+E001", "U+E011"]);
  assert.deepEqual(direct.utn57Shapes, ["O:init", "U:fina"]);
  assert.equal(direct.mode, "direct");

  const unresolved = normalized.mappings.find((row) => row.pattern === "mvs i");
  assert.deepEqual(unresolved.zvvnmodCodes, [null, "U+E01A"]);
  assert.deepEqual(unresolved.utn57Shapes, ["MVS", "I:isol"]);
  assert.equal(unresolved.mode, "unmapped");
});

test("fills or clears individual ZVVNMOD slots without changing the UTN57 sequence", async () => {
  const payload = normalizeParticlePayload(await currentPayload(), await currentCatalogues());
  const row = payload.mappings.find((entry) => entry.pattern === "mvs i");
  const filled = updateParticleEntry(row, ["U+E000", "U+E01A"], "manual MVS correspondence");

  assert.deepEqual(filled.zvvnmodCodes, ["U+E000", "U+E01A"]);
  assert.deepEqual(filled.utn57Shapes, ["MVS", "I:isol"]);
  assert.equal(filled.mode, "special");
  assert.equal(filled.note, "manual MVS correspondence");

  const restored = updateParticleEntry(filled, filled.defaultZvvnmodCodes, "");
  assert.deepEqual(restored.zvvnmodCodes, [null, "U+E01A"]);
  assert.equal(restored.mode, "unmapped");
});

test("rejects malformed slots, unknown IDs, legacy controls, and changed alignment length", async () => {
  const payload = await currentPayload();
  const catalogues = await currentCatalogues();

  const extra = structuredClone(payload);
  extra.mappings[0].html = "<img src=x onerror=alert(1)>";
  assert.throws(() => normalizeParticlePayload(extra, catalogues), /unexpected fields/);

  const unknown = structuredClone(payload);
  unknown.mappings[0].zvvnmodCodes[0] = "U+FFFF";
  assert.throws(() => normalizeParticlePayload(unknown, catalogues), /unknown ZVVNMOD code/);

  const legacy = structuredClone(payload);
  legacy.mappings[0].zvvnmodCodes[0] = "U+E143";
  assert.throws(() => normalizeParticlePayload(legacy, catalogues), /legacy control/);

  const short = structuredClone(payload);
  short.mappings[0].zvvnmodCodes.pop();
  assert.throws(() => normalizeParticlePayload(short, catalogues), /one ZVVNMOD slot per UTN57 shape/);

  const wrongMode = structuredClone(payload);
  wrongMode.mappings[0].mode = "special";
  assert.throws(() => normalizeParticlePayload(wrongMode, catalogues), /mode must be direct/);
});

test("particle scaffold permits slot and note edits but rejects generated changes", async () => {
  const source = normalizeParticlePayload(await currentPayload(), await currentCatalogues());
  const edited = structuredClone(source);
  edited.mappings[0] = updateParticleEntry(
    edited.mappings[0],
    edited.mappings[0].zvvnmodCodes.map((code) => code || "U+E000"),
    "reviewed",
  );
  assert.equal(hasSameParticleScaffold(source, edited), true);

  const changedDefault = structuredClone(edited);
  changedDefault.mappings[0].defaultZvvnmodCodes[0] = null;
  assert.equal(hasSameParticleScaffold(source, changedDefault), false);

  const changedTarget = structuredClone(edited);
  changedTarget.mappings[0].utn57Shapes[0] = "A:isol";
  assert.equal(hasSameParticleScaffold(source, changedTarget), false);
});

test("particle serialization round-trips nullable aligned slots", async () => {
  const catalogues = await currentCatalogues();
  const payload = normalizeParticlePayload(await currentPayload(), catalogues);
  const roundTrip = normalizeParticlePayload(JSON.parse(serializeParticlePayload(payload)), catalogues);
  assert.deepEqual(roundTrip, payload);
});
