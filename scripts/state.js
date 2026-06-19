import * as THREE from "three";
import * as WebIFC from "https://unpkg.com/web-ifc@0.0.77/web-ifc-api.js";

export const state = {
  ifc: new WebIFC.IfcAPI(),
  modelGroup: new THREE.Group(),
  meshMap: new Map(), // partID -> Mesh[]
  groupMap: new Map(), // partID -> Array of group names
  groupIndex: new Map(), // groupName -> Set of partIDs
  raycaster: new THREE.Raycaster(),
  mouse: new THREE.Vector2(),

  ifcHash: null,
  ifcLoaded: false,
  ifcInitDone: false,
  bridgeData: null,
  modelBox: null,
  modelCenter: null,
  hovered: new Set(),
  selection: null, // { groupKey, groups, hitPoint }
  isolateMode: true,
  activeSidebarTab: "groups",

  // Camera transition variables
  targetCamPos: null,
  targetControlsTarget: null,

  // Label tracking arrays
  segmentHelpers: [],
  currentHoveredGroup: null,
  activeHoveredMeshes: [],

  // Three.js instances
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  viewportContainer: null,
};
