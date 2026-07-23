import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { applyRuntimeRelations, normalizeCombinedPayload } from "../combined-workbench-model.mjs";
import {
  mappingPayloadFromCsv,
  mappingPayloadFromRuntime,
  particlePayloadFromCsv,
  runtimeMappingFromCsv,
  serializeRuntimeMappingCsv,
  targetCatalogueFromCsv,
} from "../csv-data.mjs";

import { editableSourceCatalogue } from "../workbench-model.mjs";

const read = (name) => readFile(new URL(`../data/${name}`, import.meta.url), "utf8");

test("runtime authority plus inventories derives the complete workbench", async () => {
  const runtime = runtimeMappingFromCsv(await read("zvvnmod-utn57-map.csv"));
  const sources = editableSourceCatalogue(JSON.parse(await read("zvvnmod-codes.json")));
  const targets = targetCatalogueFromCsv(await read("utn57-written-units.csv"));
  const mapping = mappingPayloadFromRuntime(runtime, sources, targets);
  const particleMetadata = await read("zvvnmod-utn57-particles.csv");
  const particles = particlePayloadFromCsv(particleMetadata, runtime.mappings);
  assert.match(particleMetadata.split("\n")[1], /^id,pattern,particleIndices$/);
  assert.equal(mapping.mappings.length, 105);
  assert.equal(particles.mappings.length, 47);
  assert.equal(targets.length, 97);
  assert.deepEqual(
    mapping.mappings.filter((row) => !row.sources.length || !row.targets.length).map((row) => row.id),
    [
      "source:IR_FINA",
      "target:Aa:fina",
      "target:Gx:init",
      "target:Gx:medi",
      "target:Ix:isol",
      "target:Sz:fina",
      "target:Ux:isol",
    ],
  );
  assert.deepEqual(
    particles.mappings.find((row) => row.id === "particle:37").sources,
    ["D_INIT", "A_MEDI", "I_MEDI", "AA_FINA"],
  );
  assert.deepEqual(targets.at(-1), {
    id: "MVS",
    unit: "MVS",
    position: "control",
    glyph: "᠎",
    order: 96,
  });

  const withoutAaFinal = {
    ...runtime,
    mappings: runtime.mappings.filter((row) => row.id !== "source:AA_FINA"),
  };
  const disabled = mappingPayloadFromRuntime(withoutAaFinal, sources, targets);
  assert.deepEqual(
    disabled.mappings.map((row) => row.id),
    mapping.mappings.map((row) => row.id),
  );
  assert.deepEqual(
    disabled.mappings.find((row) => row.id === "source:AA_FINA"),
    { id: "source:AA_FINA", sources: ["AA_FINA"], targets: [], note: "" },
  );
});

test("download CSV is the combined non-empty runtime relation artifact", async () => {
  const checkedCsv = await read("zvvnmod-utn57-map.csv");
  const checked = runtimeMappingFromCsv(checkedCsv);
  const sources = editableSourceCatalogue(JSON.parse(await read("zvvnmod-codes.json")));
  const targets = targetCatalogueFromCsv(await read("utn57-written-units.csv"));
  const mapping = mappingPayloadFromRuntime(checked, sources, targets);
  const particleMappings = particlePayloadFromCsv(
    await read("zvvnmod-utn57-particles.csv"),
    checked.mappings,
  );
  const baseline = `sha256:${"a".repeat(64)}`;
  const csv = serializeRuntimeMappingCsv({ baseline, mapping, particleMappings });
  const runtime = runtimeMappingFromCsv(csv, { expectedBaseline: baseline });
  assert.equal(runtime.mappings.length, 145);
  assert.equal(runtime.mappings.filter((row) => !row.id.startsWith("particle:")).length, 98);
  assert.equal(runtime.mappings.filter((row) => row.id.startsWith("particle:")).length, 47);
  assert.ok(runtime.mappings.every((row) => row.sources.length && row.targets.length));
  assert.equal(runtime.mappings.some((row) => row.id === "source:IR_FINA"), false);

  assert.equal(
    serializeRuntimeMappingCsv({ baseline: checked.baseline, mapping, particleMappings }),
    checkedCsv,
  );

  const source = normalizeCombinedPayload(
    {
      schema: "zvvnmod-utn57-workbench-v2",
      baseline: checked.baseline,
      mapping,
      particleMappings,
    },
    { sources, targets },
  );
  const imported = applyRuntimeRelations(source, checked.mappings, { sources, targets });
  assert.equal(serializeRuntimeMappingCsv(imported), checkedCsv);
});

test("CSV parser handles quoted commas and escaped quotes", () => {
  const payload = mappingPayloadFromCsv(
    '# metadata={"schema":"zvvnmod-utn57-map-v3","description":"test"}\n'
      + 'id,sources,targets,note\nrow,A_INIT,A:init,"reviewed, says ""yes"""\n',
  );
  assert.equal(payload.mappings[0].note, 'reviewed, says "yes"');
});

test("CSV loaders reject width, header, metadata, quoting, and sequence drift", async () => {
  const metadata = '# metadata={"schema":"x","description":"x"}\n';
  assert.throws(
    () => mappingPayloadFromCsv(`${metadata}id,sources,targets,note\nrow,A_INIT,A:init,,extra\n`),
    /wrong width/,
  );
  assert.throws(
    () => targetCatalogueFromCsv("unit,id,position,glyph\nA,A:isol,isol,A\n"),
    /headers differ/,
  );
  assert.throws(
    () => particlePayloadFromCsv("id,pattern,particleIndices\n", []),
    /metadata differs/,
  );
  assert.throws(
    () => mappingPayloadFromCsv(`${metadata}id,sources,targets,note\nrow,A_INIT,A:init,"note"x\n`),
    /after quoted/,
  );
  assert.throws(
    () => mappingPayloadFromCsv(`${metadata}id,sources,targets,note\nrow,A_INIT,A:init,bad"note\n`),
    /quote in unquoted/,
  );
  assert.throws(
    () => mappingPayloadFromCsv(`${metadata}id,sources,targets,note\nrow,A_INIT  O_INIT,A:init,note\n`),
    /single spaces/,
  );
  const runtimeHeader = "id,sources,targets,note\nrow,A_INIT,A:init,\n";
  const baseline = `sha256:${"a".repeat(64)}`;
  for (const metadata of [
    JSON.stringify({ schema: "zvvnmod-utn57-runtime-map-v1", baseline, extra: true }),
    JSON.stringify({ schema: "zvvnmod-utn57-runtime-map-v1" }),
    JSON.stringify({ baseline, schema: "zvvnmod-utn57-runtime-map-v1" }),
    "[]",
    `{"schema":"zvvnmod-utn57-runtime-map-v1","schema":"zvvnmod-utn57-runtime-map-v1","baseline":"${baseline}"}`,
  ]) {
    assert.throws(
      () => runtimeMappingFromCsv(`# metadata=${metadata}\n${runtimeHeader}`),
      /metadata|canonical/,
    );
  }
  const particles = await read("zvvnmod-utn57-particles.csv");
  const runtime = runtimeMappingFromCsv(await read("zvvnmod-utn57-map.csv"));
  assert.throws(
    () => particlePayloadFromCsv(particles.replace(",0 1\n", ",0 1x\n"), runtime.mappings),
    /invalid particle index/,
  );
});
