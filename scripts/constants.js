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

export function getMaterialColor(groupName) {
  return getIsConcrete(groupName) ? "#dcd2c4" : "#8a9ba8";
}
