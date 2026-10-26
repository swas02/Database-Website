// Loads the lab's research outputs from data/research.json (edit that file, not this one).
// Papers keep the order they have in the JSON; journals first, then conferences, then book chapters.
// Fetched as plain JSON (not imported as a module) so it also works on servers that send it as application/json.
const raw = await (await fetch(new URL("./research.json", import.meta.url))).json();

const tag = (list, type) => (list || []).map((p) => ({ ...p, type }));

export const publications = [
  ...tag(raw.journalPapers, "journal"),
  ...tag(raw.conferencePapers, "conference"),
  ...tag(raw.bookChapters, "chapter"),
];

export const projects = raw.projects || [];

export const awards = raw.awards || [];

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const endDot = (s) => String(s ?? "").trim().replace(/\.?$/, ".");

// "Authors. Venue (Submitted), 2027."  (the year is left out where it is already shown as a heading)
export function metaHtml(p, withYear) {
  const venue = esc(p.venue) + (p.status ? ` (${esc(p.status)})` : "");
  return `${esc(endDot(p.authors))} ${venue}${withYear ? ", " + esc(p.year) : ""}.`;
}
