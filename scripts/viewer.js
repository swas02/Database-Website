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

  const backLight = new THREE.DirectionalLight(0x8bc34a, 0.4);
  backLight.position.set(-100, 80, -100);
  state.scene.add(backLight);

  // Fog Setup
  state.scene.fog = null;

  // Resize handler
  window.addEventListener("resize", () => {
    state.camera.aspect = W() / H();
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(W(), H());
  });
}

// ── Camera Preset ─────────────────────────────────────────────
window.setCameraPreset = function (preset) {
  if (!state.modelCenter) return;
  const target = new THREE.Vector3(0, 2, 0); // world center
  let pos = new THREE.Vector3();

  switch (preset) {
    case "top":
      pos.set(0, 140, 0.1);
      break;
    case "front":
      pos.set(130, 2, 0);
      break;
    case "side":
      pos.set(0, 2, 130);
      break;
    case "home":
    default:
      pos.set(100, 60, 100);
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
