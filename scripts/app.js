import { state } from "./state.js";
import { initViewer, animate } from "./viewer.js";
import { initInteraction } from "./interaction.js";
import { setLoadingState, renderBridgeMetadata } from "./ui.js";
import { loadIFC } from "./ifcLoader.js";

// ── Auto-load Defaults on Boot ───────────────────────────────
(async function init() {
  // Initialize the viewer (Three.js scene, camera, controls)
  initViewer();

  // Initialize mouse & keyboard event listeners
  initInteraction();

  try {
    setLoadingState("Fetching initial model...");
    const [ifcResp, jsonResp, dataResp] = await Promise.all([
      fetch("M_20_2L_NF_S.ifc"),
      fetch("M_20_2L_NF_S.json"),
      fetch("M_20_2L_NF_S.data.json"),
    ]);
    if (dataResp.ok) {
      state.bridgeData = await dataResp.json();
      renderBridgeMetadata(state.bridgeData);
    }
    if (ifcResp.ok) {
      await loadIFC(await ifcResp.arrayBuffer());
    }
  } catch (e) {
    console.warn("Auto-load failed:", e);
    setLoadingState("Ready. Please select or drag/drop an IFC file to begin.");
    setTimeout(() => setLoadingState(null), 3000);
  }
})();

// Start rendering
animate();
