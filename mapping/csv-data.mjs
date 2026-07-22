function parseTable(text) {
  if (typeof text !== "string") throw new TypeError("CSV source must be text");
  const lines = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  let metadata = null;
  while (lines[0]?.startsWith("# ")) {
    const line = lines.shift();
    if (!line.startsWith("# metadata=")) throw new TypeError("unsupported CSV metadata line");
    if (metadata !== null) throw new TypeError("duplicate CSV metadata line");
    metadata = JSON.parse(line.slice("# metadata=".length));
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
  if (
    table.metadata?.schema !== "zvvnmod-utn57-runtime-map-v1"
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

export function particlePayloadFromCsv(text) {
  const table = parseTable(text);
  requireHeaders(
    table.headers,
    ["id", "pattern", "particleIndices", "sources", "targets", "note"],
    "particle",
  );
  if (
    !table.metadata
    || typeof table.metadata.schema !== "string"
    || typeof table.metadata.description !== "string"
    || !table.metadata.provenance
  ) {
    throw new TypeError("particle CSV metadata differs from schema");
  }
  return {
    ...table.metadata,
    mappings: table.rows.map((row) => ({
      id: row.id,
      pattern: row.pattern,
      particleIndices: particleIndices(row.particleIndices),
      sources: sequence(row.sources),
      targets: sequence(row.targets),
      note: row.note,
    })),
  };
}
