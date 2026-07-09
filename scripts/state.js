import * as THREE from "three";

export const state = {
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
  modelGroupsData: null,

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
