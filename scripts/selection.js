import * as THREE from "three";
import { state } from "./state.js";
import { COLOR } from "./constants.js";
import { updatePropertyInspector } from "./ui.js";

const fadedMaterials = new Map();

function getFadedMaterial(baseMaterial) {
  const key = baseMaterial.uuid;
  if (!fadedMaterials.has(key)) {
    const faded = baseMaterial.clone();
    faded.transparent = true;
    faded.opacity = 0.04;
    faded.depthWrite = false; // Prevent ghosted slab from occluding components underneath
    fadedMaterials.set(key, faded);
  }
  return fadedMaterials.get(key);
}

export function updateIsolationVisuals() {
  if (!state.ifcLoaded) return;
  const selectedIDs = state.selection
    ? (() => {
        const s = new Set();
        state.selection.groups.forEach((g) =>
          state.groupIndex.get(g.name)?.forEach((id) => s.add(id)),
        );
        return s;
      })()
    : new Set();

  state.meshMap.forEach((meshes, id) => {
    meshes.forEach((m) => {
      if (!m.userData.originalMaterial) {
        m.userData.originalMaterial = m.material;
      }
      const baseMat = m.userData.originalMaterial;

      if (selectedIDs.has(id)) {
        m.material = baseMat;
        m.material.color.set(COLOR.SELECT);
      } else {
        baseMat.color.set(m.userData.originalColor);
        if (state.isolateMode && selectedIDs.size > 0) {
          m.material = getFadedMaterial(baseMat);
        } else {
          m.material = baseMat;
        }
      }
    });
  });
}

// ── Bounding Box helpers ──────────────────────────────────────
export function getSegmentHelper(index) {
  if (!state.segmentHelpers[index]) {
    const helper = new THREE.Box3Helper(new THREE.Box3(), 0x3b82f6);
    helper.material.transparent = true;
    helper.material.opacity = 0.4;
    helper.visible = false;
    state.scene.add(helper);
    state.segmentHelpers[index] = helper;
  }
  return state.segmentHelpers[index];
}

export function clearSegmentation() {
  state.segmentHelpers.forEach((h) => (h.visible = false));
}

const groupBoundsMap = new Map(); // groupName -> { box: THREE.Box3, center: THREE.Vector3, meshes: THREE.Mesh[] }

export function precomputeGroupBounds() {
  groupBoundsMap.clear();

  state.groupIndex.forEach((partIDs, groupName) => {
    const box = new THREE.Box3();
    const meshes = [];

    partIDs.forEach((id) => {
      state.meshMap.get(id)?.forEach((m) => {
        meshes.push(m);
        if (!m.geometry.boundingBox) {
          m.geometry.computeBoundingBox();
        }
        const meshBox = m.geometry.boundingBox
          .clone()
          .applyMatrix4(m.matrixWorld);
        box.expandByPoint(meshBox.min);
        box.expandByPoint(meshBox.max);
      });
    });

    if (meshes.length > 0) {
      const center = new THREE.Vector3();
      box.getCenter(center);
      groupBoundsMap.set(groupName, { box, center, meshes });
    }
  });
}

export function focusCameraOnPrecomputedBounds(bounds) {
  const box = bounds.box;
  const center = bounds.center;

  const size = new THREE.Vector3();
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = state.camera.fov * (Math.PI / 180);
  let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2));

  cameraDistance *= 1.35; // margin padding

  const camDir = new THREE.Vector3()
    .subVectors(state.camera.position, state.controls.target)
    .normalize();
  const newCamPos = new THREE.Vector3().addVectors(
    center,
    camDir.multiplyScalar(cameraDistance),
  );

  state.camera.position.copy(newCamPos);
  state.controls.target.copy(center);
  state.controls.update();
}

export function handleSelection(groupName, hitPoint, focusCamera = false) {
  const groupKey = groupName;
  if (state.selection?.groupKey === groupKey) {
    resetAllFilters();
    return;
  }

  clearSegmentation();

  const groups = [{ name: groupName, meta: { length: "", custom: [] } }];
  state.selection = { groupKey, groups, hitPoint: hitPoint.clone() };
  applySelectedVisuals(groups, hitPoint.clone());
  updateIsolationVisuals();
  updatePropertyInspector(groups[0]);

  if (focusCamera) {
    const bounds = groupBoundsMap.get(groupName);
    if (bounds) {
      focusCameraOnPrecomputedBounds(bounds);
    }
  }
}

window.selectGroup = function (groupName) {
  const bounds = groupBoundsMap.get(groupName);
  if (!bounds) return;
  handleSelection(groupName, bounds.center, false);
};

window.toggleGroupVisibility = function (groupName, btn) {
  const isHidden = btn.classList.toggle("hidden");
  btn.innerHTML = isHidden
    ? `<i class="bi bi-eye-slash-fill"></i>`
    : `<i class="bi bi-eye-fill"></i>`;

  state.groupIndex.get(groupName)?.forEach((id) => {
    state.meshMap.get(id)?.forEach((m) => {
      m.visible = !isHidden;
    });
  });
};

window.highlightSegment3D = function (index, highlight) {
  const helper = state.segmentHelpers[index];
  if (helper) {
    helper.material.opacity = highlight ? 0.95 : 0.4;
    helper.material.color.setHex(0x3b82f6); // Corporate Blue
  }
};

export function applySelectedVisuals(groups, hitPoint) {
  clearHover(true);

  const allMemberIDs = new Set();
  groups.forEach(({ name }) =>
    state.groupIndex.get(name)?.forEach((id) => allMemberIDs.add(id)),
  );

  allMemberIDs.forEach((id) => {
    state.hovered.add(id);
  });

  const hoveredGroups = groups.map((g) => g.name);

  // Highlight active sidebar item
  document.querySelectorAll(".group-item").forEach((item) => {
    item.classList.toggle(
      "active",
      hoveredGroups.includes(item.getAttribute("data-group")),
    );
  });
}

export function clearHover(keepSelection = false) {
  const selIDs =
    keepSelection && state.selection
      ? (() => {
          const s = new Set();
          state.selection.groups.forEach(({ name }) =>
            state.groupIndex.get(name)?.forEach((id) => s.add(id)),
          );
          return s;
        })()
      : new Set();
  state.hovered.forEach((id) => {
    if (selIDs.has(id)) return;
    state.meshMap.get(id)?.forEach((m) => {
      m.material.color.set(m.userData.originalColor);
    });
  });
  state.hovered.clear();
  selIDs.forEach((id) => state.hovered.add(id));
}

export function resetAllFilters() {
  state.selection = null;
  clearHover();
  clearSegmentation();
  updateIsolationVisuals();
  
  if (window.switchRightTab) {
    window.switchRightTab("groups");
  }

  // Collapse the right panel on filter reset
  const rp = document.getElementById("right-panel");
  const rt = document.getElementById("right-trigger");
  if (rp) {
    rp.classList.add("collapsed");
    if (rt) rt.style.display = "block";
  }



  document
    .querySelectorAll(".group-item")
    .forEach((item) => item.classList.remove("active"));

  document
    .querySelectorAll(".group-details-accordion")
    .forEach((acc) => {
      acc.style.display = "none";
      acc.innerHTML = "";
    });
}
window.resetAllFilters = resetAllFilters;

// ── Real-time Color Override ──
window.changeGroupColor = function (groupName, hexVal) {
  const c = new THREE.Color(hexVal);
  state.groupIndex.get(groupName)?.forEach((id) => {
    state.meshMap.get(id)?.forEach((m) => {
      m.material.color.set(c);
      m.userData.originalColor = c.getHex();
    });
  });

  fadedMaterials.clear(); // Clear cached faded materials so they inherit the new color

  // Update dot style
  const items = document.querySelectorAll(".group-item");
  items.forEach((item) => {
    if (item.getAttribute("data-group") === groupName) {
      const dot = item.querySelector(".group-dot");
      const picker = item.querySelector(".color-picker-wrapper");
      dot.style.color = hexVal;
      dot.style.backgroundColor = hexVal;
      picker.style.backgroundColor = hexVal;
    }
  });
};

export function applyHoverVisuals(groupName, segmentIndex) {
  restoreHoveredColors();

  const parts = state.groupIndex.get(groupName);
  if (!parts) return;

  parts.forEach((id) => {
    state.meshMap.get(id)?.forEach((m) => {
      m.material.color.set(COLOR.HOVER);
      state.activeHoveredMeshes.push(m);
    });
  });
}

function isMeshSelected(m) {
  if (!state.selection || !state.selection.groups) return false;
  const partID = m.userData.partID;
  return state.selection.groups.some((g) => state.groupIndex.get(g.name)?.has(partID));
}

export function restoreHoveredColors() {
  state.activeHoveredMeshes.forEach((m) => {
    if (isMeshSelected(m)) {
      m.material.color.set(COLOR.SELECT);
    } else {
      m.material.color.set(m.userData.originalColor);
    }
  });
  state.activeHoveredMeshes = [];
}

export function clearHoverState() {
  if (state.currentHoveredGroup === null) return;
  state.currentHoveredGroup = null;
  restoreHoveredColors();
}
