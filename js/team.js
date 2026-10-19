import team from "../data/team.json";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const initials = (name) => name.replace(/^(Prof|Dr)\.?\s+/i, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const byName = (a, b) => a.name.localeCompare(b.name);   // every list is shown alphabetically, whatever the order in data/team.json
const external = (url) => `href="${esc(url)}" target="_blank" rel="noopener noreferrer"`;

function portrait(m) {
  return m.photo
    ? `<img class="team-photo" src="${esc(m.photo)}" alt="${esc(m.name)}" loading="lazy">`
    : `<span class="team-mono" aria-hidden="true">${esc(initials(m.name))}</span>`;
}

function renderLead(l) {
  document.getElementById("team-lead").innerHTML = `
    <div class="team-lead-portrait reveal">${portrait(l)}</div>
    <div class="team-lead-body reveal">
      <p class="team-role">${esc(l.role)}</p>
      <h2 id="lead-name">${esc(l.name)}</h2>
      <p class="team-title">${esc(l.title)}</p>
      <div class="team-lead-actions">
        ${l.link ? `<a class="btn btn-dark" ${external(l.link)}>Faculty page</a>` : ""}
        ${socialLinks(l, true)}
      </div>
    </div>`;
}

// Display order, label and icon for the "social" object in data/team.json. LinkedIn comes first (preferred);
// any other key is still shown, after these, with a generic link icon.
const SOCIAL = {
  linkedin: ["LinkedIn", "bi-linkedin"], scholar: ["Google Scholar", "bi-mortarboard-fill"], github: ["GitHub", "bi-github"],
  website: ["Website", "bi-globe2"], x: ["X", "bi-twitter-x"], facebook: ["Facebook", "bi-facebook"],
  instagram: ["Instagram", "bi-instagram"], youtube: ["YouTube", "bi-youtube"], email: ["Email", "bi-envelope-fill"],
};
const socialRank = (k) => { const i = Object.keys(SOCIAL).indexOf(k); return i < 0 ? 99 : i; };

// asButtons: labelled outline buttons (professor block); otherwise a row of icons with the label as tooltip / screen-reader text.
function socialLinks(m, asButtons = false) {
  const links = Object.entries(m.social ?? {})
    .filter(([, v]) => v)
    .sort(([a], [b]) => socialRank(a) - socialRank(b))
    .map(([k, v]) => {
      const [label, icon] = SOCIAL[k] ?? [k.charAt(0).toUpperCase() + k.slice(1), "bi-link-45deg"];
      const href = k === "email" ? `href="mailto:${esc(v)}"` : external(v);
      return asButtons
        ? `<a class="btn btn-outline" ${href}>${label}</a>`
        : `<a class="team-icon" ${href} title="${label}" aria-label="${label}, ${esc(m.name)}"><i class="bi ${icon}" aria-hidden="true"></i></a>`;
    });
  return links.join("");
}

function tagList(m) {
  return m.tags?.length ? `<ul class="team-tags" aria-label="Research areas">${m.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "";
}

function period(m) {
  if (!m.from) return "";
  const to = !m.to || /^present$/i.test(m.to) ? "Present" : m.to;
  return `${esc(m.from)} to ${esc(to)}`;
}

function memberCard(m) {
  const name = m.link ? `<a ${external(m.link)}>${esc(m.name)}</a>` : esc(m.name);
  const when = period(m);
  const icons = socialLinks(m);
  return `
    <li class="team-card reveal">
      ${portrait(m)}
      <h3>${name}</h3>
      <p class="team-meta"><span class="team-role">${esc(m.role)}</span>${when ? `<span class="team-period">${when}</span>` : ""}</p>
      ${m.focus ? `<p class="team-focus">${esc(m.focus)}</p>` : ""}
      ${tagList(m)}
      ${icons ? `<div class="team-icons">${icons}</div>` : ""}
    </li>`;
}

function renderMembers(members) {
  if (!members.length) return;
  document.getElementById("team-members").innerHTML = `
    <section class="plain-section" aria-labelledby="team-heading">
      <div class="container">
        <h2 class="tiles-heading" id="team-heading">Team</h2>
        <ul class="team-grid">${[...members].sort(byName).map(memberCard).join("")}</ul>
      </div>
    </section>`;
}

renderLead(team.lead);
renderMembers(team.members);

// Same reveal-on-scroll behaviour as the home page, for the cards rendered above.
const items = document.querySelectorAll(".reveal");
if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
  items.forEach((el) => el.classList.add("in"));
} else {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  items.forEach((el, i) => { el.style.transitionDelay = (i % 4) * 70 + "ms"; io.observe(el); });
}
