import { publications, awards, projects, metaHtml } from "../data/publications.js";

const TYPES = { journal: "Journal papers", conference: "Conference papers", chapter: "Book chapters" };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let active = "all";

function titleHtml(item) {
  const t = esc(item.title);
  return item.link ? `<a href="${esc(item.link)}" target="_blank" rel="noopener noreferrer">${t}</a>` : t;
}

function renderPublications() {
  const list = publications.filter((p) => active === "all" || p.type === active).sort((a, b) => b.year - a.year);   // latest year first; within a year, keeps the order of data/research.json
  const host = document.getElementById("pub-list");
  if (!list.length) { host.innerHTML = '<p class="pub-empty">Publications will be listed here soon.</p>'; return; }
  const years = [...new Set(list.map((p) => p.year))];
  host.innerHTML = years.map((y) => `
    <div class="pub-year">
      <h3>${y}</h3>
      <ul>${list.filter((p) => p.year === y).map((p) => `
        <li>
          <span class="pub-title">${titleHtml(p)}</span>
          <span class="pub-meta">${metaHtml(p, false)}</span>
        </li>`).join("")}
      </ul>
    </div>`).join("");
}

function renderFilters() {
  const present = Object.keys(TYPES).filter((t) => publications.some((p) => p.type === t));
  const host = document.getElementById("pub-filters");
  host.innerHTML = [["all", `All (${publications.length})`], ...present.map((t) => [t, `${TYPES[t]} (${publications.filter((p) => p.type === t).length})`])]
    .map(([k, label]) => `<button type="button" class="filter-chip${k === active ? " active" : ""}" data-type="${k}">${label}</button>`).join("");
  host.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { active = b.dataset.type; renderFilters(); renderPublications(); }));
}

function renderAwards() {
  const host = document.getElementById("award-list");
  if (!awards.length) { host.innerHTML = '<li class="pub-empty">Awards will be listed here soon.</li>'; return; }
  host.innerHTML = awards.map((a) => `
    <li><span class="award-year">${a.year}</span>
      <div><span class="pub-title">${titleHtml(a)}</span>${a.detail ? `<span class="pub-meta">${esc(a.detail)}</span>` : ""}</div>
      ${a.image ? `<img class="award-photo" src="${esc(a.image)}" alt="${esc(a.title)}" loading="lazy">` : ""}
    </li>`).join("");
}

function renderProjects() {
  const host = document.getElementById("project-list");
  if (!projects.length) { host.innerHTML = '<li class="pub-empty">Projects will be listed here soon.</li>'; return; }
  host.innerHTML = projects.map((p, i) => `
    <li>
      <h3>${titleHtml(p)}</h3>
      ${(p.sponsors || []).length ? `<span class="project-tag">Sponsored by</span><ul class="sponsor-chips" aria-label="Sponsors">${p.sponsors.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
      ${String(p.page ?? "").trim() ? `<a class="project-link" href="${esc(String(p.page).trim())}">Read more <span aria-hidden="true">&rarr;</span></a>` : ""}
    </li>`).join("");
}

renderProjects();
renderFilters();
renderPublications();
renderAwards();
