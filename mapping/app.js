const POSITIONS = ["isol", "init", "medi", "fina"];
const tableRows = () => [...document.querySelectorAll(".inventory-table tbody tr")];

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function codeCard(code) {
  return `<article class="code-card" data-search="${escapeHTML(`${code.name} ${code.codepoint} ${code.const}`.toLowerCase())}">
    <span class="z-glyph" aria-hidden="true">${String.fromCodePoint(code.value)}</span>
    <span class="code-meta">
      <span class="code-name">${escapeHTML(code.name)}</span>
      <span class="codepoint">${escapeHTML(code.codepoint)}</span>
      <span class="const-name">${escapeHTML(code.const)}</span>
    </span>
  </article>`;
}

function codeCell(codes) {
  if (!codes.length) return "";
  return `<div class="code-list">${codes.map(codeCard).join("")}</div>`;
}

function buildZvvnmodTable(payload) {
  const rows = payload.groups.map((group) => {
    const single = POSITIONS.map((position) => `<td class="z-cell">${codeCell(group.single[position])}</td>`).join("");
    const merged = POSITIONS.map((position) => `<td class="z-cell">${codeCell(group.merged[position])}</td>`).join("");
    return `<tr data-search="${escapeHTML(group.id.toLowerCase())}"><th scope="row">${escapeHTML(group.id)}</th>${single}${merged}<td class="z-cell">${codeCell(group.special)}</td></tr>`;
  }).join("");

  return `<table class="inventory-table zvvnmod-table" aria-label="ZVVNMOD code inventory">
    <thead>
      <tr><th rowspan="2">ID</th><th class="group-single" colspan="4">Single-code forms</th><th class="group-merged" colspan="4">Merged-code forms</th><th class="group-special" rowspan="2">Special</th></tr>
      <tr>${POSITIONS.map((position) => `<th>${position}</th>`).join("")}${POSITIONS.map((position) => `<th>${position}</th>`).join("")}</tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function normalizeInventoryRows() {
  document.querySelectorAll(".inventory-table tbody tr").forEach((row) => {
    row.dataset.search = row.textContent.toLowerCase();
  });
}

function applyFilter(query) {
  const normalized = query.trim().toLowerCase();
  const rows = tableRows();
  let visible = 0;
  rows.forEach((row) => {
    const match = !normalized || (row.dataset.search || row.textContent.toLowerCase()).includes(normalized);
    row.hidden = !match;
    if (match) visible += 1;
  });
  document.getElementById("clear-search").hidden = !normalized;
  document.getElementById("filter-status").textContent = normalized ? `Showing ${visible} matching rows` : `Showing all ${rows.length} rows`;
}

async function loadInventories() {
  const [utnResponse, zvvnmodResponse] = await Promise.all([
    fetch("data/utn57-written-units.html"),
    fetch("data/zvvnmod-codes.json")
  ]);
  if (!utnResponse.ok || !zvvnmodResponse.ok) throw new Error("Inventory data could not be loaded.");
  const [utnHTML, zvvnmod] = await Promise.all([utnResponse.text(), zvvnmodResponse.json()]);

  const utnContainer = document.getElementById("utn-table");
  const zvvnmodContainer = document.getElementById("zvvnmod-table");
  utnContainer.innerHTML = utnHTML;
  zvvnmodContainer.innerHTML = buildZvvnmodTable(zvvnmod);
  utnContainer.setAttribute("aria-busy", "false");
  zvvnmodContainer.setAttribute("aria-busy", "false");
  normalizeInventoryRows();
  applyFilter(document.getElementById("inventory-search").value);
}

const search = document.getElementById("inventory-search");
const clear = document.getElementById("clear-search");
search.addEventListener("input", () => applyFilter(search.value));
clear.addEventListener("click", () => {
  search.value = "";
  applyFilter("");
  search.focus();
});

loadInventories().catch((error) => {
  document.querySelectorAll(".table-shell[aria-busy='true']").forEach((container) => {
    container.innerHTML = `<p class="empty-state">${escapeHTML(error.message)}</p>`;
    container.setAttribute("aria-busy", "false");
  });
  document.getElementById("filter-status").textContent = "Inventory loading failed";
  console.error(error);
});
