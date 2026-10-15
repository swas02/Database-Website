import { initViewer, animate } from "./viewer.js";
import { initInteraction } from "./interaction.js";
import { initDatabase } from "./db.js";

// ── Auto-load Defaults on Boot ───────────────────────────────
(async function init() {
  // Initialize the viewer (Three.js scene, camera, controls)
  initViewer();

  // Initialize mouse & keyboard event listeners
  initInteraction();

  // Load database metadata and initial bridge
  await initDatabase();
})();

// Start rendering
animate();
