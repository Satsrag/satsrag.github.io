import { readFile } from "node:fs/promises";

import {
  mappingPayloadFromCsv,
  particlePayloadFromCsv,
  targetCatalogueFromCsv,
} from "../csv-data.mjs";
import { editableSourceCatalogue } from "../workbench-model.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

export const mapping = mappingPayloadFromCsv(await read("../data/zvvnmod-utn57-main.csv"));
export const particleMappings = particlePayloadFromCsv(
  await read("../data/zvvnmod-utn57-particles.csv"),
);
export const sources = editableSourceCatalogue(
  JSON.parse(await read("../data/zvvnmod-codes.json")),
);
export const targets = targetCatalogueFromCsv(await read("../data/utn57-written-units.csv"));
export const mappingOptions = { sources, targets };
export const particleCatalogues = {
  sourceIds: new Set(sources.map((source) => source.id)),
  targetIds: new Set(targets.map((target) => target.id)),
};
