import * as THREE from "three";
import { state } from "./state.js";
import { COLOR, IFCTYPES, getMaterialColor, getMaterialStyle, setBridgeType } from "./constants.js";
import { setLoadingState, renderGroupsPanel } from "./ui.js";
import { precomputeGroupBounds } from "./selection.js";
import { fitLightingToModel } from "./viewer.js";

// The substructure file holds one pier unit (cap, pier, pile cap, piles) around its own origin.
// It is placed under the superstructure, using the extremes of all superstructure elements:
//  - vertically: its top sits a bearing gap below the lowest point of the superstructure
//  - across: the pier cap is centred on the superstructure
//  - along: one copy at each end of the span, the pier centre on the end of the girders. The cap (width w) is shared
//    with the next span, so this span rests on half of it (w/2) and its bearings sit w/4 in from the end
// Pot-PTFE bearing on a concrete pedestal, under each girder at each pier (dimensions in metres)
const PEDESTAL = { plan: 0.7, height: 0.3 };
const BEARING = {
  height: 0.15, // base plate to sole plate
  basePlate: { plan: 0.6, thickness: 0.02 },
  pot: { diameter: 0.5, height: 0.08 },
  ptfe: { diameter: 0.4, thickness: 0.012 },
  solePlate: 0.55, // plan; its thickness takes up the rest of the height
};
const BEARING_GAP = PEDESTAL.height + BEARING.height; // pier cap top to the lowest point of the superstructure

// A few source models end the pier column a few cm below the pier cap. Raise its top face to just inside the cap.
function closePierCapGap(group) {
  const find = (re) => group.children.find((m) => re.test(m.name.toLowerCase()));
  const pier = find(/^pier$/);
  const cap = find(/^pier_cap/);
  if (!pier || !cap) return;
  const capBottom = new THREE.Box3().setFromObject(cap).min.y;
  const pierTop = new THREE.Box3().setFromObject(pier).max.y;
  if (capBottom <= pierTop) return;
  const pos = pier.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) >= pierTop - 1e-4) pos.setY(i, capBottom + 0.05);
  }
  pos.needsUpdate = true;
  pier.geometry.computeBoundingBox();
  pier.geometry.computeBoundingSphere();
}

function alignSubstructure(subGroup, superGroup) {
  const superBox = new THREE.Box3().setFromObject(superGroup);
  const subBox = new THREE.Box3().setFromObject(subGroup);
  const cap = subGroup.children.find((m) => /^pier_cap/.test(m.name.toLowerCase()));
  const capBox = cap ? new THREE.Box3().setFromObject(cap) : subBox;
  const capCenter = capBox.getCenter(new THREE.Vector3());
  const capWidth = capBox.max.x - capBox.min.x;

  const dy = superBox.min.y - BEARING_GAP - subBox.max.y;
  const dz = superBox.getCenter(new THREE.Vector3()).z - capCenter.z;
  const girders = girderSoffits(superGroup);
  const ends = girders.zs.length ? [girders.minX, girders.maxX] : [superBox.min.x, superBox.max.x];
  return {
    offsets: ends.map((x) => new THREE.Vector3(x - capCenter.x, dy, dz)),
    // this span rests on the inner half of each cap: bearings at the middle of it, w/4 from the end
    bearingXs: [ends[0] + capWidth / 4, ends[1] - capWidth / 4],
    girderZs: girders.zs,
    soffitY: girders.soffitY,
    lowestY: superBox.min.y,
  };
}

// Girders read from the vertices of their soffit: its level, the across-bridge position of each girder,
// and the length they cover. Other members (e.g. bracing chords) can hang lower, so it is the girders' own low point.
function girderSoffits(superGroup) {
  const girders = superGroup.children.filter((m) => m.name.toLowerCase().startsWith("girder"));
  const soffitY = Math.min(...girders.map((m) => new THREE.Box3().setFromObject(m).min.y));
  const zs = [];
  let minX = Infinity;
  let maxX = -Infinity;
  girders.forEach((m) => {
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > soffitY + 0.03) continue;
      zs.push(pos.getZ(i));
      minX = Math.min(minX, pos.getX(i));
      maxX = Math.max(maxX, pos.getX(i));
    }
  });
  zs.sort((a, b) => a - b);
  const clusters = [];
  zs.forEach((z) => {
    const last = clusters[clusters.length - 1];
    if (last && z - last.max < 0.5) last.max = z;
    else clusters.push({ min: z, max: z });
  });
  return { soffitY, zs: clusters.map((g) => (g.min + g.max) / 2), minX, maxX };
}

// Pedestal, pot-PTFE bearing parts and PTFE pad under each girder at each pier. Each kind is one mesh
// (one colour per group); returns [{ mesh, def }] with the group definition to list it under.
async function buildSupports({ bearingXs, girderZs, soffitY, lowestY }) {
  if (!girderZs.length) return [];
  const { mergeGeometries } = await import("https://unpkg.com/three@0.170.0/examples/jsm/utils/BufferGeometryUtils.js");

  const capTop = lowestY - BEARING_GAP;
  const baseBottom = capTop + PEDESTAL.height;
  const potBottom = baseBottom + BEARING.basePlate.thickness;
  const ptfeBottom = potBottom + BEARING.pot.height;
  const soleBottom = ptfeBottom + BEARING.ptfe.thickness;

  const box = (plan, bottom, top) => new THREE.BoxGeometry(plan, top - bottom, plan).translate(0, (bottom + top) / 2, 0);
  const disc = (diameter, bottom, top) =>
    new THREE.CylinderGeometry(diameter / 2, diameter / 2, top - bottom, 40).translate(0, (bottom + top) / 2, 0);

  // Build a group's geometries at every bearing position, as one mesh
  const group = (name, part, partID, parts) => {
    const geoms = [];
    bearingXs.forEach((x) =>
      girderZs.forEach((z) => parts.forEach((make) => geoms.push(make().translate(x, 0, z)))),
    );
    const mesh = new THREE.Mesh(mergeGeometries(geoms));
    mesh.name = name;
    return { mesh, def: { name, part, partIDs: [partID] } };
  };

  return [
    // the sole plate reaches up to the girder soffit, which can sit a few cm above the lowest point
    group("Bearings", "super", "injected_bearings_0", [
      () => box(BEARING.basePlate.plan, baseBottom, potBottom),
      () => disc(BEARING.pot.diameter, potBottom, ptfeBottom),
      () => box(BEARING.solePlate, soleBottom, soffitY),
    ]),
    group("PTFE Pads", "super", "injected_ptfe_0", [() => disc(BEARING.ptfe.diameter, ptfeBottom, soleBottom)]),
    group("Pedestals", "sub", "sub:injected_pedestals_0", [() => box(PEDESTAL.plan, capTop, baseBottom)]),
  ];
}

// ── Loaders ──────────────────────────────────────────────────
export async function loadOBJ(objPath, { subObjPath = null, span = 0 } = {}) {
  setLoadingState("Loading 3D model...");

  // Clear previous scene meshes
  while (state.modelGroup.children.length) state.modelGroup.remove(state.modelGroup.children[0]);
  state.scene.remove(state.modelGroup);
  state.modelGroup.position.set(0, 0, 0);
  state.meshMap.clear();
  state.groupMap.clear();
  state.hovered.clear();

  try {
    const { OBJLoader } = await import("https://unpkg.com/three@0.170.0/examples/jsm/loaders/OBJLoader.js");
    const loader = new OBJLoader();
    const loadFile = (path) => new Promise((resolve, reject) => loader.load(path, resolve, undefined, reject));

    // Load OBJ (and the substructure, when both parts are shown)
    const [loadedGroup, loadedSub] = await Promise.all([loadFile(objPath), subObjPath ? loadFile(subObjPath) : null]);
    const groupsList = state.modelGroupsData?.groups || [];
    setBridgeType(state.currentLoadedBridge?.bridge_type);
    closePierCapGap(loadedGroup);
    if (loadedSub) closePierCapGap(loadedSub);

    // Style a loaded group mesh, register its parts, and add it (plus any copies at `offsets`) to the scene
    const addMesh = (mesh, partPrefix = "", offsets = [null]) => {
      const normalizedName = mesh.name.toLowerCase(); // e.g. "pier_cap"

      // Find matching group in groupsData
      const groupDef = groupsList.find(
        (g) => g.name.replace(/\s+/g, "_").toLowerCase() === normalizedName
      );
      const groupName = groupDef ? groupDef.name : mesh.name;
      const partIDs = groupDef ? groupDef.partIDs : [];
      const firstPartID = partIDs.length > 0 ? partIDs[0] : `${partPrefix}${mesh.name}_0`;

      // Assign default standard material properties
      mesh.material = new THREE.MeshStandardMaterial({
        roughness: 0.35,
        metalness: 0.2,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1.0
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      mesh.userData = {
        partID: firstPartID,
        baseColor: 0x8a9ba8,
        originalColor: 0x8a9ba8,
        elemName: groupName,
        elemType: 0
      };

      const instances = offsets.map((offset, i) => {
        const inst = i === 0 ? mesh : mesh.clone();
        if (i > 0) inst.material = mesh.material.clone();
        if (offset) inst.position.copy(offset);
        state.modelGroup.add(inst);
        return inst;
      });

      // Map all partIDs of this group to its mesh(es) in state.meshMap
      if (partIDs.length > 0) {
        partIDs.forEach((pid) => {
          state.meshMap.set(pid, instances);
        });
      } else {
        state.meshMap.set(firstPartID, instances);
      }
    };

    [...loadedGroup.children].forEach((mesh) => addMesh(mesh));
    if (loadedSub) {
      const placement = alignSubstructure(loadedSub, state.modelGroup);
      const supports = await buildSupports(placement);
      supports.forEach(({ mesh, def }) => {
        // Bearings join the end of the superstructure groups, pedestals the end of the substructure groups
        const at = groupsList.reduce((n, g, i) => (g.part === def.part ? i + 1 : n), def.part === "super" ? 0 : groupsList.length);
        groupsList.splice(at, 0, def);
        addMesh(mesh);
      });
      [...loadedSub.children].forEach((mesh) => addMesh(mesh, "sub:", placement.offsets));
    }

    // Center model
    state.modelGroup.updateMatrixWorld(true);
    state.modelBox = new THREE.Box3().setFromObject(state.modelGroup);
    const size = state.modelBox.getSize(new THREE.Vector3());
    state.modelCenter = state.modelBox.getCenter(new THREE.Vector3());
    state.modelGroup.position.sub(state.modelCenter);
    state.modelGroup.position.y += 2;
    state.scene.add(state.modelGroup);
    state.modelGroup.updateMatrixWorld(true);
    fitLightingToModel();

    document.getElementById("project-title").textContent = state.bridgeData?.bridge_id || "OBJ Bridge Model";
    document.getElementById("span-chip").textContent =
      "Span: " + (loadedSub && span > 0 ? span : size.x).toFixed(1) + " m";
    state.ifcLoaded = true;
    updateGround(size);
    updateModelChip();

    // Render Groups Sidebar and apply coloring
    loadDefaultGroupsJSON();
    setLoadingState(null);
  } catch (err) {
    console.error("Failed to load OBJ model:", err);
    window.showToast("Could not load the 3D model: " + err.message);
    setLoadingState(null);
  }
}

export function loadDefaultGroupsJSON() {
  if (state.modelGroupsData && state.modelGroupsData.groups) {
    const groupsList = state.modelGroupsData.groups;

    // Reset mapping
    state.groupIndex.clear();
    state.groupMap.clear();

    groupsList.forEach((g) => {
      state.groupIndex.set(g.name, new Set());
    });

    state.meshMap.forEach((meshes, id) => {
      groupsList.forEach((g) => {
        if (g.partIDs.includes(id)) {
          state.groupIndex.get(g.name).add(id);
          mapPartToGroup(id, g.name);
        }
      });
    });

    // Apply colors
    groupsList.forEach((g) => {
      const colorHex = getMaterialColor(g.name);
      const color = new THREE.Color(colorHex);
      const style = getMaterialStyle(g.name);
      state.groupIndex.get(g.name)?.forEach((id) => {
        state.meshMap.get(id)?.forEach((m) => {
          m.material.color.set(color);
          m.material.roughness = style.roughness;
          m.material.metalness = style.metalness;
          m.userData.originalColor = color.getHex();
          if (g.name.startsWith("_")) {
            m.visible = false;
          }
        });
      });
    });

    renderGroupsPanel(groupsList);
    precomputeGroupBounds();
    return;
  }

  const groupsList = [
    { name: "deck_slab", color: "#dcd2c4" },
    { name: "girder_sections", color: "#8a9ba8" },
    { name: "cross_bracing", color: "#8a9ba8" },
    { name: "transverse_stiffeners_per_girder_side", color: "#8a9ba8" },
    { name: "bearing_stiffeners_per_girder_side", color: "#8a9ba8" },
  ];

  // Make mapping
  groupsList.forEach((g) => {
    state.groupIndex.set(g.name, new Set());
  });

  state.meshMap.forEach((meshes, id) => {
    if (id.startsWith("3131")) {
      state.groupIndex.get("deck_slab").add(id);
      mapPartToGroup(id, "deck_slab");
    } else if (
      id.startsWith("1805") ||
      id.startsWith("1835") ||
      id.startsWith("1911") ||
      id.startsWith("1941") ||
      id.startsWith("2017") ||
      id.startsWith("2047") ||
      id.startsWith("2123") ||
      id.startsWith("2153") ||
      id.startsWith("2229") ||
      id.startsWith("2259") ||
      id.startsWith("2335") ||
      id.startsWith("2365") ||
      id.startsWith("2441") ||
      id.startsWith("2471") ||
      id.startsWith("2547") ||
      id.startsWith("2577") ||
      id.startsWith("2653") ||
      id.startsWith("2683") ||
      id.startsWith("2759") ||
      id.startsWith("2789") ||
      id.startsWith("2865") ||
      id.startsWith("2895") ||
      id.startsWith("2971") ||
      id.startsWith("3001")
    ) {
      state.groupIndex.get("cross_bracing").add(id);
      mapPartToGroup(id, "cross_bracing");
    } else if (
      id.startsWith("277") ||
      id.startsWith("302") ||
      id.startsWith("327") ||
      id.startsWith("352") ||
      id.startsWith("377") ||
      id.startsWith("402") ||
      id.startsWith("427") ||
      id.startsWith("452") ||
      id.startsWith("477") ||
      id.startsWith("502") ||
      id.startsWith("527") ||
      id.startsWith("552") ||
      id.startsWith("769") ||
      id.startsWith("794") ||
      id.startsWith("819") ||
      id.startsWith("844") ||
      id.startsWith("869") ||
      id.startsWith("894") ||
      id.startsWith("919") ||
      id.startsWith("944") ||
      id.startsWith("969") ||
      id.startsWith("994") ||
      id.startsWith("1019") ||
      id.startsWith("1044") ||
      id.startsWith("1261") ||
      id.startsWith("1286") ||
      id.startsWith("1311") ||
      id.startsWith("1336") ||
      id.startsWith("1361") ||
      id.startsWith("1386") ||
      id.startsWith("1411") ||
      id.startsWith("1436") ||
      id.startsWith("1461") ||
      id.startsWith("1486") ||
      id.startsWith("1511") ||
      id.startsWith("1536")
    ) {
      state.groupIndex.get("transverse_stiffeners_per_girder_side").add(id);
      state.groupIndex.get("girder_sections").add(id);
      mapPartToGroup(id, "transverse_stiffeners_per_girder_side");
      mapPartToGroup(id, "girder_sections");
    } else if (
      id.startsWith("577") ||
      id.startsWith("601") ||
      id.startsWith("625") ||
      id.startsWith("649") ||
      id.startsWith("673") ||
      id.startsWith("697") ||
      id.startsWith("721") ||
      id.startsWith("745") ||
      id.startsWith("1069") ||
      id.startsWith("1093") ||
      id.startsWith("1117") ||
      id.startsWith("1141") ||
      id.startsWith("1165") ||
      id.startsWith("1189") ||
      id.startsWith("1213") ||
      id.startsWith("1237") ||
      id.startsWith("1561") ||
      id.startsWith("1585") ||
      id.startsWith("1609") ||
      id.startsWith("1633") ||
      id.startsWith("1657") ||
      id.startsWith("1681") ||
      id.startsWith("1705") ||
      id.startsWith("1729")
    ) {
      state.groupIndex.get("bearing_stiffeners_per_girder_side").add(id);
      mapPartToGroup(id, "bearing_stiffeners_per_girder_side");
    } else if (
      id.startsWith("46") ||
      id.startsWith("123") ||
      id.startsWith("200") ||
      id.startsWith("73") ||
      id.startsWith("150") ||
      id.startsWith("227") ||
      id.startsWith("98") ||
      id.startsWith("175") ||
      id.startsWith("252")
    ) {
      state.groupIndex.get("girder_sections").add(id);
      mapPartToGroup(id, "girder_sections");
    }
  });

  // Apply colors
  groupsList.forEach((g) => {
    const colorHex = getMaterialColor(g.name);
    const color = new THREE.Color(colorHex);
    const style = getMaterialStyle(g.name);
    state.groupIndex.get(g.name)?.forEach((id) => {
      state.meshMap.get(id)?.forEach((m) => {
        m.material.color.set(color);
        m.material.roughness = style.roughness;
        m.material.metalness = style.metalness;
        m.userData.originalColor = color.getHex();
        if (g.name.startsWith("_")) {
          m.visible = false;
        }
      });
    });
  });

  renderGroupsPanel(groupsList);
  precomputeGroupBounds();
}

function mapPartToGroup(partID, groupName) {
  if (!state.groupMap.has(partID)) state.groupMap.set(partID, []);
  state.groupMap
    .get(partID)
    .push({ name: groupName, meta: { length: "", custom: [] } });
}

// Subtle ground grid under the model, for scale and grounding
function updateGround(size) {
  if (state.groundGrid) {
    state.scene.remove(state.groundGrid);
    state.groundGrid.geometry.dispose();
    state.groundGrid.material.dispose();
  }
  const extent = Math.max(size.x, size.z) * 2.5;
  const divisions = Math.max(10, Math.round(extent / 5));
  const dark = document.documentElement.getAttribute("data-bs-theme") !== "light";
  const grid = new THREE.GridHelper(extent, divisions, dark ? 0x4a5a78 : 0x94a3b8, dark ? 0x2b3752 : 0xcbd5e1);
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  // Ground level: the top of the pile caps when the substructure is shown (piles go below it), else the model's base
  const pileCap = state.modelGroup.children.find((m) => /^pile_cap/.test(m.name.toLowerCase()));
  const groundY = pileCap ? new THREE.Box3().setFromObject(pileCap).max.y : state.modelBox.min.y - state.modelCenter.y + state.modelGroup.position.y;
  grid.position.y = groundY - 0.05;
  state.scene.add(grid);
  state.groundGrid = grid;
}

// Summary line above the viewport: Mumbai · Steel · 20 m span · 2 lanes · With footpath
function updateModelChip() {
  const chip = document.getElementById("model-chip");
  const d = state.bridgeData;
  if (!chip || !d) return;
  const shown = { Both: "Super + Sub", Superstructure: "Superstructure", Substructure: "Substructure" }[state.loadedStructure];
  const parts = [
    d.location,
    state.currentLoadedBridge?.bridge_type,
    shown,
    d.span_m ? d.span_m + " m span" : null,
    d.lanes ? d.lanes + " lanes" : null,
    d.has_footpath ? "With footpath" : "No footpath",
  ].filter(Boolean);
  chip.textContent = parts.join("  ·  ");
  chip.hidden = false;
}
