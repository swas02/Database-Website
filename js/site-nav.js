/* Mobile menu for the shared site header.
   On phones the link row collapses behind a single button (see css/style.css). */
(function () {
  const header = document.querySelector(".site-header");
  const inner = header && header.querySelector(".header-inner");
  const nav = inner && inner.querySelector("nav");
  if (!nav) return;

  nav.id = nav.id || "site-nav";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "nav-toggle";
  btn.setAttribute("aria-label", "Menu");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", nav.id);
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>';
  inner.appendChild(btn);

  function setOpen(open) {
    header.classList.toggle("nav-open", open);
    btn.setAttribute("aria-expanded", String(open));
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(!header.classList.contains("nav-open"));
  });
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });
  document.addEventListener("click", (e) => {
    if (!header.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
  window.matchMedia("(min-width: 801px)").addEventListener("change", (e) => {
    if (e.matches) setOpen(false);
  });
})();
