#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  mappingPayloadFromCsv,
  particlePayloadFromCsv,
  serializeRuntimeMappingCsv,
  targetCatalogueFromCsv,
} from "../csv-data.mjs";
import { editableSourceCatalogue } from "../workbench-model.mjs";

const dataUrl = new URL("../data/", import.meta.url);
const read = (name) => readFile(new URL(name, dataUrl), "utf8");

const mapping = mappingPayloadFromCsv(await read("zvvnmod-utn57-main.csv"));
const particleMappings = particlePayloadFromCsv(await read("zvvnmod-utn57-particles.csv"));
const sources = editableSourceCatalogue(JSON.parse(await read("zvvnmod-codes.json")));
const targets = targetCatalogueFromCsv(await read("utn57-written-units.csv"));
const digest = createHash("sha256")
  .update(JSON.stringify({ mapping, particleMappings, sources, targets }))
  .digest("hex");
const baseline = `sha256:${digest}`;
const output = process.argv[2] ?? fileURLToPath(new URL("zvvnmod-utn57-map.csv", dataUrl));
const csv = serializeRuntimeMappingCsv({ baseline, mapping, particleMappings });
const relationCount = [...mapping.mappings, ...particleMappings.mappings]
  .filter((row) => row.sources.length && row.targets.length)
  .length;
await writeFile(output, csv, "utf8");
console.log(`generated ${relationCount} runtime relations -> ${output}`);
