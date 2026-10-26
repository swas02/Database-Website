import { state } from "./state.js";
import { setLoadingState, renderBridgeMetadata, loadAndRenderLCCA } from "./ui.js";
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

    if (key === "structure") {
      const both = document.createElement("option");
      both.value = BOTH;
      both.textContent = formatOptionText("structure", BOTH);
      select.appendChild(both);
    }
  });
}

// Structure filter value that loads the superstructure and substructure together
const BOTH = "Both";

// The substructure registry row that belongs to a superstructure row (same bridge configuration)
function findSubstructureFor(sup) {
  return registry.find(
    (item) =>
      item.structure === "Substructure" &&
      item.bridge_type === sup.bridge_type &&
      item.location === sup.location &&
      item.span === sup.span &&
      item.lanes === sup.lanes &&
      item.footpath === sup.footpath
  );
}

function formatOptionText(key, value) {
  if (key === "structure" && value === BOTH) return "Super + substructure";
  if (key === "footpath") {
    return value === "OF" ? "With footpath" : "No footpath";
  }
  if (key === "lanes") {
    return value === "2L" ? "2 Lanes (2L)" : "3 Lanes (3L)";
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

  applyUrlParams();
}

// URL parameters mirror the six dropdowns: ?location=Mumbai&type=Steel&structure=Superstructure&span=20&lanes=2L&footpath=OF
const URL_KEYS = ["location", "type", "structure", "span", "lanes", "footpath"];

// Match a raw URL value to an option value, ignoring case, spacing and a trailing "m" on spans
function resolveOption(key, raw, select) {
  const clean = (s) => String(s).trim().toLowerCase().replace(/[\s_-]+/g, "");
  let want = clean(raw);
  if (key === "span") want = want.replace(/m(eters?)?$/, "");
  if (key === "structure" && (want === "super+sub" || want === "superandsub")) want = clean(BOTH);
  return Array.from(select.options).find((o) => !o.disabled && clean(o.value) === want);
}

function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const ignored = [];

  // Apply in cascade order so each choice narrows the next dropdown
  URL_KEYS.forEach((key) => {
    if (!params.has(key)) return;
    const select = document.getElementById(`filter-${key}`);
    if (!select) return;
    const opt = resolveOption(key, params.get(key), select);
    if (opt) {
      select.value = opt.value;
      updateFilterCombinations();
    } else {
      ignored.push(`${key}=${params.get(key)}`);
    }
  });

  if (ignored.length && window.showToast) {
    window.showToast(`Not available in the library: ${ignored.join(", ")}. Showing the closest match.`);
  }
}

// Keep the address bar in step with the loaded model so the link can be shared
function syncUrlParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    URL_KEYS.forEach((key) => {
      const select = document.getElementById(`filter-${key}`);
      if (select) params.set(key, select.value);
    });
    history.replaceState(null, "", `${window.location.pathname}?${params}${window.location.hash}`);
  } catch (e) {
    /* history may be unavailable (sandboxed frame); the link is a convenience */
  }
}

// A filter change only narrows the remaining options; the Load Model button loads.
window.onFilterChange = function () {
  updateFilterCombinations();
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
  const pairedSupers = typeItems.filter(item => item.structure === "Superstructure" && findSubstructureFor(item));
  if (pairedSupers.length) validStructures.add(BOTH);
  updateSelectOptions("filter-structure", validStructures);

  // 3. Filter by Location + Type + Structure ("Both" only offers configurations that have both models)
  const struct = structureSelect.value;
  const structItems = struct === BOTH ? pairedSupers : typeItems.filter(item => item.structure === struct);
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

window.loadSelectedBridge = async function (fromUser = false) {
  const filters = {
    location: document.getElementById("filter-location").value,
    bridge_type: document.getElementById("filter-type").value,
    structure: document.getElementById("filter-structure").value,
    span: document.getElementById("filter-span").value,
    lanes: document.getElementById("filter-lanes").value,
    footpath: document.getElementById("filter-footpath").value,
  };

  // Find matching row in registry ("Both" is the superstructure row plus its paired substructure)
  const wantBoth = filters.structure === BOTH;
  const match = registry.find(
    (item) =>
      item.location === filters.location &&
      item.bridge_type === filters.bridge_type &&
      item.structure === (wantBoth ? "Superstructure" : filters.structure) &&
      item.span === filters.span &&
      item.lanes === filters.lanes &&
      item.footpath === filters.footpath
  );

  if (!match) {
    console.warn("Selected Input Configuration (No Match Found):", filters);
    window.showToast("No model exists for this combination. Try a different span, lanes or footpath option.");
    return;
  }

  const subMatch = wantBoth ? findSubstructureFor(match) : null;
  if (wantBoth && !subMatch) {
    window.showToast("No substructure model exists for this combination.");
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
    const partOf = (row) => (row.structure === "Substructure" ? "sub" : "super");
    groupsData.groups = (groupsData.groups || []).map((g) => ({ ...g, part: partOf(match) }));

    if (subMatch) {
      const subResp = await fetch(subMatch.json);
      if (!subResp.ok) throw new Error("Failed to load substructure groups data");
      const subData = await subResp.json();
      // Part IDs come from separate IFC files and can collide, so the substructure ones are namespaced
      const subGroups = (subData.groups || []).map((g) => ({
        ...g,
        part: "sub",
        partIDs: (g.partIDs || []).map((id) => "sub:" + id),
      }));
      groupsData.groups = groupsData.groups.concat(subGroups);
    }

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

    syncUrlParams();

    // Remember the current bridge
    state.currentLoadedBridgePath = match.ifc;
    state.currentLoadedBridge = match;
    state.loadedStructure = wantBoth ? BOTH : match.structure;

    // Refresh general specifications UI
    renderBridgeMetadata(state.bridgeData);

    // Load and render LCCA tables
    await loadAndRenderLCCA();

    // Call loadOBJ to load and render the OBJ model
    await loadOBJ(objPath, subMatch ? { subObjPath: subMatch.obj, span: parseFloat(match.span) } : {});

    // Reset filters
    if (window.resetAllFilters) {
      window.resetAllFilters();
    }

    // Library was used to pick this model: fold it away so the explorer gets the room
    if (fromUser && window.setSidebarSection) window.setSidebarSection("left", false);

    // Auto-fit camera to the newly loaded bridge
    if (window.setCameraPreset) {
      window.setCameraPreset('home');
    }

  } catch (err) {
    console.error("Load failed:", err);
    window.showToast("Could not load the model: " + err.message);
    setLoadingState(null);
  }
};
