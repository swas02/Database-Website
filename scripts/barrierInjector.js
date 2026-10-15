import * as THREE from "three";
import { state } from "./state.js";
import { renderGroupsPanel } from "./ui.js";
import { precomputeGroupBounds } from "./selection.js";

import {
  BARRIER_GROUPS as GROUPS,
  HELPER_NAME,
  HELPER_COLORS as COLORS,
  LAYOUT,
  CRASH_BARRIER,
  RAILING,
} from "./barrierConfig.js";

/**
 * Step 1 of crash barrier / railing injection:
 * return the names of all slab groups in the currently loaded model.
 *
 * Group names differ in case/wording between models ("Deck Slab",
 * "deck slab", "Slab", "slab"), so match case-insensitively on "slab".
 */
export function getSlabGroupNames() {
  const names = state.modelGroupsData?.groups
    ? state.modelGroupsData.groups.map((g) => g.name)
    : [...state.groupIndex.keys()];

  return names.filter((name) => /slab/i.test(name));
}

/** Bounding box of all slab meshes, in modelGroup-local space. */
function getSlabBox() {
  const slabNames = new Set(getSlabGroupNames().map((n) => n.toLowerCase()));
  const box = new THREE.Box3();

  state.modelGroup.updateMatrixWorld(true);
  state.modelGroup.children.forEach((mesh) => {
    if (!mesh.isMesh || !slabNames.has(String(mesh.userData?.elemName).toLowerCase())) return;
    box.expandByObject(mesh);
  });
  if (box.isEmpty()) return null;

  // expandByObject gives world space; convert to modelGroup-local space.
  const inv = new THREE.Matrix4().copy(state.modelGroup.matrixWorld).invert();
  return box.applyMatrix4(inv);
}

export function hasBarriers() {
  return state.modelGroup.children.some((c) => c.userData?.injected);
}

export function removeBarriers() {
  const injectedGroupNames = new Set(Object.values(GROUPS).map((g) => g.name));

  [...state.modelGroup.children]
    .filter((c) => c.userData?.injected)
    .forEach((c) => {
      state.modelGroup.remove(c);
      c.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
    });

  Object.values(GROUPS).forEach((g) => {
    state.meshMap.delete(g.partID);
    state.groupMap.delete(g.partID);
    state.groupIndex.delete(g.name);
  });

  const groups = state.modelGroupsData?.groups;
  if (groups) {
    state.modelGroupsData.groups = groups.filter((g) => !injectedGroupNames.has(g.name));
    renderGroupsPanel(state.modelGroupsData.groups);
    precomputeGroupBounds();
  }
}

function makeMesh(geometry, color, extra = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1.0,
    roughness: 0.35,
    metalness: 0.2,
    ...extra,
  });
  return new THREE.Mesh(geometry, mat);
}

/**
 * Plane in world(model)-local coordinates with the transform baked into the
 * geometry, so mesh.position/rotation stay identity like the OBJ meshes
 * (group bounds and selection code read geometry bounds directly).
 *
 * kind "wall": vertical sheet of `size` x `height` along the bridge.
 * kind "flat": horizontal sheet of `size` x `height` (height = width across the deck).
 */
function planeGeometry(kind, lengthAxis, size, height, along, y, across) {
  const geo = new THREE.PlaneGeometry(size, height);
  const m = new THREE.Matrix4();
  if (kind === "flat") m.makeRotationX(-Math.PI / 2); // lie flat, long side along X
  if (lengthAxis === "z") m.premultiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
  const pos = lengthAxis === "x" ? [along, y, across] : [across, y, along];
  m.premultiply(new THREE.Matrix4().makeTranslation(...pos));
  geo.applyMatrix4(m);
  geo.computeBoundingBox();
  return geo;
}

/** Crash barrier cross-section from the shared config, at the given height. */
function barrierProfile(height) {
  return new THREE.Shape(
    CRASH_BARRIER.profile.map(([u, v]) => new THREE.Vector2(u, v === "top" ? height : v)),
  );
}

/**
 * Extrude a profile along the bridge. `acrossStart` is where u = 0 sits on the
 * deck-width axis, `inward` (+1/-1) is the direction of increasing u, and
 * `baseY` the height of v = 0. Transform is baked into the geometry.
 */
function extrudeProfile(shape, lengthAxis, lo, length, acrossStart, inward, baseY) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
  const u = lengthAxis === "x" ? new THREE.Vector3(0, 0, inward) : new THREE.Vector3(inward, 0, 0);
  const v = new THREE.Vector3(0, 1, 0);
  const w = lengthAxis === "x" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const m = new THREE.Matrix4().makeBasis(u, v, w);
  const origin = lengthAxis === "x" ? [lo, baseY, acrossStart] : [acrossStart, baseY, lo];
  m.setPosition(...origin);
  geo.applyMatrix4(m);
  geo.computeBoundingBox();
  return geo;
}

/** Concatenate geometries (position + normal only) into one non-indexed geometry. */
function mergeGeometries(geos) {
  const parts = geos.map((g) => g.toNonIndexed());
  const count = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  let offset = 0;
  parts.forEach((g) => {
    position.set(g.attributes.position.array, offset * 3);
    normal.set(g.attributes.normal.array, offset * 3);
    offset += g.attributes.position.count;
    g.dispose();
  });
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(position, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  merged.computeBoundingBox();
  return merged;
}

/**
 * Steel railing: square posts at regular spacing, a top rail and intermediate
 * rails, merged into one geometry. `across` is the position on the deck-width
 * axis, `baseY` the level it stands on.
 */
function railingGeometry(lengthAxis, lo, length, across, baseY) {
  const { height: H, postSize, postSpacing, topRailSize, railSize, railHeights } = RAILING;
  const parts = [];

  // Box given as (along-size, up-size, across-size) centred at (along, up, across).
  const box = (sa, sy, sc, a, y, c) => {
    const geo =
      lengthAxis === "x"
        ? new THREE.BoxGeometry(sa, sy, sc).translate(a, baseY + y, c)
        : new THREE.BoxGeometry(sc, sy, sa).translate(c, baseY + y, a);
    parts.push(geo);
  };

  const spans = Math.max(1, Math.round(length / postSpacing));
  for (let i = 0; i <= spans; i++) {
    // Keep end posts fully inside the slab length.
    const a = lo + postSize / 2 + ((length - postSize) * i) / spans;
    box(postSize, H, postSize, a, H / 2, across);
  }
  // Top rail, then intermediate rails.
  box(length, topRailSize, topRailSize, lo + length / 2, H - topRailSize / 2, across);
  railHeights.forEach((y) => box(length, railSize, railSize, lo + length / 2, y, across));

  return mergeGeometries(parts);
}

/** Register a set of geometries as one selectable group (one partID, many meshes). */
function registerGroup(def, geometries) {
  const meshes = geometries.map((geo) => {
    const mesh = makeMesh(geo, def.color);
    mesh.name = def.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
      partID: def.partID,
      baseColor: def.color,
      originalColor: def.color,
      elemName: def.name,
      elemType: 0,
      injected: true,
    };
    state.modelGroup.add(mesh);
    return mesh;
  });

  state.meshMap.set(def.partID, meshes);
  state.groupIndex.set(def.name, new Set([def.partID]));
  state.groupMap.set(def.partID, [{ name: def.name, meta: { length: "", custom: [] } }]);
  state.modelGroupsData.groups.push({ name: def.name, partIDs: [def.partID] });
}

/**
 * Inject temporary railing / crash-barrier sheets on top of the deck slab.
 *
 * Cross-section, edge to edge (footpath on one side only):
 *   footpath:    railing (375 plinth) | footpath (1500) | crash barrier (450) | road | crash barrier
 *   no footpath: crash barrier | road | crash barrier
 *
 * "Railing" and "Crash Barrier" are registered as groups; footpath, carriageway
 * and lane markings are plain helper sheets. Returns { ok, reason?, hasFootpath }.
 */
export function injectBarriers() {
  if (!state.ifcLoaded) return { ok: false, reason: "No model loaded" };
  if (getSlabGroupNames().length === 0) return { ok: false, reason: "No Deck Slab in this model" };
  if (!state.modelGroupsData?.groups) return { ok: false, reason: "Model has no group data" };

  const box = getSlabBox();
  if (!box) return { ok: false, reason: "Deck Slab has no mesh in this model" };

  removeBarriers();

  const size = box.getSize(new THREE.Vector3());
  // Bridge runs along its longer horizontal axis; Y is up.
  const lengthAxis = size.x >= size.z ? "x" : "z";
  const lo = lengthAxis === "x" ? box.min.x : box.min.z;
  const hi = lengthAxis === "x" ? box.max.x : box.max.z;
  const wLo = (lengthAxis === "x" ? box.min.z : box.min.x) + LAYOUT.edgeInset;
  const wHi = (lengthAxis === "x" ? box.max.z : box.max.x) - LAYOUT.edgeInset;
  const length = hi - lo;
  const along = (lo + hi) / 2;
  const top = box.max.y;
  const hasFootpath = !!state.bridgeData?.has_footpath;

  const helpers = new THREE.Group();
  helpers.name = HELPER_NAME;
  helpers.userData.injected = true;

  const railingGeos = [];
  const barrierGeos = [];
  const roadEdge = {}; // side -> inner face of the crash barrier

  [-1, 1].forEach((side) => {
    const edge = side < 0 ? wLo : wHi;
    let cursor = edge; // moves inward from the slab edge
    const inward = -side;

    let barrierHeight = CRASH_BARRIER.height;
    if (hasFootpath && side === LAYOUT.footpathSide) {
      barrierHeight = CRASH_BARRIER.heightFootpathSide;
      const fpWidth = LAYOUT.plinthWidth + LAYOUT.footpathWidth;
      // Raised footpath block (plinth + walkway), 100 above the deck.
      const block = new THREE.Shape([
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0, LAYOUT.footpathHeight),
        new THREE.Vector2(fpWidth, LAYOUT.footpathHeight),
        new THREE.Vector2(fpWidth, 0),
      ]);
      const fp = makeMesh(extrudeProfile(block, lengthAxis, lo, length, edge, inward, top), COLORS.footpath);
      fp.name = "Footpath";
      helpers.add(fp);
      // Steel railing centred on the plinth, standing on the footpath level.
      railingGeos.push(
        railingGeometry(lengthAxis, lo, length, edge + inward * (LAYOUT.plinthWidth / 2), top + LAYOUT.footpathHeight),
      );
      cursor += inward * fpWidth;
    }
    // Crash barrier: vertical face outward, sloped face towards the road.
    barrierGeos.push(extrudeProfile(barrierProfile(barrierHeight), lengthAxis, lo, length, cursor, inward, top));
    roadEdge[side] = cursor + inward * CRASH_BARRIER.width;
  });

  // Carriageway between the two crash barriers, split into lanes.
  const lanes = Math.max(1, Number(state.bridgeData?.lanes) || 1);
  const roadLo = roadEdge[-1];
  const roadHi = roadEdge[1];
  const roadWidth = roadHi - roadLo;
  const road = makeMesh(
    planeGeometry("flat", lengthAxis, length, roadWidth, along, top + 0.005, (roadLo + roadHi) / 2),
    COLORS.road,
  );
  road.name = "Carriageway";
  helpers.add(road);
  for (let i = 1; i < lanes; i++) {
    const line = makeMesh(
      planeGeometry("flat", lengthAxis, length, LAYOUT.laneLineWidth, along, top + 0.015, roadLo + (roadWidth * i) / lanes),
      COLORS.lane,
    );
    line.name = `Lane Marking ${i}`;
    helpers.add(line);
  }
  state.modelGroup.add(helpers);

  if (railingGeos.length) registerGroup(GROUPS.railing, railingGeos);
  registerGroup(GROUPS.barrier, barrierGeos);

  renderGroupsPanel(state.modelGroupsData.groups);
  precomputeGroupBounds();
  return { ok: true, hasFootpath };
}

/** Button handler: toggles the injected sheets on/off. */
window.toggleBarriers = function () {
  const btn = document.getElementById("btn-barriers");
  if (hasBarriers()) {
    removeBarriers();
    btn?.classList.remove("active");
    return;
  }
  const res = injectBarriers();
  if (!res.ok) {
    alert(res.reason);
    return;
  }
  btn?.classList.add("active");
};
