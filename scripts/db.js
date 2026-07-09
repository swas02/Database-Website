import { state } from "./state.js";
import { setLoadingState, renderBridgeMetadata, renderCatalog, updateCardActiveStates, loadAndRenderLCCA } from "./ui.js";
import { loadOBJ } from "./ifcLoader.js";

// Global lists populated from registry_flat.json
let registry = [];
let steelDatabase = [];

export async function initDatabase() {
  try {
    setLoadingState("Loading Bridge Database...");
    const [registryResp, dbResp] = await Promise.all([
      fetch("registry_flat.json"),
      fetch("data/steel_data.json"),
    ]);

    if (registryResp.ok) registry = await registryResp.json();
    if (dbResp.ok) steelDatabase = await dbResp.json();

    // Populate the dropdown filters dynamically
    populateFilters();

    // Set defaults matching the initial bridge
    setFilterDefaults();

    // Auto-load default selection
    await loadSelectedBridge();
    
    // Initial catalog render
    updateCatalog();
  } catch (err) {
    console.error("Failed to load database:", err);
    setLoadingState("Failed to load databases.");
  }
}

function getUniqueValues(key) {
  const values = new Set();
  registry.forEach((item) => {
    if (item[key]) values.add(item[key]);
  });
  return Array.from(values).sort();
}

function populateFilters() {
  const filters = {
    location: document.getElementById("filter-location"),
    type: document.getElementById("filter-type"),
    structure: document.getElementById("filter-structure"),
    span: document.getElementById("filter-span"),
    lanes: document.getElementById("filter-lanes"),
    footpath: document.getElementById("filter-footpath"),
  };

  Object.keys(filters).forEach((key) => {
    const select = filters[key];
    if (!select) return;
    select.innerHTML = "";

    const values = getUniqueValues(key === "type" ? "bridge_type" : key);
    values.forEach((val) => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = formatOptionText(key, val);
      select.appendChild(opt);
    });
  });
}

function formatOptionText(key, value) {
  if (key === "footpath") {
    return value === "OF" ? "With Footpath (OF)" : "No Footpath (NF)";
  }
  if (key === "lanes") {
    return value === "2L" ? "2 Lanes (2L)" : "3 Lanes (3L)";
  }
  if (key === "span") {
    return `${value} meters`;
  }
  return value;
}

function setFilterDefaults() {
  const defaults = {
    location: "Mumbai",
    type: "Steel",
    structure: "Superstructure",
    span: "20",
    lanes: "2L",
    footpath: "OF",
  };

  Object.keys(defaults).forEach((key) => {
    const select = document.getElementById(`filter-${key}`);
    if (select) select.value = defaults[key];
  });
  
  // Update disabled states/combinations
  updateFilterCombinations();
}

window.onFilterChange = function () {
  updateFilterCombinations();
  updateCatalog();
};

export function updateCatalog() {
  const locSelect = document.getElementById("filter-location");
  const typeSelect = document.getElementById("filter-type");
  const structSelect = document.getElementById("filter-structure");
  
  if (!locSelect || !typeSelect || !structSelect) return;
  
  const loc = locSelect.value;
  const type = typeSelect.value;
  const struct = structSelect.value;
  
  const matches = registry.filter(item => 
    item.location === loc &&
    item.bridge_type === type &&
    item.structure === struct
  );
  
  renderCatalog(matches, state.currentLoadedBridgePath);
}

window.loadBridgeByCard = async function (match) {
  if (!match) return;
  
  // Set all filter values first to prevent intermediate auto-selection overrides
  document.getElementById("filter-location").value = match.location;
  document.getElementById("filter-type").value = match.bridge_type;
  document.getElementById("filter-structure").value = match.structure;
  document.getElementById("filter-span").value = match.span;
  document.getElementById("filter-lanes").value = match.lanes;
  document.getElementById("filter-footpath").value = match.footpath;
  
  // Update combinations and disabled options once at the end
  updateFilterCombinations();
  
  // Call loading function
  await loadSelectedBridge();

  // On mobile (<= 768px), collapse Left Panel so they see the loaded model in 3D
  if (window.innerWidth <= 768) {
    if (window.toggleLeftPanel) {
      window.toggleLeftPanel();
    }
  }
};

// Cascaded filter system: restricts subsequent dropdown choices dynamically
function updateFilterCombinations() {
  const locationSelect = document.getElementById("filter-location");
  const typeSelect = document.getElementById("filter-type");
  const structureSelect = document.getElementById("filter-structure");
  const spanSelect = document.getElementById("filter-span");
  const lanesSelect = document.getElementById("filter-lanes");
  const footpathSelect = document.getElementById("filter-footpath");

  if (!locationSelect || !typeSelect || !structureSelect || !spanSelect || !lanesSelect || !footpathSelect) return;

  // 1. Filter by Location
  const loc = locationSelect.value;
  const locItems = registry.filter(item => item.location === loc);
  const validTypes = new Set(locItems.map(item => item.bridge_type));
  updateSelectOptions("filter-type", validTypes);

  // 2. Filter by Location + Type
  const type = typeSelect.value;
  const typeItems = locItems.filter(item => item.bridge_type === type);
  const validStructures = new Set(typeItems.map(item => item.structure));
  updateSelectOptions("filter-structure", validStructures);

  // 3. Filter by Location + Type + Structure
  const struct = structureSelect.value;
  const structItems = typeItems.filter(item => item.structure === struct);
  const validSpans = new Set(structItems.map(item => item.span));
  updateSelectOptions("filter-span", validSpans);

  // 4. Filter by Location + Type + Structure + Span
  const span = spanSelect.value;
  const spanItems = structItems.filter(item => item.span === span);
  const validLanes = new Set(spanItems.map(item => item.lanes));
  updateSelectOptions("filter-lanes", validLanes);

  // 5. Filter by Location + Type + Structure + Span + Lanes
  const lanes = lanesSelect.value;
  const lanesItems = spanItems.filter(item => item.lanes === lanes);
  const validFootpaths = new Set(lanesItems.map(item => item.footpath));
  updateSelectOptions("filter-footpath", validFootpaths);
}

function updateSelectOptions(selectId, validValues) {
  const select = document.getElementById(selectId);
  if (!select) return;

  let currentVal = select.value;
  let hasValidSelection = false;

  Array.from(select.options).forEach((opt) => {
    const isValid = validValues.has(opt.value);
    opt.disabled = !isValid;
    opt.style.display = isValid ? "block" : "none";
    if (isValid && opt.value === currentVal) {
      hasValidSelection = true;
    }
  });

  // If the previously selected option is now disabled, auto-select the first valid option
  if (!hasValidSelection) {
    const firstValid = Array.from(select.options).find((opt) => !opt.disabled);
    if (firstValid) {
      select.value = firstValid.value;
    }
  }
}

window.loadSelectedBridge = async function () {
  const filters = {
    location: document.getElementById("filter-location").value,
    bridge_type: document.getElementById("filter-type").value,
    structure: document.getElementById("filter-structure").value,
    span: document.getElementById("filter-span").value,
    lanes: document.getElementById("filter-lanes").value,
    footpath: document.getElementById("filter-footpath").value,
  };

  // Find matching row in registry
  const match = registry.find(
    (item) =>
      item.location === filters.location &&
      item.bridge_type === filters.bridge_type &&
      item.structure === filters.structure &&
      item.span === filters.span &&
      item.lanes === filters.lanes &&
      item.footpath === filters.footpath
  );

  if (!match) {
    console.warn("Selected Input Configuration (No Match Found):", filters);
    alert("No matching bridge model found for the selected configuration.");
    return;
  }

  console.log("Selected Input Configuration:", filters);
  console.log("Bridge Model File Location:", match.ifc);
  console.log("Bridge Model Groups JSON Location:", match.json);

  setLoadingState("Loading bridge model...");
  try {
    // 1. Fetch JSON (the structural groups)
    const jsonResp = await fetch(match.json);
    if (!jsonResp.ok) throw new Error("Failed to load model groups data");
    const groupsData = await jsonResp.json();

    // Keep it on state so it is processed dynamically in ifcLoader.js
    state.modelGroupsData = groupsData;

    // 2. Resolve OBJ model path
    const objPath = match.obj || match.ifc.replace(/\.ifc$/i, ".obj");

    // 3. Find matching spec in steelDatabase
    const pathParts = match.ifc.split("/");
    const lastPart = pathParts.pop();
    const bridgeIdFromPath = lastPart.toLowerCase() === "model.ifc" ? pathParts.pop() : lastPart.replace(".ifc", "");
    // Replace trailing _P with _S to lookup superstructure details (which holds pier cap, pier size etc.)
    const searchId = bridgeIdFromPath.replace(/_P$/, "_S");

    const spec = match.bridge_type !== "PSC" ? steelDatabase.find((item) => item.bridge_id === searchId) : null;
    if (spec) {
      // Create local deep copy
      state.bridgeData = JSON.parse(JSON.stringify(spec));

      // Override values to match this specific model
      state.bridgeData.bridge_id = bridgeIdFromPath;
      state.bridgeData.location = match.location;
      state.bridgeData.span_m = parseFloat(match.span);
      state.bridgeData.lanes = match.lanes === "2L" ? 2 : 3;
      state.bridgeData.has_footpath = match.footpath === "OF";
      if (match.bridge_type === "PSC") {
        state.bridgeData.bridge_type = "Prestressed Concrete (PSC)";
        // Clear steel sections to avoid showing girder segmentations or cross bracing
        if (state.bridgeData.girder_sections) state.bridgeData.girder_sections = null;
        if (state.bridgeData.cross_bracing) state.bridgeData.cross_bracing = null;
        if (state.bridgeData.transverse_stiffeners_per_girder_side) state.bridgeData.transverse_stiffeners_per_girder_side = null;
        if (state.bridgeData.bearing_stiffeners_per_girder_side) state.bridgeData.bearing_stiffeners_per_girder_side = null;
        if (state.bridgeData.material_grades) {
          state.bridgeData.material_grades.structural_steel = null;
        }
      } else {
        state.bridgeData.bridge_type = "Steel-girder RC deck";
      }
    } else {
      // Fallback bridgeData if not found in database (e.g. PSC superstructure or custom structures)
      state.bridgeData = {
        bridge_id: bridgeIdFromPath,
        bridge_type: match.bridge_type === "PSC" ? "Prestressed Concrete (PSC)" : "Steel-girder RC deck",
        location: match.location,
        span_m: parseFloat(match.span),
        lanes: match.lanes === "2L" ? 2 : 3,
        has_footpath: match.footpath === "OF",
        total_width_m: match.lanes === "2L" ? 8.5 : 10.5,
        material_grades: {
          rebar: "Fe500",
          structural_steel: match.bridge_type === "PSC" ? null : "E350",
          concrete_substructure_and_deck_slab: "M35",
        },
      };
    }

    // Save current loaded bridge path and update cards
    state.currentLoadedBridgePath = match.ifc;
    state.currentLoadedBridge = match;
    updateCardActiveStates(match.ifc);

    // Refresh general specifications UI
    renderBridgeMetadata(state.bridgeData);

    // Load and render LCCA tables
    await loadAndRenderLCCA();

    // Call loadOBJ to load and render the OBJ model
    await loadOBJ(objPath);

    // Reset filters
    if (window.resetAllFilters) {
      window.resetAllFilters();
    }

    // Auto-fit camera to the newly loaded bridge
    if (window.setCameraPreset) {
      window.setCameraPreset('home');
    }

  } catch (err) {
    console.error("Load failed:", err);
    alert("Error loading model: " + err.message);
    setLoadingState(null);
  }
};
