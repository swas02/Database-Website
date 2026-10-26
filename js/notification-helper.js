// Renders the banner described by a NOTIFICATION settings object (see notification.js). No need to edit this file.
export function showNotification(NOTIFICATION) {
  if (!NOTIFICATION.enabled) return;

  const palette = {
    info: { bg: "#E8F1FB", fg: "#16396B", line: "#B9D2F0" },
    warning: { bg: "#FFF4D6", fg: "#5C4300", line: "#F0D98C" },
    success: { bg: "#F3F7E4", fg: "#3F4F08", line: "#D5E39A" },
  };
  const c = palette[NOTIFICATION.type] || palette.info;

  const style = document.createElement("style");
  style.textContent = `
    .site-notice { position: relative; z-index: 101; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; gap: 12px;
      padding: 9px 44px 9px 16px; background: ${c.bg}; color: ${c.fg}; border-bottom: 1px solid ${c.line};
      font: 500 0.875rem/1.45 "Inter", system-ui, -apple-system, "Segoe UI", sans-serif; text-align: center; }
    .site-notice a { color: inherit; font-weight: 700; text-decoration: underline; }
    .site-notice-close { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; padding: 0;
      border: 0; border-radius: 4px; background: transparent; color: inherit; font-size: 20px; line-height: 1; cursor: pointer; opacity: .7; }
    .site-notice-close:hover, .site-notice-close:focus-visible { opacity: 1; background: rgba(0,0,0,.08); }
  `;
  document.head.appendChild(style);

  const bar = document.createElement("div");
  bar.className = "site-notice";
  bar.setAttribute("role", "status");

  const text = document.createElement("span");
  text.textContent = NOTIFICATION.message;
  bar.appendChild(text);

  if (NOTIFICATION.link && NOTIFICATION.link.url) {
    const a = document.createElement("a");
    a.href = NOTIFICATION.link.url;
    a.textContent = NOTIFICATION.link.text || NOTIFICATION.link.url;
    bar.appendChild(a);
  }

  if (NOTIFICATION.dismissible) {
    const close = document.createElement("button");
    close.type = "button";
    close.className = "site-notice-close";
    close.setAttribute("aria-label", "Dismiss notification");
    close.innerHTML = "&times;";
    close.addEventListener("click", () => {
      bar.remove(); // not remembered: the banner returns on the next page load
    });
    bar.appendChild(close);
  }

  document.body.insertBefore(bar, document.body.firstChild);
}
