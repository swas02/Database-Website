// Reads data/team.csv and writes the "members" list of data/team.json (the "lead" entry is left alone).
// Usage: npm run update-teams    (or: node tools/team_csv_to_json.mjs [file.csv])
// Columns: name, role, from, to, focus, tags (separated by ;), photo, link, then one column per social
// network (linkedin, scholar, github, website, x, facebook, instagram, youtube, email). Empty cells are skipped.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.resolve(process.argv[2] || path.join(root, "data", "team.csv"));
const jsonPath = path.join(root, "data", "team.json");
const SOCIAL = ["linkedin", "scholar", "github", "website", "x", "facebook", "instagram", "youtube", "email"];

// Minimal RFC 4180 parser: quoted cells may contain commas, quotes ("") and line breaks.
function parseCsv(text) {
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

if (!fs.existsSync(csvPath)) { console.error(`Not found: ${csvPath}`); process.exit(1); }
const [header, ...rows] = parseCsv(fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, ""));   // strip the BOM Excel adds
const cols = header.map((h) => h.trim().toLowerCase());
if (!cols.includes("name")) { console.error('The CSV needs a "name" column.'); process.exit(1); }

const members = rows.map((r, n) => {
  const get = (k) => (r[cols.indexOf(k)] ?? "").trim();
  if (!get("name")) { console.warn(`Row ${n + 2}: no name, skipped`); return null; }
  const m = { name: get("name"), role: get("role") };
  for (const k of ["from", "to", "focus"]) if (get(k)) m[k] = get(k);
  const tags = get("tags").split(/[;|]/).map((t) => t.trim()).filter(Boolean);
  if (tags.length) m.tags = tags;
  for (const k of ["photo", "link"]) if (get(k)) m[k] = get(k);
  const social = {};
  // known networks first, then any other extra column the sheet has
  for (const k of [...SOCIAL, ...cols.filter((c) => c.startsWith("social_")).map((c) => c.slice(7))]) {
    const v = get(k) || get("social_" + k);
    if (v) social[k] = v;
  }
  if (Object.keys(social).length) m.social = social;
  return m;
}).filter(Boolean);

const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
data.members = members;
delete data._note;
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + "\n");
console.log(`team: ${members.length} members written to ${path.relative(root, jsonPath)}`);
