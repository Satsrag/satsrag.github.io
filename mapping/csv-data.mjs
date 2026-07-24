function parseTable(text) {
  if (typeof text !== "string") throw new TypeError("CSV source must be text");
  const lines = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  let metadata = null;
  while (lines[0]?.startsWith("# ")) {
    const line = lines.shift();
    if (!line.startsWith("# metadata=")) throw new TypeError("unsupported CSV metadata line");
    if (metadata !== null) throw new TypeError("duplicate CSV metadata line");
    const metadataText = line.slice("# metadata=".length);
    metadata = JSON.parse(metadataText);
    if (JSON.stringify(metadata) !== metadataText) {
      throw new TypeError("CSV metadata must use canonical JSON without duplicate keys");
    }
  }
  const source = lines.join("\n");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let quoteClosed = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        quoteClosed = true;
      } else {
        field += character;
      }
    } else if (quoteClosed) {
      if (character === ",") {
        row.push(field);
        field = "";
        quoteClosed = false;
      } else if (character === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        quoteClosed = false;
      } else {
        throw new TypeError("unexpected character after quoted CSV field");
      }
    } else if (character === '"' && field === "") {
      quoted = true;
    } else if (character === '"') {
      throw new TypeError("quote in unquoted CSV field");
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new TypeError("unterminated quoted CSV field");
  if (field !== "" || row.length || quoteClosed) {
    row.push(field);
    rows.push(row);
  }
  while (rows.length && rows.at(-1).every((value) => value === "")) rows.pop();
  if (!rows.length) throw new TypeError("CSV must contain a header");
  const headers = rows.shift();
  if (new Set(headers).size !== headers.length) throw new TypeError("CSV headers must be unique");
  return {
    metadata,
    headers,
    rows: rows.map((values, index) => {
      if (values.length !== headers.length) throw new TypeError(`CSV row ${index} has the wrong width`);
      return Object.fromEntries(headers.map((header, fieldIndex) => [header, values[fieldIndex]]));
    }),
  };
}

function requireHeaders(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new TypeError(`${label} CSV headers differ from schema`);
  }
}

function sequence(value) {
  if (value === "") return [];
  const values = value.split(" ");
  if (values.some((item) => item === "")) {
    throw new TypeError("CSV sequences must use single spaces between values");
  }
  return values;
}

function particleIndices(value) {
  return sequence(value).map((item) => {
    if (!/^(0|[1-9][0-9]*)$/.test(item)) throw new TypeError("invalid particle index");
    return Number(item);
  });
}

export function mappingPayloadFromCsv(text) {
  const table = parseTable(text);
  requireHeaders(table.headers, ["id", "sources", "targets", "note"], "mapping");
  if (!table.metadata || typeof table.metadata.schema !== "string" || typeof table.metadata.description !== "string") {
    throw new TypeError("mapping CSV metadata differs from schema");
  }
  return {
    ...table.metadata,
    mappings: table.rows.map((row) => ({
      id: row.id,
      sources: sequence(row.sources),
      targets: sequence(row.targets),
      note: row.note,
    })),
  };
}

const MAIN_SCHEMA = "zvvnmod-utn57-map-v3";
const MAIN_DESCRIPTION = "Editable aligned Rust-named ZVVNMOD and UTN57 code sequences; either side may be empty or contain multiple codes.";
const POSITION_NAMES = new Map([["isol", "isol"], ["i", "init"], ["m", "medi"], ["f", "fina"]]);
const CANONICAL_SOURCE_TARGETS = new Map([
  ["AA_FINA", ["Aa:isol"]],
  ["N_AA_FINA", ["N:fina", "MVS", "Aa:isol"]],
  ["HX_AA_FINA", ["Hx:fina", "MVS", "Aa:isol"]],
]);
const POSITIONAL_ROWS = [
  [
    "context:A_MEDI_AA_FINA",
    ["A_MEDI", "AA_FINA"],
    ["Aa:fina"],
    "A_MEDI and AA_FINA jointly represent a connected Aa final.",
  ],
];
const CHACHLAG_ROWS = [
  ["chachlag:M_FINA_AA_FINA", ["M_FINA", "AA_FINA"], ["M:fina", "MVS", "Aa:isol"]],
  ["chachlag:L_FINA_AA_FINA", ["L_FINA", "AA_FINA"], ["L:fina", "MVS", "Aa:isol"]],
  ["chachlag:S_FINA_AA_FINA", ["S_FINA", "AA_FINA"], ["S:fina", "MVS", "Aa:isol"]],
  ["chachlag:R_FINA_AA_FINA", ["R_FINA", "AA_FINA"], ["R:fina", "MVS", "Aa:isol"]],
  ["chachlag:I_ISOL_AA_FINA", ["I_ISOL", "AA_FINA"], ["I:isol", "MVS", "Aa:isol"]],
  ["chachlag:I_FINA_AA_FINA", ["I_FINA", "AA_FINA"], ["I:fina", "MVS", "Aa:isol"]],
  ["chachlag:U_FINA_AA_FINA", ["U_FINA", "AA_FINA"], ["U:fina", "MVS", "Aa:isol"]],
  ["chachlag:H_FINA_AA_FINA", ["H_FINA", "AA_FINA"], ["H:fina", "MVS", "Aa:isol"]],
];
const CHACHLAG_NOTE = "UTN chachlag onset-plus-suffix shape alignment.";

function semanticTargets(source, validTargets) {
  const canonical = CANONICAL_SOURCE_TARGETS.get(source.id);
  if (canonical) return [...canonical];
  if (source.name === "Nirugu") return validTargets.has("Nirugu") ? ["Nirugu"] : [];
  const parts = source.name.split(" ");
  if (parts.length % 2) return [];
  const result = [];
  for (let index = 0; index < parts.length; index += 2) {
    const position = POSITION_NAMES.get(parts[index + 1]);
    const target = position ? `${parts[index]}:${position}` : "";
    if (!validTargets.has(target)) return [];
    result.push(target);
  }
  return result;
}

export function mappingScaffoldFromInventories(sources, targets) {
  const validTargets = new Set(targets.map((target) => target.id));
  const representedTargets = new Set();
  const mappings = sources.map((source) => {
    const targetSequence = semanticTargets(source, validTargets);
    targetSequence.forEach((target) => representedTargets.add(target));
    return { id: `source:${source.id}`, sources: [source.id], targets: targetSequence, note: "" };
  });
  for (const target of targets) {
    if (!representedTargets.has(target.id)) {
      mappings.push({ id: `target:${target.id}`, sources: [], targets: [target.id], note: "" });
    }
  }
  for (const [id, sourceSequence, targetSequence, note] of POSITIONAL_ROWS) {
    mappings.push({
      id,
      sources: [...sourceSequence],
      targets: [...targetSequence],
      note,
    });
  }
  for (const [id, sourceSequence, targetSequence] of CHACHLAG_ROWS) {
    mappings.push({
      id,
      sources: [...sourceSequence],
      targets: [...targetSequence],
      note: CHACHLAG_NOTE,
    });
  }
  return { schema: MAIN_SCHEMA, description: MAIN_DESCRIPTION, mappings };
}

export function mappingPayloadFromRuntime(runtime, sources, targets) {
  const runtimeMain = runtime.mappings.filter((row) => !row.id.startsWith("particle:"));
  const runtimeById = new Map(runtimeMain.map((row) => [row.id, row]));
  const scaffold = mappingScaffoldFromInventories(sources, targets).mappings;
  const scaffoldIds = new Set(scaffold.map((row) => row.id));
  if (runtimeMain.some((row) => !scaffoldIds.has(row.id))) {
    throw new TypeError("runtime mapping contains an unknown main relation ID");
  }
  const mappings = scaffold.map((row) => {
    const relation = runtimeById.get(row.id);
    if (relation) {
      return { ...relation, sources: [...relation.sources], targets: [...relation.targets] };
    }
    if (row.id.startsWith("target:")) return row;
    return { ...row, targets: [] };
  });
  return { schema: MAIN_SCHEMA, description: MAIN_DESCRIPTION, mappings };
}

export function targetCatalogueFromCsv(text) {
  const table = parseTable(text);
  requireHeaders(table.headers, ["id", "unit", "position", "glyph"], "target");
  if (table.metadata !== null) throw new TypeError("target CSV must not contain metadata");
  return table.rows.map((row, order) => ({ ...row, order }));
}

function quoteCsv(value) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeRuntimeMappingCsv({ baseline, mapping, particleMappings }) {
  if (typeof baseline !== "string" || !/^sha256:[0-9a-f]{64}$/.test(baseline)) {
    throw new TypeError("runtime mapping baseline must be a SHA-256 digest");
  }
  const relations = [...mapping.mappings, ...particleMappings.mappings].filter(
    (row) => row.sources.length && row.targets.length,
  );
  const ids = new Set();
  const lines = [
    `# metadata=${JSON.stringify({ schema: "zvvnmod-utn57-runtime-map-v1", baseline })}`,
    "id,sources,targets,note",
  ];
  for (const row of relations) {
    if (ids.has(row.id)) throw new TypeError(`duplicate runtime mapping ID: ${row.id}`);
    ids.add(row.id);
    lines.push(
      [row.id, row.sources.join(" "), row.targets.join(" "), row.note]
        .map(quoteCsv)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function runtimeMappingFromCsv(text, { expectedBaseline } = {}) {
  const table = parseTable(text);
  requireHeaders(table.headers, ["id", "sources", "targets", "note"], "runtime mapping");
  const metadataKeys =
    table.metadata && typeof table.metadata === "object" && !Array.isArray(table.metadata)
      ? Object.keys(table.metadata)
      : [];
  if (
    JSON.stringify(metadataKeys) !== JSON.stringify(["schema", "baseline"])
    || table.metadata.schema !== "zvvnmod-utn57-runtime-map-v1"
    || typeof table.metadata.baseline !== "string"
    || !/^sha256:[0-9a-f]{64}$/.test(table.metadata.baseline)
  ) {
    throw new TypeError("runtime mapping CSV metadata differs from schema");
  }
  if (expectedBaseline !== undefined && table.metadata.baseline !== expectedBaseline) {
    throw new TypeError("runtime mapping baseline does not match the loaded Git baseline");
  }
  const ids = new Set();
  const mappings = table.rows.map((row, index) => {
    if (!row.id || ids.has(row.id)) throw new TypeError(`invalid or duplicate runtime mapping ID at row ${index}`);
    ids.add(row.id);
    const sources = sequence(row.sources);
    const targets = sequence(row.targets);
    if (!sources.length || !targets.length) {
      throw new TypeError(`runtime mapping ${row.id} must have two non-empty sides`);
    }
    return { id: row.id, sources, targets, note: row.note };
  });
  return { ...table.metadata, mappings };
}

export function particlePayloadFromCsv(text, runtimeMappings) {
  const table = parseTable(text);
  requireHeaders(table.headers, ["id", "pattern", "particleIndices"], "particle");
  if (
    !table.metadata
    || typeof table.metadata.schema !== "string"
    || typeof table.metadata.description !== "string"
    || !table.metadata.provenance
  ) {
    throw new TypeError("particle CSV metadata differs from schema");
  }
  if (!Array.isArray(runtimeMappings)) {
    throw new TypeError("particle metadata requires runtime mappings");
  }
  const runtimeParticles = runtimeMappings.filter((row) => row.id.startsWith("particle:"));
  const runtimeById = new Map(runtimeParticles.map((row) => [row.id, row]));
  const metadataIds = table.rows.map((row) => row.id);
  if (
    new Set(metadataIds).size !== metadataIds.length
    || runtimeParticles.length !== metadataIds.length
    || metadataIds.some((id) => !runtimeById.has(id))
  ) {
    throw new TypeError("particle metadata and runtime relation IDs differ");
  }
  return {
    ...table.metadata,
    mappings: table.rows.map((row) => {
      const relation = runtimeById.get(row.id);
      return {
        id: row.id,
        pattern: row.pattern,
        particleIndices: particleIndices(row.particleIndices),
        sources: [...relation.sources],
        targets: [...relation.targets],
        note: relation.note,
      };
    }),
  };
}
