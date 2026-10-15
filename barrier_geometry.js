/**
 * barrier_geometry.js
 * Builds the deck furniture (railing, crash barrier, footpath, carriageway,
 * lane markings) as plain triangle meshes, for convert_ifc_to_obj.js.
 * No dependencies: runs in plain Node. All dimensions are in metres.
 *
 * Layout across the deck (footpath on one side only):
 *   footpath:    railing (plinth) | footpath | crash barrier | road | crash barrier
 *   no footpath: crash barrier | road | crash barrier
 */

// Injected groups. `name` is the group name in groups.json / the OBJ `g` tag,
// `partID` is what groups.json uses to point at the mesh.
const GROUPS = {
  railing: { name: "Railing", partID: "injected_railing_0" },
  barrier: { name: "Crash Barrier", partID: "injected_crash_barrier_0" },
  footpath: { name: "Footpath", partID: "injected_footpath_0" },
  road: { name: "Carriageway", partID: "injected_carriageway_0" },
  lanes: { name: "Lane Markings", partID: "injected_lane_markings_0" },
};

const LAYOUT = {
  edgeInset: 0,
  footpathSide: 1, // 1 = max-width edge, -1 = min-width edge
  footpathWidth: 1.5,
  footpathHeight: 0.1,
  plinthWidth: 0.375, // railing plinth, part of the footpath block
  laneLineWidth: 0.15,
  roadLift: 0.005,
  laneLift: 0.015,
};

// Crash barrier: 450 wide, 1100 high (900 on the footpath side).
const CRASH_BARRIER = {
  height: 1.1,
  heightFootpathSide: 0.9,
  width: 0.45,
  // u = distance from the outer (vertical) face, v = height; "top" = barrier height.
  profile: [[0, 0], [0, "top"], [0.175, "top"], [0.225, 0.35], [0.45, 0.1], [0.45, 0]],
};

// Steel railing (post-and-rail; sizes are assumptions).
const RAILING = {
  height: 1.1,
  postSize: 0.1,
  postSpacing: 2.0,
  topRailSize: 0.08,
  railSize: 0.05,
  railHeights: [0.2, 0.5, 0.8],
};

// ── Mesh helpers ─────────────────────────────────────────────
class Mesh {
  constructor() {
    this.verts = [];
    this.tris = [];
  }
  vert(p) {
    this.verts.push(p);
    return this.verts.length - 1;
  }
  tri(a, b, c) {
    this.tris.push([a, b, c]);
  }
  quad(a, b, c, d) {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }
  box(min, max) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    const v = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ].map((p) => this.vert(p));
    this.quad(v[0], v[3], v[2], v[1]);
    this.quad(v[4], v[5], v[6], v[7]);
    this.quad(v[0], v[1], v[5], v[4]);
    this.quad(v[3], v[7], v[6], v[2]);
    this.quad(v[0], v[4], v[7], v[3]);
    this.quad(v[1], v[2], v[6], v[5]);
  }
}

/** Ear-clipping triangulation of a simple polygon. Returns index triples. */
function triangulate(pts) {
  const area = pts.reduce((s, p, i) => {
    const q = pts[(i + 1) % pts.length];
    return s + (p[0] * q[1] - q[0] * p[1]);
  }, 0);
  const idx = pts.map((_, i) => i);
  if (area < 0) idx.reverse(); // make counter-clockwise
  const cross = (a, b, c) =>
    (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) - (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[a][0]);
  const inside = (p, a, b, c) =>
    cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;

  const out = [];
  let guard = idx.length * idx.length;
  while (idx.length > 3 && guard-- > 0) {
    for (let i = 0; i < idx.length; i++) {
      const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
      if (cross(a, b, c) <= 0) continue; // reflex corner
      if (idx.some((p) => p !== a && p !== b && p !== c && inside(p, a, b, c))) continue;
      out.push([a, b, c]);
      idx.splice(i, 1);
      break;
    }
  }
  if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
  return out;
}

/**
 * Extrude a 2D profile along the bridge. `at(u, v, t)` maps profile point
 * (u, v) at the start (t = 0) or end (t = 1) of the run to a 3D position.
 */
function extrude(mesh, profile, at) {
  const n = profile.length;
  const start = profile.map(([u, v]) => mesh.vert(at(u, v, 0)));
  const end = profile.map(([u, v]) => mesh.vert(at(u, v, 1)));
  triangulate(profile).forEach(([a, b, c]) => {
    mesh.tri(start[a], start[c], start[b]);
    mesh.tri(end[a], end[b], end[c]);
  });
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    mesh.quad(start[i], start[j], end[j], end[i]);
  }
}

// ── Main builder ─────────────────────────────────────────────
/**
 * @param {{min:number[], max:number[]}} slab  Deck slab bounding box [x,y,z]
 * @param {{hasFootpath:boolean, lanes:number}} opts
 * @returns {Object<string,{name:string,partID:string,verts:number[][],tris:number[][]}>}
 *          keyed like GROUPS; only groups that have geometry are present.
 */
function buildDeckFurniture(slab, { hasFootpath, lanes }) {
  const sx = slab.max[0] - slab.min[0];
  const sz = slab.max[2] - slab.min[2];
  const alongX = sx >= sz; // bridge runs along its longer horizontal axis
  const A = alongX ? 0 : 2; // length axis index
  const C = alongX ? 2 : 0; // across (width) axis index
  const lo = slab.min[A], hi = slab.max[A];
  const length = hi - lo;
  const wLo = slab.min[C] + LAYOUT.edgeInset;
  const wHi = slab.max[C] - LAYOUT.edgeInset;
  const top = slab.max[1];

  const p3 = (along, y, across) => {
    const p = [0, y, 0];
    p[A] = along;
    p[C] = across;
    return p;
  };

  const meshes = {};
  const get = (key) => (meshes[key] ||= new Mesh());

  // Axis-aligned box from (along, y, across) ranges.
  const box = (key, a0, a1, y0, y1, c0, c1) =>
    get(key).box(p3(a0, y0, Math.min(c0, c1)), p3(a1, y1, Math.max(c0, c1)));

  // Extrusion along the bridge: u is across the deck from `acrossStart` in
  // direction `inward`, v is height above `baseY`.
  const extrudeAcross = (key, profile, acrossStart, inward, baseY) =>
    extrude(get(key), profile, (u, v, t) => p3(lo + t * length, baseY + v, acrossStart + inward * u));

  const barrierProfile = (h) => CRASH_BARRIER.profile.map(([u, v]) => [u, v === "top" ? h : v]);

  const railing = (across, baseY) => {
    const { height: H, postSize: ps, postSpacing, topRailSize, railSize, railHeights } = RAILING;
    const spans = Math.max(1, Math.round(length / postSpacing));
    for (let i = 0; i <= spans; i++) {
      const a = lo + ps / 2 + ((length - ps) * i) / spans;
      box("railing", a - ps / 2, a + ps / 2, baseY, baseY + H, across - ps / 2, across + ps / 2);
    }
    const rail = (y, size) =>
      box("railing", lo, hi, baseY + y - size / 2, baseY + y + size / 2, across - size / 2, across + size / 2);
    rail(H - topRailSize / 2, topRailSize);
    railHeights.forEach((y) => rail(y, railSize));
  };

  const roadEdge = {};
  [-1, 1].forEach((side) => {
    const edge = side < 0 ? wLo : wHi;
    const inward = -side;
    let cursor = edge;
    let barrierHeight = CRASH_BARRIER.height;

    if (hasFootpath && side === LAYOUT.footpathSide) {
      barrierHeight = CRASH_BARRIER.heightFootpathSide;
      const fpWidth = LAYOUT.plinthWidth + LAYOUT.footpathWidth;
      box("footpath", lo, hi, top, top + LAYOUT.footpathHeight, edge, edge + inward * fpWidth);
      railing(edge + inward * (LAYOUT.plinthWidth / 2), top + LAYOUT.footpathHeight);
      cursor += inward * fpWidth;
    }
    extrudeAcross("barrier", barrierProfile(barrierHeight), cursor, inward, top);
    roadEdge[side] = cursor + inward * CRASH_BARRIER.width;
  });

  // Carriageway between the barriers, divided into lanes.
  const roadLo = roadEdge[-1];
  const roadHi = roadEdge[1];
  const roadWidth = roadHi - roadLo;
  const flat = (key, y, c0, c1) => {
    const m = get(key);
    const v = [p3(lo, y, c0), p3(hi, y, c0), p3(hi, y, c1), p3(lo, y, c1)].map((p) => m.vert(p));
    m.quad(v[0], v[1], v[2], v[3]);
  };
  flat("road", top + LAYOUT.roadLift, roadLo, roadHi);
  const laneCount = Math.max(1, Number(lanes) || 1);
  for (let i = 1; i < laneCount; i++) {
    const c = roadLo + (roadWidth * i) / laneCount;
    flat("lanes", top + LAYOUT.laneLift, c - LAYOUT.laneLineWidth / 2, c + LAYOUT.laneLineWidth / 2);
  }

  const result = {};
  Object.keys(meshes).forEach((key) => {
    result[key] = { ...GROUPS[key], verts: meshes[key].verts, tris: meshes[key].tris };
  });
  return result;
}

module.exports = { buildDeckFurniture, GROUPS, LAYOUT, CRASH_BARRIER, RAILING };
