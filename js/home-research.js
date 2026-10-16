import { publications, awards, metaHtml } from "../data/publications.js";

const pubs = publications;   // keeps the order of data/research.json
const awds = awards;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// Papers marked with a status (e.g. "Submitted") are listed but not counted as publications.
const published = pubs.filter((p) => !p.status);
const submitted = pubs.length - published.length;
const count = (type) => published.filter((p) => p.type === type).length;

// "6 publications (1 journal paper, 5 conference papers), 3 submitted and 2 awards."
const parts = [];   // each part: the highlighted phrase, plus optional detail in plain text
if (published.length) {
  const kinds = [];
  if (count("journal")) kinds.push(plural(count("journal"), "journal paper", "journal papers"));
  if (count("conference")) kinds.push(plural(count("conference"), "conference paper", "conference papers"));
  if (count("chapter")) kinds.push(plural(count("chapter"), "book chapter", "book chapters"));
  parts.push(`<mark>${plural(published.length, "publication", "publications")}</mark>` + (kinds.length ? ` (${kinds.join(", ")})` : ""));
}
if (submitted) parts.push(`<mark>${submitted} submitted</mark>`);
if (awds.length) parts.push(`<mark>${plural(awds.length, "award", "awards")}</mark>`);
const joinParts = (xs) => (xs.length < 3 ? xs.join(" and ") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
const summary = document.getElementById("research-summary");
if (summary && parts.length) {
  summary.innerHTML = joinParts(parts) + ".";   // only counts and fixed words go in, nothing from the data text
  summary.hidden = false;
}

// ── Publications: all papers, three at a time ──
// The down arrow replaces the current batch with the next one in place (nothing scrolls or moves);
// the up arrow goes back. Papers keep the order of data/publications.js.
const PAGE = 3;
const box = document.querySelector("#papers .area-pubs");
if (box && pubs.length) {
  const list = box.querySelector("ul");
  const pager = box.querySelector(".pub-pager");
  const range = box.querySelector(".pub-range");
  const prev = box.querySelector(".pager-prev");
  const next = box.querySelector(".pager-next");
  const pages = Math.ceil(pubs.length / PAGE);
  let page = 0;

  const draw = () => {
    const from = page * PAGE;
    const slice = pubs.slice(from, from + PAGE);
    list.innerHTML = slice.map((p) => {
      const t = p.link ? `<a href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">${esc(p.title)}</a>` : esc(p.title);
      return `<li><span class="pub-title">${t}</span><span class="pub-meta">${metaHtml(p, true)}</span></li>`;
    }).join("");
    list.classList.remove("swap"); void list.offsetWidth; list.classList.add("swap");   // short fade-in on change
    range.textContent = `${from + 1}\u2013${from + slice.length} of ${pubs.length}`;
    prev.disabled = page === 0;
    next.disabled = page === pages - 1;
  };

  next.addEventListener("click", () => { page = Math.min(pages - 1, page + 1); draw(); });
  prev.addEventListener("click", () => { page = Math.max(0, page - 1); draw(); });
  pager.hidden = pages < 2;
  draw();
  box.hidden = false;
}
else {
  // No papers yet: keep the card visible with a short note instead of leaving the section empty.
  const empty = document.querySelector("#papers h3");
  if (empty) empty.insertAdjacentHTML("afterend", '<p class="pub-empty">Publications will be listed here soon.</p>');
}
