import { publications, projects } from "../data/publications.js";

// Projects and publications grow independently, so each block shows only its newest few and links to the full list.
const MAX_PROJECTS = 3;
const MAX_PUBS = 3;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const soon = (what) => `<li class="pub-empty">${what} will be listed here soon.</li>`;

// ── Projects: in the order of data/research.json ──
// Wide screens (3 cards fit in a row): the first three show, the third fading out to the right with a ">" button
// that opens the full list. Narrower screens: every project sits in a horizontal slider with arrows. (See css.)
const projHost = document.getElementById("rs-projects");
if (projHost) {
  projHost.innerHTML = projects.length ? projects.map((p) => {
    const page = String(p.page ?? "").trim();
    return `<li>
      <h4>${esc(p.title)}</h4>
      ${(p.sponsors || []).length ? `<span class="rs-meta">${p.sponsors.map(esc).join(" · ")}</span>` : ""}
      ${page ? `<a class="project-link" href="${esc(page)}">Read more <span aria-hidden="true">&rarr;</span></a>` : ""}
    </li>`;
  }).join("") : soon("Projects");

  const slider = document.getElementById("rs-slider");
  const prev = slider.querySelector(".rs-prev");
  const next = slider.querySelector(".rs-next");
  const all = slider.querySelector(".rs-all");
  const many = projects.length > MAX_PROJECTS;
  slider.classList.toggle("rs-many", many);
  all.hidden = !many;                          // wide-screen ">" (hidden by css on the slider layout)
  const step = () => (projHost.firstElementChild ? projHost.firstElementChild.offsetWidth + 20 : 300);
  const sync = () => {                         // slider arrows: only when the cards overflow
    const overflow = projHost.scrollWidth > projHost.clientWidth + 2;
    prev.hidden = next.hidden = !overflow;
    prev.disabled = projHost.scrollLeft <= 2;
    next.disabled = projHost.scrollLeft + projHost.clientWidth >= projHost.scrollWidth - 2;
  };
  prev.addEventListener("click", () => projHost.scrollBy({ left: -step(), behavior: "smooth" }));
  next.addEventListener("click", () => projHost.scrollBy({ left: step(), behavior: "smooth" }));
  projHost.addEventListener("scroll", sync, { passive: true });
  window.addEventListener("resize", sync);
  sync();
}

// ── Publications: newest year first. When there are more than MAX_PUBS, the last row is shown faded out
// and a "N more" link takes over, so the list reads as continuing. ──
const pubHost = document.getElementById("rs-pubs");
if (pubHost) {
  const sorted = [...publications].sort((a, b) => b.year - a.year);
  const latest = sorted.slice(0, MAX_PUBS);
  const teased = sorted.length > MAX_PUBS;
  pubHost.innerHTML = latest.length ? latest.map((p, i) => {
    const t = p.link ? `<a href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">${esc(p.title)}</a>` : esc(p.title);
    const fade = teased && i === latest.length - 1 ? ' class="rs-fade" aria-hidden="true"' : "";
    return `<li${fade}><span class="rs-year">${esc(p.year)}</span><div><span class="pub-title">${t}</span><span class="pub-meta">${esc(p.venue)}</span></div></li>`;
  }).join("") : soon("Publications");
  if (teased) {
    const more = sorted.length - (MAX_PUBS - 1);   // the faded row counts as one of the "more"
    pubHost.insertAdjacentHTML("afterend", `<a class="rs-more" href="research.html#publications">${more} more publications <span aria-hidden="true">&rarr;</span></a>`);
  }
}
