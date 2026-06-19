import * as THREE from "three";
import { state } from "./state.js";
import { COLOR } from "./constants.js";
import {
  clearHoverState,
  applyHoverVisuals,
  handleSelection,
  resetAllFilters
} from "./selection.js";

// ── Hover interaction and HUD telemetry updates ────────────────
function getGirderSegmentIndex(x) {
  if (!state.bridgeData || !state.bridgeData.girder_sections?.longitudinal_segmentation_m)
    return -1;
  const segs = state.bridgeData.girder_sections.longitudinal_segmentation_m;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (seg.initial_m === seg.end_m) continue;
    const worldStart = seg.initial_m - state.modelCenter.x;
    const worldEnd = seg.end_m - state.modelCenter.x;
    if (x >= worldStart && x <= worldEnd) {
      return i;
    }
  }
  return -1;
}

export function initInteraction() {
  const W = () => state.viewportContainer.clientWidth;
  const H = () => state.viewportContainer.clientHeight;

  // ── Event listener for hover ──────────────────────────────────
  state.viewportContainer.addEventListener("mousemove", (e) => {
    if (!state.ifcLoaded) return;

    const rect = state.renderer.domElement.getBoundingClientRect();
    state.mouse.x = ((e.clientX - rect.left) / W()) * 2 - 1;
    state.mouse.y = -((e.clientY - rect.top) / H()) * 2 + 1;

    state.raycaster.setFromCamera(state.mouse, state.camera);
    const hits = state.raycaster
      .intersectObjects(state.modelGroup.children, false)
      .filter((h) => h.object.visible);

    if (!hits.length) {
      clearHoverState();
      return;
    }

    const partID = hits[0].object.userData.partID;
    const groups = state.groupMap.get(partID);

    if (!groups || groups.length === 0) {
      clearHoverState();
      return;
    }

    const groupName = groups[0].name;
    const hitPoint = hits[0].point.clone();

    let segmentIndex = -1;
    if (
      groupName === "girder_sections" &&
      state.bridgeData &&
      state.bridgeData.girder_sections?.longitudinal_segmentation_m
    ) {
      segmentIndex = getGirderSegmentIndex(hitPoint.x);
    }

    const hoverKey =
      groupName + (segmentIndex !== -1 ? `_seg_${segmentIndex}` : "");

    if (state.currentHoveredGroup === hoverKey) return;

    state.currentHoveredGroup = hoverKey;
    applyHoverVisuals(groupName, segmentIndex);
  });

  // ── Raycasting intersection click triggers ────────────────────
  let mouseDownPos = null;
  state.viewportContainer.addEventListener("mousedown", (e) => {
    mouseDownPos = { x: e.clientX, y: e.clientY };
  });

  state.viewportContainer.addEventListener("click", (e) => {
    if (!state.ifcLoaded) return;

    if (mouseDownPos) {
      const dx = e.clientX - mouseDownPos.x;
      const dy = e.clientY - mouseDownPos.y;
      if (Math.hypot(dx, dy) > 4) return; // Ignore drag/orbit releases
    }

    // Compute boundaries relative to container
    const rect = state.renderer.domElement.getBoundingClientRect();
    state.mouse.x = ((e.clientX - rect.left) / W()) * 2 - 1;
    state.mouse.y = -((e.clientY - rect.top) / H()) * 2 + 1;

    state.raycaster.setFromCamera(state.mouse, state.camera);
    const hits = state.raycaster
      .intersectObjects(state.modelGroup.children, false)
      .filter((h) => h.object.visible);

    if (!hits.length) {
      resetAllFilters();
      return;
    }

    const partID = hits[0].object.userData.partID;
    const groups = state.groupMap.get(partID);

    if (!groups || groups.length === 0) {
      resetAllFilters();
      return;
    }

    const groupName = groups[0].name;
    handleSelection(groupName, hits[0].point.clone(), false);
  });

  // ── Global Keyboard Shortcuts ──────────────────────────────────
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      resetAllFilters();
    }
  });
}
