export const COLOR = {
  BEAM: 0x8a9ba8, // Light slate steel gray
  BRACE: 0x8a9ba8, // Steel cross bracing (steel color)
  CONCRETE: 0xdcd2c4, // Sandy concrete style
  HOVER: 0x3b82f6, // Interactive highlight (Corporate Blue)
  SELECT: 0xf5a020, // Select color (Orange-Yellow)
};

export const IFCTYPES = {
  625: "IFCBEAM",
  66: "IFCBUILDINGELEMENTPROXY",
  583: "IFCMEMBER",
  793: "IFCPLATE",
  1048: "IFCCOLUMN",
  247: "IFCSLAB",
};

export function getIsConcrete(groupName) {
  const name = groupName.toLowerCase();
  return name.includes("deck") || 
         name.includes("slab") || 
         name.includes("pier") || 
         name.includes("column") || 
         name.includes("shaft") || 
         name.includes("cap") || 
         name.includes("abutment") || 
         name.includes("pile") || 
         name.includes("concrete") || 
         name.includes("foundation");
}

// ── Cinematic palette ────────────────────────────────────────
// First matching rule wins, so specific names come before generic ones.
// Concrete: warm, matte. Steel: cool, glossy. Accents: saturated, so they pop.
const MATERIAL_STYLES = [
  // Deck furniture added by convert_ifc_to_obj.js (see barrier_geometry.js)
  { match: /lane marking/, color: "#f8fafc", roughness: 0.6, metalness: 0.0 },
  { match: /carriageway/, color: "#262b33", roughness: 0.92, metalness: 0.0 },
  { match: /footpath/, color: "#7d7a74", roughness: 0.85, metalness: 0.0 },
  { match: /crash barrier/, color: "#8a867e", roughness: 0.8, metalness: 0.0 },
  { match: /railing/, color: "#9aa5b1", roughness: 0.4, metalness: 0.8 },
  // Concrete substructure: deeper at the base, lighter towards the deck
  { match: /pile cap/, color: "#55534f", roughness: 0.9, metalness: 0.0 },
  { match: /pile|foundation/, color: "#45433f", roughness: 0.95, metalness: 0.0 },
  { match: /pier cap|abutment|cap/, color: "#78746c", roughness: 0.85, metalness: 0.0 },
  { match: /pier|column|shaft/, color: "#6c6861", roughness: 0.88, metalness: 0.0 },
  // Superstructure
  { match: /deck|slab/, color: "#8f8a80", roughness: 0.82, metalness: 0.0 },
  { match: /diaphragm|brace|bracing/, color: "#4f8fb8", roughness: 0.35, metalness: 0.75 },
  { match: /stiffener/, color: "#6aa6c9", roughness: 0.35, metalness: 0.75 },
  { match: /chord/, color: "#3f6f95", roughness: 0.3, metalness: 0.8 },
  { match: /girder/, color: "#5b7f9e", roughness: 0.32, metalness: 0.8 },
];

const DEFAULT_STYLE = { color: "#8a9ba8", roughness: 0.4, metalness: 0.6 };

/** Colour, roughness and metalness for a group, by name. */
export function getMaterialStyle(groupName) {
  const name = groupName.toLowerCase();
  return MATERIAL_STYLES.find((s) => s.match.test(name)) || DEFAULT_STYLE;
}

export function getMaterialColor(groupName) {
  return getMaterialStyle(groupName).color;
}

// Deck furniture widths in metres. Keep in sync with barrier_geometry.js.
export const DECK_DIMS = {
  crashBarrierWidth: 0.45,
  footpathWidth: 1.5,
  footpathHeight: 0.1,
  plinthWidth: 0.375,
  railingHeight: 1.1,
  railingPost: 0.1,
  railingPostSpacing: 2.0,
  railingTopRail: 0.08,
  railingRail: 0.05,
};

/** Standard lane width in metres: 3.75 on two lanes (7.5 m carriageway), 3.5 per lane on three. Keep in sync with barrier_geometry.js. */
export function standardLaneWidth(lanes) {
  return lanes <= 2 ? 3.75 : 3.5;
}
