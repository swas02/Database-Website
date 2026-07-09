import * as THREE from "three";
import { state } from "./state.js";
import { COLOR, IFCTYPES, getMaterialColor, getIsConcrete } from "./constants.js";
import { setLoadingState, renderGroupsPanel } from "./ui.js";
import { precomputeGroupBounds } from "./selection.js";

// ── Loaders ──────────────────────────────────────────────────
export async function loadOBJ(objPath) {
  setLoadingState("Loading 3D model...");

  // Clear previous scene meshes
  while (state.modelGroup.children.length) state.modelGroup.remove(state.modelGroup.children[0]);
  state.scene.remove(state.modelGroup);
  state.meshMap.clear();
  state.groupMap.clear();
  state.hovered.clear();

  try {
    const { OBJLoader } = await import("https://unpkg.com/three@0.170.0/examples/jsm/loaders/OBJLoader.js");
    const loader = new OBJLoader();

    // Load OBJ
    const loadedGroup = await new Promise((resolve, reject) => {
      loader.load(objPath, resolve, undefined, reject);
    });

    const children = [...loadedGroup.children];
    children.forEach((mesh) => {
      const normalizedName = mesh.name.toLowerCase(); // e.g. "pier_cap"
      
      // Find matching group in groupsData
      const groupsList = state.modelGroupsData?.groups || [];
      const groupDef = groupsList.find(
        (g) => g.name.replace(/\s+/g, "_").toLowerCase() === normalizedName
      );
      const groupName = groupDef ? groupDef.name : mesh.name;
      const partIDs = groupDef ? groupDef.partIDs : [];
      const firstPartID = partIDs.length > 0 ? partIDs[0] : `${mesh.name}_0`;

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

      state.modelGroup.add(mesh);

      // Map all partIDs of this group to this mesh in state.meshMap
      if (partIDs.length > 0) {
        partIDs.forEach((pid) => {
          state.meshMap.set(pid, [mesh]);
        });
      } else {
        state.meshMap.set(firstPartID, [mesh]);
      }
    });

    // Center model
    state.modelBox = new THREE.Box3().setFromObject(state.modelGroup);
    const size = state.modelBox.getSize(new THREE.Vector3());
    state.modelCenter = state.modelBox.getCenter(new THREE.Vector3());
    state.modelGroup.position.sub(state.modelCenter);
    state.modelGroup.position.y += 2;
    state.scene.add(state.modelGroup);
    state.modelGroup.updateMatrixWorld(true);

    document.getElementById("project-title").textContent = state.bridgeData?.bridge_id || "OBJ Bridge Model";
    document.getElementById("span-chip").textContent =
      "Span: " + size.x.toFixed(1) + " m";
    state.ifcLoaded = true;

    // Render Groups Sidebar and apply coloring
    loadDefaultGroupsJSON();
    setLoadingState(null);
  } catch (err) {
    console.error("Failed to load OBJ model:", err);
    alert("Error loading 3D model: " + err.message);
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
      const isConcrete = getIsConcrete(g.name);
      state.groupIndex.get(g.name)?.forEach((id) => {
        state.meshMap.get(id)?.forEach((m) => {
          m.material.color.set(color);
          m.material.roughness = isConcrete ? 0.8 : 0.35;
          m.material.metalness = isConcrete ? 0.1 : 0.2;
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
    const isConcrete = getIsConcrete(g.name);
    state.groupIndex.get(g.name)?.forEach((id) => {
      state.meshMap.get(id)?.forEach((m) => {
        m.material.color.set(color);
        m.material.roughness = isConcrete ? 0.8 : 0.35;
        m.material.metalness = isConcrete ? 0.1 : 0.2;
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
