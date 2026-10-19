/* Mobile splitter: drag (or arrow keys) to trade space between the model and the sidebar. */
const bar = document.getElementById("splitter");
const model = document.getElementById("viewport-container");
const app = document.getElementById("app-container");

if (bar && model && app) {
  const MIN = 0.15, MAX = 0.75;

  function setHeight(px) {
    const total = app.getBoundingClientRect().height;
    const clamped = Math.min(Math.max(px, total * MIN), total * MAX);
    model.style.flex = `0 0 ${clamped}px`;
    window.dispatchEvent(new Event("resize"));
  }

  bar.addEventListener("pointerdown", (e) => {
    bar.setPointerCapture(e.pointerId);
    bar.classList.add("dragging");
    const top = app.getBoundingClientRect().top;
    const move = (ev) => setHeight(ev.clientY - top);
    const up = () => {
      bar.classList.remove("dragging");
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", up);
      bar.removeEventListener("pointercancel", up);
    };
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up);
    bar.addEventListener("pointercancel", up);
  });

  bar.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    setHeight(model.getBoundingClientRect().height + (e.key === "ArrowDown" ? 24 : -24));
  });

  // Back on desktop widths, drop the inline height so the side-by-side layout applies.
  window.matchMedia("(min-width: 801px)").addEventListener("change", (m) => {
    if (m.matches) model.style.flex = "";
  });
}
