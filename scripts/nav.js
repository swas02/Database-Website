/* ── Shared Top Navigation Component ──────────────────────────────
   Renders the site header into any element marked with [data-topnav].

   Usage:
     <header id="hud-header" data-topnav data-active="viewer" data-root="./"></header>

   data-active : key of the current page — home | viewer | publications | software
                 (or blank for dropdown-only pages like About / Docs / Contact)
   data-root   : relative path from the current page to the site root
                 ("./" at root, "../" inside pages/)

   Also owns the site-wide handlers the nav needs (theme, dropdown,
   fullscreen) so standalone pages work without the viewer modules.
   ui.js redefines theme/dropdown identically on the viewer page. */

/* ── Top Navigation ───────────────────────────────────────────────
   Renders the site header into any element marked with [data-topnav].
   The site is a single page (the Dataset Viewer), so the header holds the
   brand, the viewer link and a small menu with theme and fullscreen.

   Also owns the theme / dropdown / fullscreen handlers
   (ui.js redefines theme/dropdown identically on the viewer page). */

// Imported so Vite emits it with its hashed name; a runtime path would 404 in the build.
import logoUrl from "../images/ssrr-logo.png";

(function () {
  function renderTopNav(host) {
    const root = host.dataset.root || "./";
    host.innerHTML = `
      <div class="site-header-inner">
        <a href="${root}index.html" class="site-logo" aria-label="SSRR Lab home">
          <img src="${logoUrl}" alt="SSRR Lab, IIT Bombay" height="48">
        </a>
        <span class="site-page-name"><a href="${root}datasets.html">Datasets</a> / Bridge model library</span>
        <nav aria-label="Main" class="site-links">
          <a href="${root}research.html">Research</a>
          <a href="${root}index.html#awards">Awards</a>
          <a href="${root}index.html#software">Software</a>
          <a href="${root}datasets.html" class="active">Datasets</a>
          <a href="${root}index.html#contact">Contact</a>
          <div class="nav-dropdown" id="more-menu">
            <button class="nav-dropdown-trigger" onclick="toggleDropdownMenu(event)" aria-label="More options" aria-haspopup="menu">
              <i class="bi bi-three-dots" aria-hidden="true"></i>
            </button>
            <div class="nav-dropdown-content" id="more-menu-content" role="menu">
              <a href="#" onclick="toggleAppFullscreen(event)">
                <i class="bi bi-arrows-fullscreen me-2" id="fullscreen-icon" aria-hidden="true"></i>
                <span id="fullscreen-text">Fullscreen</span>
              </a>
            </div>
          </div>
        </nav>
      </div>`;
  }

  // ── Dropdown ──
  window.toggleDropdownMenu = function (event) {
    event.stopPropagation();
    const dropdown = document.getElementById("more-menu-content");
    if (dropdown) dropdown.classList.toggle("show");
  };
  document.addEventListener("click", () => {
    const dropdown = document.getElementById("more-menu-content");
    if (dropdown && dropdown.classList.contains("show")) {
      dropdown.classList.remove("show");
    }
  });

  // ── Theme: light only ──
  document.documentElement.setAttribute("data-bs-theme", "light");

  // ── Fullscreen ──
  window.toggleAppFullscreen = function (event) {
    if (event) event.preventDefault();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        const icon = document.getElementById("fullscreen-icon");
        const text = document.getElementById("fullscreen-text");
        if (icon) icon.className = "bi bi-fullscreen-exit me-2";
        if (text) text.textContent = "Exit Fullscreen";
      }).catch(() => {});
    } else {
      document.exitFullscreen();
    }
  };
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      const icon = document.getElementById("fullscreen-icon");
      const text = document.getElementById("fullscreen-text");
      if (icon) icon.className = "bi bi-arrows-fullscreen me-2";
      if (text) text.textContent = "Fullscreen";
    }
  });

  // ── Render all placeholders (script is loaded at end of body) ──
  document.querySelectorAll("[data-topnav]").forEach(renderTopNav);
})();
