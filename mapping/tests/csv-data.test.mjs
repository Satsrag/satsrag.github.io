import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { applyRuntimeRelations, normalizeCombinedPayload } from "../combined-workbench-model.mjs";
import {
  mappingPayloadFromCsv,
  particlePayloadFromCsv,
  runtimeMappingFromCsv,
  serializeRuntimeMappingCsv,
  targetCatalogueFromCsv,
} from "../csv-data.mjs";

import { editableSourceCatalogue } from "../workbench-model.mjs";

const read = (name) => readFile(new URL(`../data/${name}`, import.meta.url), "utf8");

test("production CSV assets preserve ordered variable-length relations", async () => {
  const mapping = mappingPayloadFromCsv(await read("zvvnmod-utn57-main.csv"));
  const particles = particlePayloadFromCsv(await read("zvvnmod-utn57-particles.csv"));
  const targets = targetCatalogueFromCsv(await read("utn57-written-units.csv"));
  assert.equal(mapping.mappings.length, 105);
  assert.equal(particles.mappings.length, 47);
  assert.equal(targets.length, 97);
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
});

test("download CSV is the combined non-empty runtime relation artifact", async () => {
  const mapping = mappingPayloadFromCsv(await read("zvvnmod-utn57-main.csv"));
  const particleMappings = particlePayloadFromCsv(await read("zvvnmod-utn57-particles.csv"));
  const baseline = `sha256:${"a".repeat(64)}`;
  const csv = serializeRuntimeMappingCsv({ baseline, mapping, particleMappings });
  const runtime = runtimeMappingFromCsv(csv, { expectedBaseline: baseline });
  assert.equal(runtime.mappings.length, 145);
  assert.equal(runtime.mappings.filter((row) => row.id.startsWith("particle:")).length, 47);
  assert.ok(runtime.mappings.every((row) => row.sources.length && row.targets.length));
  assert.equal(runtime.mappings.some((row) => row.id === "source:IR_FINA"), false);

  const checkedCsv = await read("zvvnmod-utn57-map.csv");
  const checked = runtimeMappingFromCsv(checkedCsv);
  assert.equal(
    serializeRuntimeMappingCsv({ baseline: checked.baseline, mapping, particleMappings }),
    checkedCsv,
  );

  const sources = editableSourceCatalogue(JSON.parse(await read("zvvnmod-codes.json")));
  const targets = targetCatalogueFromCsv(await read("utn57-written-units.csv"));
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
    () => particlePayloadFromCsv("id,pattern,particleIndices,sources,targets,note\n"),
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
  const particles = await read("zvvnmod-utn57-particles.csv");
  assert.throws(
    () => particlePayloadFromCsv(particles.replace(",0 1,", ",0 1x,")),
    /invalid particle index/,
  );
});
