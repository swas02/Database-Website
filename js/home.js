// Scroll-reveal and count-up. Content is visible without JS; the "js" class on <html> enables the animation.
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const items = document.querySelectorAll(".reveal");
if (reduce || !("IntersectionObserver" in window)) {
  items.forEach((el) => el.classList.add("in"));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  items.forEach((el, i) => { el.style.transitionDelay = (i % 4) * 70 + "ms"; io.observe(el); });
}

// Number of models in the library, from the registry.
const num = document.getElementById("model-count");
if (num) {
  fetch("registry_flat.json").then((r) => r.json()).then((rows) => {
    const n = rows.length;
    if (reduce) { num.textContent = n; return; }
    const t0 = performance.now(), dur = 900;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      num.textContent = Math.round(n * (1 - (1 - k) ** 3));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }).catch(() => { num.textContent = "190"; });
}
