import * as THREE from "three";
import { OrbitControls } from "https://unpkg.com/three@0.170.0/examples/jsm/controls/OrbitControls.js";
import { state } from "./state.js";

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
  state.renderer.setSize(W(), H());
  state.renderer.shadowMap.enabled = false;
  state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  state.viewportContainer.appendChild(state.renderer.domElement);

  state.controls = new OrbitControls(state.camera, state.renderer.domElement);
  state.controls.enableDamping = true;
  state.controls.dampingFactor = 0.05;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
  state.scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
  dirLight.position.set(100, 200, 100);
  dirLight.castShadow = false;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.bias = -0.001;
  state.scene.add(dirLight);

  const backLight = new THREE.DirectionalLight(0x94a3b8, 0.4); // Cool slate backlight
  backLight.position.set(-100, 80, -100);
  state.scene.add(backLight);

  // Fog Setup
  state.scene.fog = null;

  // Resize handler using ResizeObserver
  const resizeObserver = new ResizeObserver(() => {
    const width = W();
    const height = H();
    if (width && height) {
      state.camera.aspect = width / height;
      state.camera.updateProjectionMatrix();
      state.renderer.setSize(width, height);
    }
  });
  resizeObserver.observe(state.viewportContainer);
}

// ── Camera Preset ─────────────────────────────────────────────
window.setCameraPreset = function (preset) {
  if (!state.modelCenter || !state.modelBox) return;
  const target = new THREE.Vector3(0, 2, 0); // world center
  
  // Calculate dynamic fit distance
  const size = state.modelBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = state.camera.fov * (Math.PI / 180);
  let distance = Math.abs(maxDim / 2 / Math.tan(fov / 2));
  
  // Enforce sensible bounds and padding
  distance = Math.max(distance, 40);
  distance *= 1.25; 

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
  if (!state.camera || !state.controls) return;
  
  const factor = direction > 0 ? 0.82 : 1.22;
  const camPos = state.camera.position;
  const target = state.controls.target;
  
  const offset = new THREE.Vector3().subVectors(camPos, target);
  offset.multiplyScalar(factor);
  
  state.camera.position.copy(target).add(offset);
  state.controls.update();
};
