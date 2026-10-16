import { awards } from "../data/publications.js";

// Award cards on the home page, built from data/research.json. The section stays hidden when there are no awards.
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const MAX = 6;   // more than this live on the Research page

const section = document.getElementById("awards");
const host = document.getElementById("award-cards");
if (section && host && awards.length) {
  host.innerHTML = awards.slice(0, MAX).map((a) => {
    const media = a.image
      ? `<img src="${esc(a.image)}" alt="${esc(a.title)}" loading="lazy">`
      : `<span class="award-event">${esc(a.event || a.year)}</span>`;
    return `<li class="award-card reveal">
      <div class="award-media">${media}</div>
      <div class="award-body">
        <p class="award-meta">${esc(a.event && String(a.event).includes(String(a.year)) ? a.event : (a.event ? a.event + " \u00b7 " : "") + a.year)}</p>
        <h3>${esc(a.title)}</h3>
        ${a.detail ? `<p class="award-detail">${esc(a.detail)}</p>` : ""}
      </div>
    </li>`;
  }).join("");
  host.querySelectorAll(".award-media img").forEach((img) => {
    const mark = () => img.classList.toggle("landscape", img.naturalWidth > img.naturalHeight);
    img.complete ? mark() : img.addEventListener("load", mark);
  });
  section.querySelector(".plain-more").hidden = awards.length <= MAX;
  section.hidden = false;
}
