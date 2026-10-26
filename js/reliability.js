// Hero graph: a live reliability simulation.
// Random samples of load and resistance pile up into two histograms, which settle onto their smooth
// skewed (lognormal) probability curves. Where the curves overlap, a structure can fail (dark red, hatched).
// The build-up plays forward, rewinds to the scattered start, then plays forward again (a loop),
// while the distributions themselves keep drifting slightly.
// Graphic only, no labels. Static for visitors who ask for reduced motion; pauses off-screen.
const NS = "http://www.w3.org/2000/svg";
const W = 1440, H = 300;
const svg = document.getElementById("rel-svg");

const INK = "#1B2118", GREEN = "#90AF13", GREEN_DK = "#6F8A0E", RED = "#B3121F";   // failure zone: dark red, hatched, so it reads without relying on hue
const NB = 110;                     // histogram bins
const X0 = 0.65, X1 = 13.75;
const PAD = { l: 0, r: 0, t: 24, b: 0 };
const base = H - PAD.b;
const sx = (x) => PAD.l + ((x - X0) / (X1 - X0)) * (W - PAD.l - PAD.r);
const binw = (X1 - X0) / NB;

const logn = (x, mu, sd) => (x <= 0 ? 0 : Math.exp(-0.5 * ((Math.log(x) - mu) / sd) ** 2) / (x * sd * Math.sqrt(2 * Math.PI)));
const BASE_S = { mu: Math.log(3.5) + 0.33 ** 2, sd: 0.33 };
const BASE_R = { mu: Math.log(4.8) + 0.52 ** 2, sd: 0.52 };
const PEAK = logn(Math.exp(BASE_S.mu - BASE_S.sd ** 2), BASE_S.mu, BASE_S.sd);
const sy = (p) => base - (Math.min(p, PEAK * 1.3) / PEAK) * (base - PAD.t);

// Fixed pseudo-random numbers, so the histograms look the same on every visit.
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
const zS = Array.from({ length: NB }, gauss), zR = Array.from({ length: NB }, gauss);

// Distribution parameters over time (seconds). The resistance and load drift slowly.
function params(t) {
  return {
    S: { mu: BASE_S.mu, sd: BASE_S.sd + 0.012 * Math.sin(t * 0.7 + 1) },
    R: { mu: BASE_R.mu + 0.06 * Math.sin(t * 0.5), sd: BASE_R.sd + 0.013 * Math.sin(t * 0.4 + 2) },
  };
}

function el(name, attrs, parent) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

function build() {
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.textContent = "";
  const barsG = el("g", {}, svg);
  const barsS = [], barsR = [];
  const bw = Math.max(1, (sx(X1) - sx(X0)) / NB - 1.6);
  for (let i = 0; i < NB; i++) {
    barsS.push(el("rect", { fill: INK, "fill-opacity": 0.16, width: bw.toFixed(2) }, barsG));
    barsR.push(el("rect", { fill: GREEN, "fill-opacity": 0.42, width: bw.toFixed(2) }, barsG));
  }
  const defs = el("defs", {}, svg);
  const hatch = el("pattern", { id: "rel-hatch", width: 7, height: 7, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
  el("rect", { width: 7, height: 7, fill: RED }, hatch);
  el("line", { x1: 0, y1: 0, x2: 0, y2: 7, stroke: "#FFFFFF", "stroke-width": 2.2 }, hatch);
  const overlap = el("path", { fill: "none", "fill-opacity": 0.92 }, svg);
  const lineR = el("path", { fill: "none", stroke: GREEN_DK, "stroke-width": 2.4, "stroke-linejoin": "round" }, svg);
  const lineS = el("path", { fill: "none", stroke: INK, "stroke-width": 2.4, "stroke-linejoin": "round" }, svg);
  return { overlap, barsG, barsS, barsR, lineR, lineS };
}

function render(parts, t, N, barOpacity, curveOpacity) {
  const { S, R } = params(t);
  const fS = (x) => logn(x, S.mu, S.sd), fR = (x) => logn(x, R.mu, R.sd);

  // Histogram bars: expected density plus sampling noise that shrinks as the sample count N grows.
  for (let i = 0; i < NB; i++) {
    const left = X0 + i * binw, c = left + binw / 2;
    const pS = fS(c), pR = fR(c);
    const dS = Math.max(0, pS + zS[i] * Math.sqrt(pS / (N * binw)));
    const dR = Math.max(0, pR + zR[i] * Math.sqrt(pR / (N * binw)));
    const x = sx(left) + 0.8;
    const yS = sy(dS), yR = sy(dR);
    parts.barsS[i].setAttribute("x", x.toFixed(1)); parts.barsS[i].setAttribute("y", yS.toFixed(1)); parts.barsS[i].setAttribute("height", Math.max(0, base - yS).toFixed(1));
    parts.barsR[i].setAttribute("x", x.toFixed(1)); parts.barsR[i].setAttribute("y", yR.toFixed(1)); parts.barsR[i].setAttribute("height", Math.max(0, base - yR).toFixed(1));
  }
  parts.barsG.setAttribute("opacity", barOpacity.toFixed(3));

  // Smooth curves and the overlap (failure zone).
  let dS = "", dR = "", dO = "";
  const pts = 150;
  for (let k = 0; k <= pts; k++) {
    const x = X0 + ((X1 - X0) * k) / pts, X = sx(x).toFixed(1);
    const a = sy(fS(x)), b = sy(fR(x)), m = Math.max(a, b); // larger y = lower curve
    dS += (k ? " L" : "M") + X + " " + a.toFixed(1);
    dR += (k ? " L" : "M") + X + " " + b.toFixed(1);
    dO += (k ? " L" : "M") + X + " " + m.toFixed(1);
  }
  parts.lineS.setAttribute("d", dS); parts.lineR.setAttribute("d", dR);
  parts.overlap.setAttribute("d", `${dO} L${sx(X1).toFixed(1)} ${base} L${sx(X0).toFixed(1)} ${base} Z`);
  parts.lineS.setAttribute("opacity", curveOpacity.toFixed(3)); parts.lineR.setAttribute("opacity", curveOpacity.toFixed(3));
  parts.overlap.setAttribute("opacity", curveOpacity.toFixed(3));
}

if (svg) {
  const parts = build();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    render(parts, 0, 6000, 1, 1);
  } else {
    // Forward, back, forward: the sample count climbs, pauses, rewinds to the scattered start, pauses, repeats.
    const GROW = 8, HOLD = 1.5;                  // seconds for one direction, and for each pause
    const CYCLE = 2 * (GROW + HOLD);
    const N0 = 12, N1 = 6000;
    const smooth = (k) => k * k * (3 - 2 * k);
    let visible = true, last = 0, start = null;
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(svg);
    render(parts, 0, N0, 1, 0);

    const frame = (now) => {
      requestAnimationFrame(frame);
      if (!visible || now - last < 33) return;   // pause off-screen, ~30 fps
      last = now;
      if (start === null) start = now;
      const t = (now - start) / 1000;
      const c = t % CYCLE;
      let k;                                                       // 0 = scattered start, 1 = fully settled
      if (c < GROW) k = c / GROW;                                  // forward
      else if (c < GROW + HOLD) k = 1;                             // settled
      else if (c < 2 * GROW + HOLD) k = 1 - (c - GROW - HOLD) / GROW; // back
      else k = 0;                                                  // scattered
      const N = N0 * Math.pow(N1 / N0, smooth(k));                 // sample count 12 to 6000 and back
      const curveIn = Math.min(1, t / 1.5);                        // curves appear once, at the very start
      render(parts, t, N, 1, curveIn);
    };
    requestAnimationFrame(frame);
  }
}
