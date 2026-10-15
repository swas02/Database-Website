import * as THREE from "three";
import { OrbitControls } from "https://unpkg.com/three@0.170.0/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "https://unpkg.com/three@0.170.0/examples/jsm/environments/RoomEnvironment.js";
import { state } from "./state.js";

// Key light, re-fitted to each model (shadow frustum)
let keyLight = null;

export function initViewer() {
  state.viewportContainer = document.getElementById("viewport-container");
  const W = () => state.viewportContainer.clientWidth;
  const H = () => state.viewportContainer.clientHeight;

  state.scene = new THREE.Scene();
  state.scene.background = null; // transparent background so CSS gradient shows through

  state.camera = new THREE.PerspectiveCamera(50, W() / H(), 0.1, 10000);
  state.camera.position.set(120, 70, 120);

  state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  state.renderer.setPixelRatio(window.devicePixelRatio);
  applyViewOffset(W(), H());
  state.renderer.setSize(W(), H());
  // Cinematic look: filmic tone mapping, sRGB output, soft shadows
  state.renderer.outputColorSpace = THREE.SRGBColorSpace;
  state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  state.renderer.toneMappingExposure = 1.05;
  state.renderer.shadowMap.enabled = true;
  state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  state.viewportContainer.appendChild(state.renderer.domElement);

  state.controls = new OrbitControls(state.camera, state.renderer.domElement);
  state.controls.enableDamping = true;
  state.controls.dampingFactor = 0.05;

  // Lighting: image-based reflections + warm key, cool rim, sky/ground fill
  const pmrem = new THREE.PMREMGenerator(state.renderer);
  state.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  state.scene.environmentIntensity = 0.55;

  state.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2a2118, 0.55));

  keyLight = new THREE.DirectionalLight(0xffe7c4, 3.2); // warm, low "golden hour" sun
  keyLight.position.set(120, 140, 80);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.normalBias = 0.05;
  keyLight.shadow.radius = 4;
  state.scene.add(keyLight);
  state.scene.add(keyLight.target);

  const rimLight = new THREE.DirectionalLight(0x6fa8ff, 1.4); // cool rim from behind
  rimLight.position.set(-120, 60, -110);
  state.scene.add(rimLight);

  // Fog Setup
  state.scene.fog = null;

  // Resize handler using ResizeObserver
  const resizeObserver = new ResizeObserver(() => {
    const width = W();
    const height = H();
    if (width && height) {
      state.camera.aspect = width / height;
      applyViewOffset(width, height);
      state.renderer.setSize(width, height);
    }
  });
  resizeObserver.observe(state.viewportContainer);
}

// On desktop the side panels cover the left ~372px: shift the image so the model sits in the free area.
function applyViewOffset(width, height) {
  const shift = 0; // the desktop sidebar is docked beside the viewport, so no offset is needed
  if (shift) state.camera.setViewOffset(width, height, -shift, 0, width, height);
  else state.camera.clearViewOffset();
  state.camera.updateProjectionMatrix();
}

/**
 * Fit the key light's shadow frustum to the loaded model. Call after the model is added and positioned.
 */
export function fitLightingToModel() {
  if (!keyLight || !state.modelGroup) return;
  state.modelGroup.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(state.modelGroup);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2;

  keyLight.target.position.copy(center);
  keyLight.position.copy(center).add(new THREE.Vector3(0.6, 0.7, 0.4).multiplyScalar(radius * 2.2));
  const cam = keyLight.shadow.camera;
  cam.left = cam.bottom = -radius;
  cam.right = cam.top = radius;
  cam.near = 0.5;
  cam.far = radius * 5;
  cam.updateProjectionMatrix();
}

// ── Camera Preset ─────────────────────────────────────────────
window.setCameraPreset = function (preset) {
  if (window.switchRightTab && state.activeSidebarTab === "lcca") {
    window.switchRightTab("groups");
  }
  if (!state.modelCenter || !state.modelBox) return;
  const target = new THREE.Vector3(0, 2, 0); // world center
  
  // Calculate dynamic fit distance
  const size = state.modelBox.getSize(new THREE.Vector3());
  const radius = size.length() / 2;
  const vfov = state.camera.fov * (Math.PI / 180);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * state.camera.aspect);
  // Fit the bounding sphere in the tighter of the two fields of view
  let distance = radius / Math.sin(Math.min(vfov, hfov) / 2);
  distance *= preset === "home" || !preset ? 0.72 : 0.8;

  let pos = new THREE.Vector3();

  switch (preset) {
    case "top":
      pos.set(0, distance * 1.5, 0.1);
      break;
    case "front":
      pos.set(distance * 1.2, 2, 0);
      break;
    case "side":
      pos.set(0, 2, distance * 1.2);
      break;
    case "home":
    default:
      pos.set(distance * 0.9, distance * 0.6, distance * 0.9);
      break;
  }

  state.camera.position.copy(pos);
  state.controls.target.copy(target);
  state.controls.update();
};

export function animate() {
  requestAnimationFrame(animate);
  if (state.controls && state.renderer && state.scene && state.camera) {
    state.controls.update();
    state.renderer.render(state.scene, state.camera);
  }
}

// ── Toggle interaction modes (Pan vs Orbit) ──
window.setViewerMode = function (mode) {
  if (window.switchRightTab && state.activeSidebarTab === "lcca") {
    window.switchRightTab("groups");
  }
  if (!state.controls) return;
  
  const rotateBtn = document.getElementById("btn-mode-rotate");
  const panBtn = document.getElementById("btn-mode-pan");
  
  if (mode === "pan") {
    // Enable single-finger panning on mobile, left-click panning on desktop
    state.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    state.controls.touches.ONE = THREE.TOUCH.PAN;
    
    if (rotateBtn) rotateBtn.classList.remove("active");
    if (panBtn) panBtn.classList.add("active");
  } else {
    // Enable single-finger orbiting on mobile, left-click orbiting on desktop (default)
    state.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    state.controls.touches.ONE = THREE.TOUCH.ROTATE;
    
    if (rotateBtn) rotateBtn.classList.add("active");
    if (panBtn) panBtn.classList.remove("active");
  }
};

// ── Focus Zoom controls (+ and -) ──
window.zoomViewer = function (direction) {
  if (window.switchRightTab && state.activeSidebarTab === "lcca") {
    window.switchRightTab("groups");
  }
  if (!state.camera || !state.controls) return;
  
  const factor = direction > 0 ? 0.82 : 1.22;
  const camPos = state.camera.position;
  const target = state.controls.target;
  
  const offset = new THREE.Vector3().subVectors(camPos, target);
  offset.multiplyScalar(factor);
  
  state.camera.position.copy(target).add(offset);
  state.controls.update();
};
