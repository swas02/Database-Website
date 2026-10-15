// Common properties for the injected crash barrier, railing and deck furniture.
// They are the same for every model, so they live here instead of in the injector.
// All dimensions are in metres.

// Railing and crash barrier are real groups: they appear in the groups panel
// and can be selected/isolated like any other part.
export const BARRIER_GROUPS = {
  railing: { name: "Railing", partID: "injected_railing_0", color: 0x3b82f6 },
  barrier: { name: "Crash Barrier", partID: "injected_crash_barrier_0", color: 0xef4444 },
};

// Non-selectable helper sheets (footpath, carriageway, lane markings).
export const HELPER_NAME = "injected_helpers";

export const HELPER_COLORS = {
  footpath: 0x9ca3af,
  road: 0x374151,
  lane: 0xffffff,
};

// Layout
export const LAYOUT = {
  edgeInset: 0,
  footpathSide: 1, // footpath is on one side only: 1 = max-width edge, -1 = min-width edge
  footpathWidth: 1.5,
  footpathHeight: 0.1,
  plinthWidth: 0.375, // railing plinth, part of the footpath block
  laneLineWidth: 0.15,
};

// Crash barrier: 450 wide, 1100 high (900 on the footpath side).
export const CRASH_BARRIER = {
  height: 1.1,
  heightFootpathSide: 0.9,
  width: 0.45,
  // Cross-section, u = distance from the outer (vertical) face, v = height.
  // `top` is replaced by the barrier height.
  profile: [
    [0, 0],
    [0, "top"],
    [0.175, "top"],
    [0.225, 0.35],
    [0.45, 0.1],
    [0.45, 0],
  ],
};

// Steel railing (post-and-rail; sizes are assumptions, drawing gives only "clause 109.7").
export const RAILING = {
  height: 1.1,
  postSize: 0.1,
  postSpacing: 2.0,
  topRailSize: 0.08,
  railSize: 0.05,
  railHeights: [0.2, 0.5, 0.8], // intermediate rails above the base
};
