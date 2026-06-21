import * as THREE from "three";
import * as WebIFC from "https://unpkg.com/web-ifc@0.0.77/web-ifc-api.js";
import { state } from "./state.js";
import { COLOR, IFCTYPES, getMaterialColor, getIsConcrete } from "./constants.js";
import { setLoadingState, renderGroupsPanel } from "./ui.js";
import { precomputeGroupBounds } from "./selection.js";

// ── Loaders ──────────────────────────────────────────────────
export async function loadIFC(arrayBuffer) {
  setLoadingState("Loading WebAssembly parser...");
  if (!state.ifcInitDone) {
    state.ifc.SetWasmPath("./ifc_wasm/");
    await state.ifc.Init();
    state.ifcInitDone = true;
  }

  // Clear previous scene meshes
  while (state.modelGroup.children.length) state.modelGroup.remove(state.modelGroup.children[0]);
  state.scene.remove(state.modelGroup);
  state.meshMap.clear();
  state.groupMap.clear();
  state.hovered.clear();

  setLoadingState("Generating WebGL meshes...");
  const data = new Uint8Array(arrayBuffer);
  const modelID = state.ifc.OpenModel(data);
  const allGeometry = state.ifc.LoadAllGeometry(modelID);

  for (let i = 0; i < allGeometry.size(); i++) {
    const placed = allGeometry.get(i);
    let elemType = 0,
      elemName = "";
    try {
      const line = state.ifc.GetLine(modelID, placed.expressID);
      elemType = line.type;
      elemName = line.Name?.value || "";
    } catch (_) {}

    const meshColor =
      elemType === WebIFC.IFCBUILDINGELEMENTPROXY ||
      elemName.toLowerCase().includes("brace")
        ? COLOR.BRACE
        : COLOR.BEAM;

    for (let j = 0; j < placed.geometries.size(); j++) {
      const part = placed.geometries.get(j);
      const geo = state.ifc.GetGeometry(modelID, part.geometryExpressID);
      const verts = state.ifc.GetVertexArray(
        geo.GetVertexData(),
        geo.GetVertexDataSize(),
      );
      const inds = state.ifc.GetIndexArray(
        geo.GetIndexData(),
        geo.GetIndexDataSize(),
      );

      const positions = [];
      for (let k = 0; k < verts.length; k += 6)
        positions.push(verts[k], verts[k + 1], verts[k + 2]);

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geometry.setIndex(Array.from(inds));
      geometry.computeVertexNormals();

      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: meshColor,
          roughness: 0.35,
          metalness: 0.2,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 1.0,
        }),
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      if (part.flatTransformation?.length === 16)
        mesh.applyMatrix4(
          new THREE.Matrix4().fromArray(part.flatTransformation),
        );

      mesh.userData = {
        partID: `${placed.expressID}_${j}`,
        baseColor: meshColor,
        originalColor: meshColor,
        elemName,
        elemType,
      };
      state.modelGroup.add(mesh);
      if (!state.meshMap.has(mesh.userData.partID))
        state.meshMap.set(mesh.userData.partID, []);
      state.meshMap.get(mesh.userData.partID).push(mesh);
    }
  }

  // Centre model
  state.modelBox = new THREE.Box3().setFromObject(state.modelGroup);
  const size = state.modelBox.getSize(new THREE.Vector3());
  state.modelCenter = state.modelBox.getCenter(new THREE.Vector3());
  state.modelGroup.position.sub(state.modelCenter);
  state.modelGroup.position.y += 2;
  state.scene.add(state.modelGroup);
  state.modelGroup.updateMatrixWorld(true);

  // Auto Concrete Coloring
  const threshold = size.y * 0.35 - state.modelCenter.y;
  state.modelGroup.traverse((obj) => {
    if (
      obj.isMesh &&
      obj.userData.elemType !== WebIFC.IFCBUILDINGELEMENTPROXY
    ) {
      if (
        new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3()).y >
        threshold
      ) {
        obj.material = obj.material.clone();
        obj.material.color.set(COLOR.CONCRETE);
        obj.material.roughness = 0.8;
        obj.material.metalness = 0.1;
        obj.userData.baseColor = COLOR.CONCRETE;
        obj.userData.originalColor = COLOR.CONCRETE;
      }
    }
  });

  document.getElementById("project-title").textContent = "IFC Bridge Model";
  document.getElementById("span-chip").textContent =
    "Span: " + size.x.toFixed(1) + " m";
  state.ifcLoaded = true;

  // Render Groups Sidebar
  loadDefaultGroupsJSON();
  setLoadingState(null);
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
