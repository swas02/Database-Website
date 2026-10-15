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

// Deck furniture added by convert_ifc_to_obj.js (see barrier_geometry.js)
const FURNITURE_COLORS = {
  railing: "#3b82f6",
  "crash barrier": "#ef4444",
  footpath: "#9ca3af",
  carriageway: "#374151",
  "lane markings": "#ffffff",
};

export function getMaterialColor(groupName) {
  const furniture = FURNITURE_COLORS[groupName.toLowerCase()];
  if (furniture) return furniture;
  return getIsConcrete(groupName) ? "#dcd2c4" : "#8a9ba8";
}
