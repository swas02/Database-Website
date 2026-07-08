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

(function () {
  const LINKS = [
    { key: "home", label: "Home", icon: "bi-house", href: "pages/home.html" },
    { key: "viewer", label: "Dataset Viewer", icon: "bi-bezier2", href: "index.html" },
    { key: "software", label: "Our Software", icon: "bi-cpu", href: "pages/home.html#software" },
    { key: "publications", label: "Publications", icon: "bi-journal-text", href: "pages/home.html#publications" },
  ];
  const MORE_LINKS = [
    { key: "about", label: "About Us", icon: "bi-info-circle", href: "pages/home.html#about" },
    { key: "contact", label: "Contact Us", icon: "bi-envelope", href: "pages/home.html#contact" },
  ];

  function renderTopNav(host) {
    const root = host.dataset.root || "./";
    const active = host.dataset.active || "";

    const navLinks = LINKS.map((l) =>
      `<a href="${root + l.href}" class="nav-link${l.key === active ? " active" : ""}"${l.key === active ? ' aria-current="page"' : ""}>${l.label}</a>`
    ).join("");

    const mobileLinks = LINKS.map((l) =>
      `<a href="${root + l.href}" class="mobile-only-link${l.key === active ? " active" : ""}"><i class="bi ${l.icon} me-2" aria-hidden="true"></i> ${l.label}</a>`
    ).join("");

    const moreLinks = MORE_LINKS.map((l) =>
      `<a href="${root + l.href}"><i class="bi ${l.icon} me-2" aria-hidden="true"></i> ${l.label}</a>`
    ).join("");

    host.innerHTML = `
      <a href="${root}pages/home.html" class="nav-brand" aria-label="BridgeLCCA home">
        <i class="bi bi-bezier2 text-primary" aria-hidden="true"></i>
        <span>BridgeLCCA</span>
      </a>
      <div class="nav-divider" role="presentation"></div>
      <nav class="nav-menu" aria-label="Primary">${navLinks}</nav>
      <div class="nav-dropdown" id="more-menu">
        <button class="nav-dropdown-trigger" onclick="toggleDropdownMenu(event)" aria-label="More options" aria-haspopup="menu">
          <i class="bi bi-three-dots" aria-hidden="true"></i>
        </button>
        <div class="nav-dropdown-content" id="more-menu-content" role="menu">
          ${mobileLinks}
          <div class="nav-dropdown-divider mobile-only-link" role="separator"></div>
          ${moreLinks}
          <div class="nav-dropdown-divider" role="separator"></div>
          <a href="#" onclick="toggleSiteTheme(event)">
            <i class="bi bi-sun-fill me-2" id="theme-toggle-icon" aria-hidden="true"></i>
            <span id="theme-toggle-text">Light Mode</span>
          </a>
          <a href="#" onclick="toggleAppFullscreen(event)">
            <i class="bi bi-arrows-fullscreen me-2" id="fullscreen-icon" aria-hidden="true"></i>
            <span id="fullscreen-text">Fullscreen</span>
          </a>
        </div>
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

  // ── Theme (same storage key as ui.js) ──
  function updateThemeUI(theme) {
    const icon = document.getElementById("theme-toggle-icon");
    const text = document.getElementById("theme-toggle-text");
    if (theme === "light") {
      if (icon) icon.className = "bi bi-moon-fill me-2";
      if (text) text.innerText = "Dark Mode";
    } else {
      if (icon) icon.className = "bi bi-sun-fill me-2";
      if (text) text.innerText = "Light Mode";
    }
  }

  const savedTheme = localStorage.getItem("bridge-lcca-theme") || "dark";
  document.documentElement.setAttribute("data-bs-theme", savedTheme);

  window.toggleSiteTheme = function (event) {
    if (event) event.preventDefault();
    const html = document.documentElement;
    const newTheme = (html.getAttribute("data-bs-theme") || "dark") === "dark" ? "light" : "dark";
    html.setAttribute("data-bs-theme", newTheme);
    localStorage.setItem("bridge-lcca-theme", newTheme);
    updateThemeUI(newTheme);
  };

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

  function initScrollSpy() {
    const sections = [
      { id: "home", key: "home" },
      { id: "software", key: "software" },
      { id: "publications", key: "publications" },
      { id: "about", key: "about" },
      { id: "contact", key: "contact" }
    ];

    function checkActiveSection() {
      let activeKey = "home";
      const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      const hash = window.location.hash;

      if (scrollY <= 100) {
        if (hash) {
          const matched = sections.find(s => "#" + s.id === hash);
          if (matched) activeKey = matched.key;
        }
      } else {
        let minDiff = Infinity;
        for (const section of sections) {
          if (section.id === "home") continue;
          const el = document.getElementById(section.id);
          if (el) {
            const rect = el.getBoundingClientRect();
            const diff = Math.abs(rect.top - 80);
            if (diff < minDiff) {
              minDiff = diff;
              activeKey = section.key;
            }
          }
        }
        
        // If the closest section's top is still in the lower 40% of the viewport, keep Home highlighted
        if (activeKey !== "home") {
          const activeEl = document.getElementById(activeKey);
          if (activeEl) {
            const rect = activeEl.getBoundingClientRect();
            if (rect.top > window.innerHeight * 0.6) {
              activeKey = "home";
            }
          }
        }
      }

      document.querySelectorAll("#hud-header a").forEach((link) => {
        const href = link.getAttribute("href") || "";
        if (link.classList.contains("nav-brand")) return;

        let isCurrent = false;
        if (activeKey === "home") {
          isCurrent = href.includes("home.html") && !href.includes("#");
        } else {
          isCurrent = href.endsWith("#" + activeKey);
        }

        if (isCurrent) {
          link.classList.add("active");
          link.setAttribute("aria-current", "page");
        } else {
          link.classList.remove("active");
          link.removeAttribute("aria-current");
        }
      });
    }

    window.addEventListener("scroll", checkActiveSection);
    window.addEventListener("hashchange", checkActiveSection);
    window.addEventListener("load", () => {
      setTimeout(checkActiveSection, 100);
      setTimeout(checkActiveSection, 400);
    });
    checkActiveSection();
  }

  // ── Render all placeholders (script is loaded at end of body) ──
  document.querySelectorAll("[data-topnav]").forEach(renderTopNav);
  updateThemeUI(savedTheme);

  if (document.body.classList.contains("static-page")) {
    initScrollSpy();
  }
})();
