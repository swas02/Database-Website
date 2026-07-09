import * as THREE from "three";
import { state } from "./state.js";
import { COLOR, getMaterialColor } from "./constants.js";

// Tab Navigation Explorer
window.switchRightTab = function (tab) {
  state.activeSidebarTab = tab;
  document
    .getElementById("tab-groups")
    .classList.toggle("active", tab === "groups");
  document
    .getElementById("tab-meta")
    .classList.toggle("active", tab === "meta");
  document
    .getElementById("tab-lcca")
    .classList.toggle("active", tab === "lcca");
  document
    .getElementById("tab-downloads")
    .classList.toggle("active", tab === "downloads");
    
  document.getElementById("content-groups").style.display =
    tab === "groups" ? "block" : "none";
  document.getElementById("content-meta").style.display =
    tab === "meta" ? "block" : "none";
  document.getElementById("content-lcca").style.display =
    tab === "lcca" ? "block" : "none";
  document.getElementById("content-downloads").style.display =
    tab === "downloads" ? "block" : "none";

  // Toggle central LCCA dashboard vs 3D viewer
  if (window.toggleLCCAMode) {
    window.toggleLCCAMode(tab === "lcca");
  }

  // Toggle HUD button active state
  const lccaBtn = document.getElementById("btn-mode-lcca");
  if (lccaBtn) {
    lccaBtn.classList.toggle("active", tab === "lcca");
  }
};

window.toggleRightPanel = function () {
  const p = document.getElementById("right-panel");
  const t = document.getElementById("right-trigger");
  if (!p) return;
  const col = p.classList.toggle("collapsed");
  if (t) t.style.display = col ? "block" : "none";
  
  if (col) {
    // If we collapse the panel while LCCA is active, exit LCCA mode and reset tab
    if (p.classList.contains("lcca-active")) {
      window.toggleLCCAMode(false);
      window.switchRightTab('groups');
    }
  } else {
    // On tablet/mobile (<= 1024px), if we open the right panel, collapse the left panel
    if (window.innerWidth <= 1024) {
      const lp = document.getElementById("left-panel");
      const lt = document.getElementById("left-trigger");
      if (lp && !lp.classList.contains("collapsed")) {
        lp.classList.add("collapsed");
        if (lt) lt.style.display = "block";
      }
    }
  }
};

window.toggleLeftPanel = function () {
  const p = document.getElementById("left-panel");
  const t = document.getElementById("left-trigger");
  if (!p) return;
  const col = p.classList.toggle("collapsed");
  if (t) t.style.display = col ? "block" : "none";
  
  // On tablet/mobile (<= 1024px), if we open the left panel, collapse the right panel
  if (!col && window.innerWidth <= 1024) {
    const rp = document.getElementById("right-panel");
    const rt = document.getElementById("right-trigger");
    if (rp && !rp.classList.contains("collapsed")) {
      rp.classList.add("collapsed");
      if (rt) rt.style.display = "block";
    }
  }
};

// Dynamic Panel Expansion on Boot based on screen size
(function initPanels() {
  const lp = document.getElementById("left-panel");
  const lt = document.getElementById("left-trigger");
  const rp = document.getElementById("right-panel");
  const rt = document.getElementById("right-trigger");

  if (window.innerWidth > 1024) {
    // Desktop: both panels open, triggers hidden
    if (lp) lp.classList.remove("collapsed");
    if (lt) lt.style.display = "none";
    if (rp) rp.classList.remove("collapsed");
    if (rt) rt.style.display = "none";
  } else {
    // Tablet/Mobile: Left Panel (Library) open, Right Panel (Explorer) collapsed
    if (lp) lp.classList.remove("collapsed");
    if (lt) lt.style.display = "none";
    if (rp) rp.classList.add("collapsed");
    if (rt) rt.style.display = "block";
  }
})();

// Loading Indicator
export function setLoadingState(text) {
  let overlay = document.getElementById("loading-overlay");
  if (text) {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "loading-overlay";
      overlay.style.position = "absolute";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.background = "rgba(15, 23, 42, 0.9)";
      overlay.style.display = "flex";
      overlay.style.flexDirection = "column";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.zIndex = "999";
      overlay.innerHTML = `
        <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem; color: #3b82f6 !important;"></div>
        <div id="loading-text" class="text-white" style="font-family:'Outfit'; font-size: 14px; font-weight:500;"></div>
      `;
      state.viewportContainer.appendChild(overlay);
    }
    document.getElementById("loading-text").innerText = text;
  } else if (overlay) {
    overlay.remove();
  }
}

// Render general metadata specifications
export function renderBridgeMetadata(data) {
  const container = document.getElementById("meta-container");
  container.innerHTML = "";

  const items = [
    { k: "Project ID", v: data.bridge_id },
    { k: "Type", v: data.bridge_type },
    { k: "Location", v: data.location || "N/A" },
    { k: "Width", v: data.total_width_m + " m" },
    { k: "Lanes", v: data.lanes },
    { k: "Rebar Spec", v: data.material_grades?.rebar || "N/A" },
    { k: "Steel Spec", v: data.material_grades?.structural_steel || "N/A" },
    {
      k: "Concrete Substructure",
      v: data.material_grades?.concrete_substructure_and_deck_slab || "N/A",
    },
    { k: "Pile Count", v: data.substructure?.pile?.count || "N/A" },
    {
      k: "Pile Cap Dimensions",
      v: data.substructure?.pile_cap?.dimensions_m?.raw || "N/A",
    },
    { k: "Pier Diameter", v: data.substructure?.pier?.diameter_m ? data.substructure.pier.diameter_m + " m" : "N/A" },
  ];

  items.forEach((i) => {
    container.innerHTML += `
      <div class="metric-card">
        <span class="metric-header">${i.k}</span>
        <span class="metric-value">${i.v}</span>
      </div>
    `;
  });

  // Dynamically render downloads list
  renderDownloads(data.bridge_id, state.currentLoadedBridgePath);
}

export function getCleanGroupName(name) {
  const nameLower = name.toLowerCase();
  if (name === "deck_slab" || nameLower === "slab" || nameLower === "deck") {
    return "Deck Slab";
  }
  if (name === "cross_bracing" || nameLower === "bracing" || nameLower.includes("brace")) {
    return "Cross Bracing";
  }
  if (name === "girder_sections" || nameLower === "girder") {
    return "Girder Sections";
  }
  if (nameLower === "chord" || nameLower === "cord") {
    return "Chord";
  }
  if (nameLower.includes("bearing") || nameLower.includes("end stiffener") || nameLower.includes("end stifferen")) {
    return "Bearing Stiffeners";
  }
  if (nameLower.includes("transverse") || nameLower.includes("intermediate stiffener") || nameLower.includes("stiffener") || nameLower.includes("stifferen")) {
    return "Transverse Stiffeners";
  }
  if (nameLower === "pier" || name === "Pier Shaft") {
    return "Pier Shaft";
  }
  if (nameLower === "pier_cap" || nameLower.includes("pier cap")) {
    return "Pier Cap";
  }
  if (nameLower === "pile_cap" || nameLower === "pile cap") {
    return "Pile Cap";
  }
  if (nameLower === "pile" || nameLower === "piles") {
    return "Piles";
  }
  return name.replace(/_/g, " ");
}

export function renderGroupsPanel(list) {
  const container = document.getElementById("groups-container");
  container.innerHTML = "";

  list.forEach((g) => {
    if (g.name.startsWith("_")) return;

    let colorHex = "#607d8b";
    
    // Attempt to get color from actual Three.js meshes inside the group
    const firstPartID = Array.from(state.groupIndex.get(g.name) || [])[0];
    if (firstPartID) {
      const meshes = state.meshMap.get(firstPartID);
      if (meshes && meshes[0]) {
        colorHex = "#" + meshes[0].material.color.getHexString();
      }
    } else if (g.meta?.color && g.meta.color !== "") {
      colorHex = g.meta.color;
    } else {
      colorHex = getMaterialColor(g.name);
    }

    const count = state.groupIndex.get(g.name)?.size || 0;

    const div = document.createElement("div");
    div.className = "group-item";
    div.setAttribute("data-group", g.name);
    div.setAttribute("onclick", `selectGroup('${g.name}')`);
    div.innerHTML = `
      <div class="group-header">
        <div class="group-info">
          <span class="group-dot" style="color: ${colorHex}; background-color: ${colorHex}"></span>
          <span class="group-name">${getCleanGroupName(g.name)}</span>
          <span class="group-count">${count}</span>
        </div>
        <div class="group-controls" onclick="event.stopPropagation()">
          <div class="color-picker-wrapper" style="background-color: ${colorHex}">
            <input type="color" class="color-picker-input" value="${colorHex}" onchange="changeGroupColor('${g.name}', this.value)">
          </div>
          <button class="vis-toggle" onclick="toggleGroupVisibility('${g.name}', this); event.stopPropagation();"><i class="bi bi-eye-fill"></i></button>
        </div>
      </div>
      <div class="group-details-accordion" style="display:none" onclick="event.stopPropagation()"></div>
    `;
    container.innerHTML += div.outerHTML;
  });
}

function hexToRgb(hex) {
  const match = hex.replace("#", "").match(/.{1,2}/g);
  if (!match) return "168, 197, 32";
  return match.map((x) => parseInt(x, 16)).join(", ");
}

export function generateGirderSVG(props, color) {
  const maxW = 0.55;
  const maxH = 1.01;

  const tf_w = Math.max(10, (props.top_flange_width_m / maxW) * 50);
  const bf_w = Math.max(10, (props.bottom_flange_width_m / maxW) * 50);
  const web_h = Math.max(20, (props.web_depth_m / maxH) * 50);

  const tf_t = Math.max(2, (props.top_flange_thickness_m / 0.028) * 6);
  const bf_t = Math.max(2, (props.bottom_flange_thickness_m / 0.028) * 6);
  const web_t = Math.max(2, (props.web_thickness_m / 0.012) * 5);

  const svgW = 60;
  const svgH = 80;

  const tf_x = (svgW - tf_w) / 2;
  const bf_x = (svgW - bf_w) / 2;
  const web_x = (svgW - web_t) / 2;

  const tf_y = 10;
  const web_y = tf_y + tf_t;
  const bf_y = web_y + web_h;

  return `
    <svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" style="stroke: ${color}; stroke-width: 1.2; fill: rgba(${hexToRgb(color)}, 0.15); filter: drop-shadow(0 0 4px rgba(${hexToRgb(color)}, 0.35)); flex-shrink: 0;">
      <rect x="${tf_x}" y="${tf_y}" width="${tf_w}" height="${tf_t}" rx="0.5" />
      <rect x="${web_x}" y="${web_y}" width="${web_t}" height="${web_h}" rx="0.5" />
      <rect x="${bf_x}" y="${bf_y}" width="${bf_w}" height="${bf_t}" rx="0.5" />
    </svg>
  `;
}

export function generatePierCapSVG(pc, color) {
  const midLen = parseFloat(pc.mid_section_length_m) || 2.0;
  const taperLen = parseFloat(pc.taper_section_length_m) || 3.63;
  const totalLen = midLen + 2 * taperLen;
  const midDepth = parseFloat(pc.mid_depth_m) || 1.45;
  const endDepth = parseFloat(pc.end_depth_m) || 0.725;

  const svgW = 260;
  const svgH = 130;
  
  const padX = 45;
  const padY = 20;
  const drawW = svgW - 2 * padX;
  const drawH = svgH - 2 * padY - 15; // Save some space for bottom dimensions

  const scaleX = drawW / totalLen;
  const scaleY = drawH / Math.max(midDepth, endDepth, 1.0);

  const topY = padY;
  const endDepthY = topY + endDepth * scaleY;
  const midDepthY = topY + midDepth * scaleY;
  
  const x0 = padX;
  const x1 = padX + taperLen * scaleX;
  const x2 = padX + (taperLen + midLen) * scaleX;
  const x3 = padX + totalLen * scaleX;

  const points = `${x0},${topY} ${x3},${topY} ${x3},${endDepthY} ${x2},${midDepthY} ${x1},${midDepthY} ${x0},${endDepthY}`;

  return `
    <svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" style="stroke: ${color}; stroke-width: 1.2; fill: rgba(${hexToRgb(color)}, 0.15); filter: drop-shadow(0 0 4px rgba(${hexToRgb(color)}, 0.35)); flex-shrink: 0; display: block; margin: 0 auto 12px auto;">
      <polygon points="${points}" />
      <line x1="${(x1+x2)/2}" y1="${topY}" x2="${(x1+x2)/2}" y2="${midDepthY + 8}" style="stroke: ${color}; stroke-dasharray: 2 2; opacity: 0.5;" />
      
      <!-- Top Dimension Line (L1 - Total Length) -->
      <line x1="${x0}" y1="${topY - 8}" x2="${x3}" y2="${topY - 8}" style="stroke: #94a3b8; stroke-width: 0.8;" />
      <line x1="${x0}" y1="${topY - 11}" x2="${x0}" y2="${topY - 5}" style="stroke: #94a3b8; stroke-width: 0.8;" />
      <line x1="${x3}" y1="${topY - 11}" x2="${x3}" y2="${topY - 5}" style="stroke: #94a3b8; stroke-width: 0.8;" />
      <text x="${(x0+x3)/2}" y="${topY - 12}" text-anchor="middle" fill="#94a3b8" style="font-size: 7px; stroke: none; font-family: monospace; font-weight: 600;">L1 = ${totalLen.toFixed(2)}m</text>
      
      <!-- Mid Depth Label (d1) -->
      <line x1="${(x1+x2)/2}" y1="${topY}" x2="${(x1+x2)/2}" y2="${midDepthY}" style="stroke: #94a3b8; stroke-width: 0.8; stroke-dasharray: 1 1;" />
      <text x="${(x1+x2)/2 + 4}" y="${(topY + midDepthY)/2 + 2}" text-anchor="start" fill="#94a3b8" style="font-size: 7px; stroke: none; font-family: monospace;">d1=${midDepth.toFixed(3)}m</text>
      
      <!-- End Depth Label (d2) -->
      <line x1="${x0}" y1="${topY}" x2="${x0}" y2="${endDepthY}" style="stroke: #94a3b8; stroke-width: 0.8; stroke-dasharray: 1 1;" />
      <text x="${x0 - 4}" y="${(topY + endDepthY)/2 + 2}" text-anchor="end" fill="#94a3b8" style="font-size: 7px; stroke: none; font-family: monospace;">d2=${endDepth.toFixed(3)}m</text>

      <!-- Bottom Dimension Line (L2 - Mid Section Length) -->
      <line x1="${x1}" y1="${midDepthY + 8}" x2="${x2}" y2="${midDepthY + 8}" style="stroke: #94a3b8; stroke-width: 0.8;" />
      <line x1="${x1}" y1="${midDepthY + 5}" x2="${x1}" y2="${midDepthY + 11}" style="stroke: #94a3b8; stroke-width: 0.8;" />
      <line x1="${x2}" y1="${midDepthY + 5}" x2="${x2}" y2="${midDepthY + 11}" style="stroke: #94a3b8; stroke-width: 0.8;" />
      <text x="${(x1+x2)/2}" y="${midDepthY + 17}" text-anchor="middle" fill="#94a3b8" style="font-size: 7px; stroke: none; font-family: monospace; font-weight: 600;">L2 = ${midLen.toFixed(2)}m</text>
    </svg>
  `;
}

export function updatePropertyInspector(group) {
  console.log("Selected group in inspector:", group);
  console.log("Bridge database specs (bridgeData):", state.bridgeData);

  // Open the right panel if collapsed
  const p = document.getElementById("right-panel");
  if (p) {
    const wasCollapsed = p.classList.contains("collapsed");
    p.classList.remove("collapsed");
    const t = document.getElementById("right-trigger");
    if (t) t.style.display = "none";
    
    // On tablet/mobile (<= 1024px), if we open the right panel, collapse the left panel
    if (wasCollapsed && window.innerWidth <= 1024) {
      const lp = document.getElementById("left-panel");
      const lt = document.getElementById("left-trigger");
      if (lp && !lp.classList.contains("collapsed")) {
        lp.classList.add("collapsed");
        if (lt) lt.style.display = "block";
      }
    }
  }

  // Switch right panel tab to 'groups'
  window.switchRightTab('groups');
  
  // Collapse all other accordions first
  document.querySelectorAll(".group-details-accordion").forEach((acc) => {
    acc.style.display = "none";
    acc.innerHTML = "";
  });

  let targetAccordion = null;
  if (group) {
    const groupEl = document.querySelector(`.group-item[data-group="${group.name}"]`);
    if (groupEl) {
      targetAccordion = groupEl.querySelector(".group-details-accordion");
    }
  }

  let htmlContent = "";

  const isSteel = state.bridgeData && 
                  state.bridgeData.bridge_type && 
                  !state.bridgeData.bridge_type.toLowerCase().includes("psc") && 
                  !state.bridgeData.bridge_type.toLowerCase().includes("prestressed");

  if (!group && state.bridgeData) {
    htmlContent = `
      <div class="metric-card mb-0" style="min-width: 230px;">
        <span class="metric-header">General Specs</span>
        <table class="table table-borderless table-sm text-white mb-0" style="font-size: 11px; --bs-table-bg: transparent;">
          <tbody>
            <tr><td class="text-muted p-0 py-1">Bridge ID</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.bridge_id || "M_20_2L_NF_S"}</td></tr>
            <tr><td class="text-muted p-0 py-1">Bridge Type</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.bridge_type || "N/A"}</td></tr>
            <tr><td class="text-muted p-0 py-1">Location</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.location || "Mumbai"}</td></tr>
            <tr><td class="text-muted p-0 py-1">Span Length</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.span_m || "20"} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Total Width</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.total_width_m || "8.5"} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Lanes</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.lanes || "2"}</td></tr>
          </tbody>
        </table>
      </div>

      <div class="metric-card mb-0" style="min-width: 230px;">
        <span class="metric-header">Materials & Spacing</span>
        <table class="table table-borderless table-sm text-white mb-0" style="font-size: 11px; --bs-table-bg: transparent;">
          <tbody>
            <tr><td class="text-muted p-0 py-1">Concrete Grade</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.material_grades?.concrete_substructure_and_deck_slab || "M35"}</td></tr>
            <tr><td class="text-muted p-0 py-1">Structural Steel</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.material_grades?.structural_steel || "E350"}</td></tr>
            <tr><td class="text-muted p-0 py-1">Rebar Grade</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.material_grades?.rebar || "Fe500"}</td></tr>
            <tr><td class="text-muted p-0 py-1">Girder Spacing</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.grid_spacing_m || state.bridgeData.girder_spacing_m || "2.875"} m</td></tr>
          </tbody>
        </table>
      </div>

      <div class="metric-card mb-0" style="min-width: 230px;">
        <span class="metric-header">Substructure: Piers</span>
        <table class="table table-borderless table-sm text-white mb-0" style="font-size: 11px; --bs-table-bg: transparent;">
          <tbody>
            <tr><td class="text-muted p-0 py-1">Pier Height</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.substructure?.pier?.height_m || "6.0"} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Pier Diameter</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.substructure?.pier?.diameter_m || "1.2"} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Pier Cap Width</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.substructure?.pier_cap?.width_m || "1.4"} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Cap Depth (Mid)</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.substructure?.pier_cap?.mid_depth_m || "1.45"} m</td></tr>
          </tbody>
        </table>
      </div>

      <div class="metric-card mb-0" style="min-width: 230px;">
        <span class="metric-header">Substructure: Piles</span>
        <table class="table table-borderless table-sm text-white mb-0" style="font-size: 11px; --bs-table-bg: transparent;">
          <tbody>
            <tr><td class="text-muted p-0 py-1">Piles Count</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.substructure?.pile?.count || "4"}</td></tr>
            <tr><td class="text-muted p-0 py-1">Pile Depth</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.substructure?.pile?.depth_m || "10.0"} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Pile Diameter</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.substructure?.pile?.diameter_m || "0.75"} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Cap Dimensions</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.substructure?.pile_cap?.dimensions_m?.raw || "3.8 x 3.8 m"}</td></tr>
            <tr><td class="text-muted p-0 py-1">Cap Depth</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.substructure?.pile_cap?.depth_m || "0.85"} m</td></tr>
          </tbody>
        </table>
      </div>
    `;
  } else if (
    group &&
    (group.name === "deck_slab" || group.name.toLowerCase() === "slab" || group.name.toLowerCase() === "deck") &&
    state.bridgeData.deck_slab
  ) {
    htmlContent = `
      <div class="metric-card mb-0" style="min-width: 250px;">
        <span class="metric-header">Deck Slab Specifications</span>
        <table class="table table-borderless table-sm text-white mb-0" style="font-size: 11px; --bs-table-bg: transparent;">
          <tbody>
            <tr><td class="text-muted p-0 py-1">Thickness</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.deck_slab.depth_m} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Concrete Grade</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.material_grades?.concrete_substructure_and_deck_slab || "M35"}</td></tr>
            <tr><td class="text-muted p-0 py-1">Rebar Grade</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.material_grades?.rebar || "Fe500"}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  } else if (
    group &&
    isSteel &&
    (group.name === "cross_bracing" || 
     group.name.toLowerCase() === "bracing" || 
     group.name.toLowerCase().includes("brace") || 
     group.name.toLowerCase() === "chord" || 
     group.name.toLowerCase() === "cord" ||
     group.name.toLowerCase() === "diaphragm") &&
    state.bridgeData.cross_bracing
  ) {
    const isChord = group.name.toLowerCase() === "chord" || group.name.toLowerCase() === "cord";
    const isDiaphragm = group.name.toLowerCase() === "diaphragm";
    const displayName = isChord ? "Chord" : (isDiaphragm ? "Intermediate Diaphragm" : "Cross Bracing");
    htmlContent = `
      <div class="metric-card mb-0" style="min-width: 250px;">
        <span class="metric-header">${displayName} Specifications</span>
        <table class="table table-borderless table-sm text-white mb-0" style="font-size: 11px; --bs-table-bg: transparent;">
          <tbody>
            <tr><td class="text-muted p-0 py-1">Section Profile</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.cross_bracing.section?.raw || "90x90x10"}</td></tr>
            <tr><td class="text-muted p-0 py-1">Spacing</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.cross_bracing.spacing_m} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Total Pairs</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.cross_bracing.count}</td></tr>
            <tr><td class="text-muted p-0 py-1">Material Grade</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.material_grades?.structural_steel || "E350"}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  } else if (
    group &&
    (group.name.toLowerCase().includes("end diaphragm") || group.name === "end_diaphragm") &&
    state.bridgeData.girder_sections?.end_diaphragm
  ) {
    const props = state.bridgeData.girder_sections.end_diaphragm;
    let colorHex = "#607d8b";
    const firstPartID = Array.from(state.groupIndex.get(group.name) || [])[0];
    if (firstPartID) {
      const meshes = state.meshMap.get(firstPartID);
      if (meshes && meshes[0]) {
        colorHex = "#" + meshes[0].material.color.getHexString();
      }
    } else {
      colorHex = getMaterialColor(group.name);
    }
    const svgHtml = generateGirderSVG(props, colorHex);

    htmlContent = `
      <div class="metric-card mb-0" style="min-width: 250px;">
        <span class="metric-header" style="margin-bottom: 8px;">End Diaphragm Specifications</span>
        <div style="display: flex; gap: 15px; align-items: center; justify-content: center;">
          ${svgHtml}
          <table class="table table-borderless table-sm text-white mb-0" style="font-size: 11px; --bs-table-bg: transparent;">
            <tbody>
              <tr><td class="text-muted p-0 py-0.5">Web Depth</td><td class="text-end text-white font-monospace p-0 py-0.5">${props.web_depth_m || "0.0"} m</td></tr>
              <tr><td class="text-muted p-0 py-0.5">Web Thickness</td><td class="text-end text-white font-monospace p-0 py-0.5">${props.web_thickness_m || "0.0"} m</td></tr>
              <tr><td class="text-muted p-0 py-0.5">Top Flange</td><td class="text-end text-white font-monospace p-0 py-0.5">${props.top_flange_width_m || "0.0"} × ${props.top_flange_thickness_m || "0.0"} m</td></tr>
              <tr><td class="text-muted p-0 py-0.5">Bottom Flange</td><td class="text-end text-white font-monospace p-0 py-0.5">${props.bottom_flange_width_m || "0.0"} × ${props.bottom_flange_thickness_m || "0.0"} m</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (
    group &&
    isSteel &&
    (group.name === "girder_sections" || group.name.toLowerCase() === "girder") &&
    state.bridgeData.girder_sections
  ) {
    const displayName = "Girder";

    const activeSegs = state.bridgeData.girder_sections.longitudinal_segmentation_m
      ? state.bridgeData.girder_sections.longitudinal_segmentation_m.filter(
          (seg) => seg.initial_m !== seg.end_m,
        )
      : [];

    const sectionNames = {
      support: "Support Span",
      intermediate: "Intermediate Span",
      mid: "Mid Span",
    };

    const sectionColors = {
      support: "#134e5e",
      intermediate: "#007a99",
      mid: "#00a8cc",
    };

    let barHtml = "";
    let cardsHtml = "";

    activeSegs.forEach((seg) => {
      const name = sectionNames[seg.section] || seg.section;
      const color = sectionColors[seg.section] || "#607d8b";
      const length = seg.end_m - seg.initial_m;
      const props = state.bridgeData.girder_sections[seg.section] || {};

      barHtml += `
        <div style="flex: ${length}; background: ${color}; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">
          ${name}
        </div>
      `;

      cardsHtml += `
        <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255,255,255,0.04); padding: 8px 12px; border-radius: 6px;">
          <div style="font-size: 9px; font-weight: 600; color: ${color}; margin-bottom: 4px; text-transform: uppercase;">
            ${name} (${seg.initial_m.toFixed(1)} - ${seg.end_m.toFixed(1)} m)
          </div>
          <table class="table table-borderless table-sm text-white mb-0" style="font-size: 11px; --bs-table-bg: transparent;">
            <tbody>
              <tr><td class="text-muted p-0 py-0.5">Web Depth</td><td class="text-end text-white font-monospace p-0 py-0.5">${props.web_depth_m || "0.0"} m</td></tr>
              <tr><td class="text-muted p-0 py-0.5">Web Thick</td><td class="text-end text-white font-monospace p-0 py-0.5">${props.web_thickness_m || "0.0"} m</td></tr>
              <tr><td class="text-muted p-0 py-0.5">Top Flange</td><td class="text-end text-white font-monospace p-0 py-0.5">${props.top_flange_width_m || "0.0"} × ${props.top_flange_thickness_m || "0.0"} m</td></tr>
              <tr><td class="text-muted p-0 py-0.5">Bot Flange</td><td class="text-end text-white font-monospace p-0 py-0.5">${props.bottom_flange_width_m || "0.0"} × ${props.bottom_flange_thickness_m || "0.0"} m</td></tr>
            </tbody>
          </table>
        </div>
      `;
    });

    htmlContent = `
      <div class="metric-card mb-0" style="display: flex; flex-direction: column; width: 100%;">
        <span class="metric-header" style="margin-bottom: 12px;">${displayName} Longitudinal Segmentation Specs</span>
        
        <!-- Visual Segment Bar -->
        <div style="display: flex; height: 28px; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.15); margin-bottom: 12px;">
          ${barHtml}
        </div>
        
        <!-- Vertically Stacked Specifications -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${cardsHtml}
        </div>
      </div>
      
      <!-- Girder/Chord Spacing -->
      <div class="metric-card mb-0" style="width: 100%; display: flex; flex-direction: row; justify-content: space-between; align-items: center; padding: 10px 14px; margin-top: 8px;">
        <span class="metric-header" style="margin-bottom: 0;">${displayName} Spacing</span>
        <span class="metric-value font-monospace" style="font-size: 16px; color: #60a5fa;">${state.bridgeData.grid_spacing_m || state.bridgeData.girder_spacing_m || "2.875"} m</span>
      </div>
    `;
  } else if (
    group &&
    (group.name.toLowerCase() === "pier" || group.name === "Pier Shaft") &&
    state.bridgeData.substructure?.pier
  ) {
    const p = state.bridgeData.substructure.pier;
    htmlContent = `
      <div class="metric-card mb-0" style="min-width: 250px;">
        <span class="metric-header">Pier Column Specifications</span>
        <table class="table table-borderless table-sm text-white mb-0" style="font-size: 11px; --bs-table-bg: transparent;">
          <tbody>
            <tr><td class="text-muted p-0 py-1">Height</td><td class="text-end text-white font-monospace p-0 py-1">${p.height_m} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Diameter</td><td class="text-end text-white font-monospace p-0 py-1">${p.diameter_m} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Concrete Grade</td><td class="text-end text-white font-monospace p-0 py-1">${state.bridgeData.material_grades?.concrete_substructure_and_deck_slab || "M35"}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  } else if (
    group &&
    (group.name.toLowerCase().includes("pier cap") || group.name === "pier_cap") &&
    state.bridgeData.substructure?.pier_cap
  ) {
    const pc = state.bridgeData.substructure.pier_cap;
    let colorHex = "#607d8b";
    const firstPartID = Array.from(state.groupIndex.get(group.name) || [])[0];
    if (firstPartID) {
      const meshes = state.meshMap.get(firstPartID);
      if (meshes && meshes[0]) {
        colorHex = "#" + meshes[0].material.color.getHexString();
      }
    } else {
      colorHex = getMaterialColor(group.name);
    }

    const svgHtml = generatePierCapSVG(pc, colorHex);

    htmlContent = `
      <div class="metric-card mb-0" style="min-width: 250px;">
        <span class="metric-header" style="margin-bottom: 8px;">Pier Cap Specifications</span>
        ${svgHtml}
        <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 10px; margin-bottom: 12px; font-size: 8px; color: #94a3b8; font-family: monospace; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
          <span><strong>L1</strong>: Total Length</span>
          <span><strong>L2</strong>: Mid Length</span>
          <span><strong>d1</strong>: Mid Depth</span>
          <span><strong>d2</strong>: End Depth</span>
        </div>
        <table class="table table-borderless table-sm text-white mb-0" style="font-size: 11px; --bs-table-bg: transparent;">
          <tbody>
            <tr><td class="text-muted p-0 py-1">Cap Width</td><td class="text-end text-white font-monospace p-0 py-1">${pc.width_m} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Mid Depth (d1)</td><td class="text-end text-white font-monospace p-0 py-1">${pc.mid_depth_m} m</td></tr>
            <tr><td class="text-muted p-0 py-1">End Depth (d2)</td><td class="text-end text-white font-monospace p-0 py-1">${pc.end_depth_m} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Mid Length (L2)</td><td class="text-end text-white font-monospace p-0 py-1">${pc.mid_section_length_m || "2.0"} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Side Length (Taper)</td><td class="text-end text-white font-monospace p-0 py-1">${pc.taper_section_length_m || "3.63"} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Total Length (L1)</td><td class="text-end text-white font-monospace p-0 py-1">${((parseFloat(pc.mid_section_length_m) || 2.0) + 2 * (parseFloat(pc.taper_section_length_m) || 3.63)).toFixed(2)} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Reinforcement Ratio</td><td class="text-end text-white font-monospace p-0 py-1">${((pc.reinforcement_pct || 0) * 100).toFixed(2)} %</td></tr>
          </tbody>
        </table>
      </div>
    `;
  } else if (
    group &&
    (group.name.toLowerCase() === "pile cap" || group.name === "pile_cap") &&
    state.bridgeData.substructure?.pile_cap
  ) {
    const pcap = state.bridgeData.substructure.pile_cap;
    htmlContent = `
      <div class="metric-card mb-0" style="min-width: 250px;">
        <span class="metric-header">Pile Cap Specifications</span>
        <table class="table table-borderless table-sm text-white mb-0" style="font-size: 11px; --bs-table-bg: transparent;">
          <tbody>
            <tr><td class="text-muted p-0 py-1">Depth</td><td class="text-end text-white font-monospace p-0 py-1">${pcap.depth_m} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Dimensions (W x L)</td><td class="text-end text-white font-monospace p-0 py-1">${pcap.dimensions_m?.raw || `${pcap.dimensions_m?.width_m} x ${pcap.dimensions_m?.length_m} m`}</td></tr>
            <tr><td class="text-muted p-0 py-1">PCC Bedding Depth</td><td class="text-end text-white font-monospace p-0 py-1">${pcap.pcc_depth_m} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Reinforcement Ratio</td><td class="text-end text-white font-monospace p-0 py-1">${((pcap.reinforcement_pct || 0) * 100).toFixed(2)} %</td></tr>
          </tbody>
        </table>
      </div>
    `;
  } else if (
    group &&
    (group.name.toLowerCase() === "pile" || group.name === "piles" || group.name === "Pile") &&
    state.bridgeData.substructure?.pile
  ) {
    const pile = state.bridgeData.substructure.pile;
    htmlContent = `
      <div class="metric-card mb-0" style="min-width: 250px;">
        <span class="metric-header">Foundation Pile Specifications</span>
        <table class="table table-borderless table-sm text-white mb-0" style="font-size: 11px; --bs-table-bg: transparent;">
          <tbody>
            <tr><td class="text-muted p-0 py-1">Piles Count</td><td class="text-end text-white font-monospace p-0 py-1">${pile.count}</td></tr>
            <tr><td class="text-muted p-0 py-1">Pile Depth</td><td class="text-end text-white font-monospace p-0 py-1">${pile.depth_m} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Pile Diameter</td><td class="text-end text-white font-monospace p-0 py-1">${pile.diameter_m} m</td></tr>
            <tr><td class="text-muted p-0 py-1">Reinforcement Ratio</td><td class="text-end text-white font-monospace p-0 py-1">${((pile.reinforcement_pct || 0) * 100).toFixed(2)} %</td></tr>
          </tbody>
        </table>
      </div>
    `;
  } else if (
    group &&
    isSteel &&
    (group.name.toLowerCase().includes("stiffener") || group.name.toLowerCase().includes("stifferen"))
  ) {
    const nameLower = group.name.toLowerCase();
    const isBearing = nameLower.includes("bearing") || nameLower.includes("end");
    const dbKey = isBearing ? "bearing_stiffeners_per_girder_side" : "transverse_stiffeners_per_girder_side";
    const s = state.bridgeData[dbKey];

    if (s) {
      const displayName = isBearing ? "Bearing Stiffeners" : "Transverse Stiffeners";
      htmlContent = `
        <div class="metric-card mb-0" style="min-width: 250px;">
          <span class="metric-header">${displayName} Specifications</span>
          <table class="table table-borderless table-sm text-white mb-0" style="font-size: 11px; --bs-table-bg: transparent;">
            <tbody>
              <tr><td class="text-muted p-0 py-1">Width</td><td class="text-end text-white font-monospace p-0 py-1">${s.width_m} m</td></tr>
              <tr><td class="text-muted p-0 py-1">Thickness</td><td class="text-end text-white font-monospace p-0 py-1">${s.thickness_m} m</td></tr>
              <tr><td class="text-muted p-0 py-1">Spacing Interval</td><td class="text-end text-white font-monospace p-0 py-1">${s.spacing_m} m</td></tr>
            </tbody>
          </table>
        </div>
      `;
    }
  }

  // Fallback if no specific template content was loaded (e.g. PSC components)
  if (!htmlContent.trim()) {
    const isPSC = state.bridgeData?.bridge_type?.includes("PSC") || state.bridgeData?.bridge_type?.includes("Prestressed");
    htmlContent = `
      <div class="text-muted text-center w-100 py-4 font-monospace" style="font-size: 11px;">
        ${isPSC ? "Specifications not yet mapped for Prestressed Concrete (PSC) models." : "No properties found for this component."}
      </div>
    `;
  }



  if (targetAccordion && htmlContent) {
    targetAccordion.innerHTML = htmlContent;
    targetAccordion.style.display = "block";
    
    // Smooth scroll the selected group item into view within the panel content
    const groupEl = document.querySelector(`.group-item[data-group="${group.name}"]`);
    if (groupEl) {
      groupEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
}

// ── Bridge Model Library Catalog Renderer ──────────────────────────
export function renderCatalog(matches, currentIfcPath) {
  const container = document.getElementById("catalog-list");
  if (!container) return;
  
  container.innerHTML = "";
  
  const countSpan = document.getElementById("catalog-count");
  if (countSpan) countSpan.textContent = matches.length;
  
  if (matches.length === 0) {
    container.innerHTML = `
      <div class="text-muted text-center w-100 py-4 font-monospace" style="font-size: 11px; color: rgba(255,255,255,0.4) !important;">
        No models match primary filters.
      </div>
    `;
    return;
  }
  
  matches.forEach(item => {
    const isLoaded = item.ifc === currentIfcPath;
    const pathParts = item.ifc.split("/");
    const lastPart = pathParts.pop();
    const bridgeIdFromPath = lastPart.toLowerCase() === "model.ifc" ? pathParts.pop() : lastPart.replace(".ifc", "");
    
    const spanText = `${item.span}m`;
    const lanesText = item.lanes === "2L" ? "2 Lanes" : "3 Lanes";
    const footpathText = item.footpath === "OF" ? "With Footpath" : "No Footpath";
    
    let iconClass = "bi-bezier2";
    if (item.structure === "Superstructure") {
      iconClass = "bi-bridge-fill";
    } else if (item.structure === "Substructure") {
      iconClass = "bi-bricks";
    }
    
    const card = document.createElement("div");
    card.className = `catalog-card ${isLoaded ? 'active' : ''}`;
    card.setAttribute("data-ifc", item.ifc);
    
    card.onclick = () => {
      window.loadBridgeByCard(item);
    };
    
    card.innerHTML = `
      <div class="catalog-card-header">
        <div class="catalog-card-badge">${item.bridge_type}</div>
      </div>
      <div class="catalog-card-stats">
        <div class="catalog-stat-item">
          <span class="catalog-stat-label">Span</span>
          <span class="catalog-stat-val">${spanText}</span>
        </div>
        <div class="catalog-stat-item">
          <span class="catalog-stat-label">Lanes</span>
          <span class="catalog-stat-val">${lanesText}</span>
        </div>
        <div class="catalog-stat-item">
          <span class="catalog-stat-label">Footpath</span>
          <span class="catalog-stat-val">${footpathText}</span>
        </div>
      </div>
      <div class="catalog-card-footer">
        <span class="catalog-card-location"><i class="bi bi-geo-alt-fill text-primary me-1"></i>${item.location}</span>
        <button class="catalog-load-btn">
          ${isLoaded ? '<i class="bi bi-check-lg"></i> Loaded' : 'Load Model'}
        </button>
      </div>
    `;
    
    container.appendChild(card);
  });
}

export function updateCardActiveStates(activeIfcPath) {
  document.querySelectorAll(".catalog-card").forEach((card) => {
    const isLoaded = card.getAttribute("data-ifc") === activeIfcPath;
    card.classList.toggle("active", isLoaded);
    
    const btn = card.querySelector(".catalog-load-btn");
    if (btn) {
      btn.innerHTML = isLoaded ? '<i class="bi bi-check-lg"></i> Loaded' : 'Load Model';
    }
  });
}

// ── Render Bridge Downloads List ──
export function renderDownloads(bridgeId, ifcPath) {
  const container = document.getElementById("downloads-container");
  if (!container) return;

  container.innerHTML = "";

  let jsonPath = null;
  let pdfPath = null;
  let mcbPath = null;
  let cadPath = null;

  const currentBridge = state.currentLoadedBridge;
  if (currentBridge && currentBridge.ifc === ifcPath) {
    jsonPath = currentBridge.json;
    pdfPath = currentBridge.design_report;
    mcbPath = currentBridge.design_file;
    cadPath = currentBridge.cad;
  } else if (ifcPath) {
    // Fallback if not loaded/found from state
    const lower = ifcPath.toLowerCase();
    if (lower.endsWith("/model.ifc")) {
      jsonPath = ifcPath.substring(0, ifcPath.length - 9) + "groups.json";
    } else {
      jsonPath = ifcPath.replace(".ifc", ".json");
    }
  }

  // 1. PDF Design Report (Rendered only if it exists)
  if (pdfPath) {
    container.innerHTML += `
      <div class="metric-card mb-0">
        <span class="metric-header">Design Documentation</span>
        <div class="d-flex align-items-center justify-content-between py-2 border-bottom border-secondary border-opacity-25">
          <div>
            <div class="text-white fw-bold font-monospace" style="font-size: 11px;">${bridgeId}_design_report.pdf</div>
            <div class="text-muted" style="font-size: 9px;">PDF Document • ~4.5 MB</div>
          </div>
          <a href="${pdfPath}" download="${bridgeId}_design_report.pdf" class="btn btn-sm btn-outline-primary" style="font-size: 10px; padding: 4px 8px; color: #3b82f6; border-color: rgba(59, 130, 246, 0.4);"><i class="bi bi-download"></i> Download</a>
        </div>
      </div>
    `;
  }

  // 2. MCB Analysis Model (Rendered only if it exists)
  if (mcbPath) {
    container.innerHTML += `
      <div class="metric-card mb-0">
        <span class="metric-header">Analysis Model</span>
        <div class="d-flex align-items-center justify-content-between py-2 border-bottom border-secondary border-opacity-25">
          <div>
            <div class="text-white fw-bold font-monospace" style="font-size: 11px;">${bridgeId}_model.mcb</div>
            <div class="text-muted" style="font-size: 9px;">Midas Civil File • ~1.2 MB</div>
          </div>
          <a href="${mcbPath}" download="${bridgeId}_model.mcb" class="btn btn-sm btn-outline-primary" style="font-size: 10px; padding: 4px 8px; color: #3b82f6; border-color: rgba(59, 130, 246, 0.4);"><i class="bi bi-download"></i> Download</a>
        </div>
      </div>
    `;
  }

  // 3. CAD Drawings (Rendered only if it exists)
  if (cadPath) {
    const ext = cadPath.split(".").pop();
    container.innerHTML += `
      <div class="metric-card mb-0">
        <span class="metric-header">2D CAD Drawings</span>
        <div class="d-flex align-items-center justify-content-between py-2 border-bottom border-secondary border-opacity-25">
          <div>
            <div class="text-white fw-bold font-monospace" style="font-size: 11px;">${bridgeId}_drawings.${ext}</div>
            <div class="text-muted" style="font-size: 9px;">CAD Drawing File</div>
          </div>
          <a href="${cadPath}" download="${bridgeId}_drawings.${ext}" class="btn btn-sm btn-outline-primary" style="font-size: 10px; padding: 4px 8px; color: #3b82f6; border-color: rgba(59, 130, 246, 0.4);"><i class="bi bi-download"></i> Download</a>
        </div>
      </div>
    `;
  }

  // 4. IFC Model (Always rendered)
  if (ifcPath) {
    container.innerHTML += `
      <div class="metric-card mb-0">
        <span class="metric-header">3D CAD Model</span>
        <div class="d-flex align-items-center justify-content-between py-2 border-bottom border-secondary border-opacity-25">
          <div>
            <div class="text-white fw-bold font-monospace" style="font-size: 11px;">${bridgeId}.ifc</div>
            <div class="text-muted" style="font-size: 9px;">IFC Model File • Source</div>
          </div>
          <a href="${ifcPath}" download="${bridgeId}.ifc" class="btn btn-sm btn-outline-primary" style="font-size: 10px; padding: 4px 8px; color: #3b82f6; border-color: rgba(59, 130, 246, 0.4);"><i class="bi bi-download"></i> Download</a>
        </div>
      </div>
    `;
  }

  // 5. JSON Schema (Always rendered)
  if (jsonPath) {
    container.innerHTML += `
      <div class="metric-card mb-0">
        <span class="metric-header">Structural Schema Data</span>
        <div class="d-flex align-items-center justify-content-between py-2 border-bottom border-secondary border-opacity-25">
          <div>
            <div class="text-white fw-bold font-monospace" style="font-size: 11px;">${bridgeId}.json</div>
            <div class="text-muted" style="font-size: 9px;">JSON Data File</div>
          </div>
          <a href="${jsonPath}" download="${bridgeId}.json" class="btn btn-sm btn-outline-primary" style="font-size: 10px; padding: 4px 8px; color: #3b82f6; border-color: rgba(59, 130, 246, 0.4);"><i class="bi bi-download"></i> Download</a>
        </div>
      </div>
    `;
  }
}

// ── Dropdown Menu Toggle Handler ──
window.toggleDropdownMenu = function (event) {
  event.stopPropagation();
  const dropdown = document.getElementById("more-menu-content");
  if (dropdown) {
    dropdown.classList.toggle("show");
  }
};

// Close dropdown if clicked outside
document.addEventListener("click", () => {
  const dropdown = document.getElementById("more-menu-content");
  if (dropdown && dropdown.classList.contains("show")) {
    dropdown.classList.remove("show");
  }
});

// ── Theme Switching Handler ──
const savedTheme = localStorage.getItem("bridge-lcca-theme") || "dark";
document.documentElement.setAttribute("data-bs-theme", savedTheme);

window.toggleSiteTheme = function (event) {
  if (event) event.preventDefault();
  const html = document.documentElement;
  const currentTheme = html.getAttribute("data-bs-theme") || "dark";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  
  html.setAttribute("data-bs-theme", newTheme);
  localStorage.setItem("bridge-lcca-theme", newTheme);
  
  updateThemeUI(newTheme);
};

function updateThemeUI(theme) {
  const icon = document.getElementById("theme-toggle-icon");
  const text = document.getElementById("theme-toggle-text");
  
  if (theme === "light") {
    if (icon) icon.className = "bi bi-moon-fill me-2";
    if (text) text.innerText = "Dark Mode";
  } else {
    if (icon) icon.className = "bi bi-sun-fill me-2";
    if (text) text.innerText = "Light Mode";
  }
}

// Call updateThemeUI on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => updateThemeUI(savedTheme));
} else {
  setTimeout(() => updateThemeUI(savedTheme), 50);
}

// ── LCCA Rendering Functions ──
const MASTER_LABELS = {
  // Initial Stage
  "initial_stage|economic|initial_construction_cost": "Initial Construction Cost",
  "initial_stage|economic|time_cost_of_loan": "Time Costs",
  "initial_stage|environmental|initial_material_carbon_emission_cost": "Initial Carbon Emissions",
  "initial_stage|environmental|initial_vehicular_emission_cost": "Carbon emissions due to Rerouting (Construction)",
  "initial_stage|social|initial_road_user_cost": "Road User Costs (Construction)",

  // Use Stage
  "use_stage|economic|routine_inspection_costs": "Routine Inspection Costs",
  "use_stage|economic|periodic_maintenance": "Periodic Maintenance Costs",
  "use_stage|economic|major_inspection_costs": "Major Inspection Costs",
  "use_stage|economic|major_repair_cost": "Major Repair Costs",
  "use_stage|economic|replacement_costs_for_bearing_and_expansion_joint": "Replacement Costs of Bearings and Expansion joints",
  "use_stage|environmental|periodic_carbon_costs": "Periodic Maintenance related Carbon Emissions",
  "use_stage|environmental|major_repair_material_carbon_emission_costs": "Major Repair related Carbon Emissions",
  "use_stage|environmental|major_repair_vehicular_emission_costs": "Carbon Emissions due to Rerouting during Major Repairs",
  "use_stage|environmental|vehicular_emission_costs_for_replacement_of_bearing_and_expansion_joint": "Carbon Emissions due to Rerouting during Replacement of Bearings and Expansion joints",
  "use_stage|social|major_repair_road_user_costs": "Road User Costs during Major Repairs",
  "use_stage|social|road_user_costs_for_replacement_of_bearing_and_expansion_joint": "Road User Costs during Replacement of Bearings and Expansion joints",

  // Reconstruction Stage
  "reconstruction|economic|total_demolition_and_disposal_costs": "Demolition and Disposal Costs",
  "reconstruction|economic|total_scrap_value": "Recycling Costs",
  "reconstruction|economic|cost_of_reconstruction_after_demolition": "Reconstruction Costs",
  "reconstruction|economic|time_cost_of_loan": "Time Costs",
  "reconstruction|environmental|carbon_costs_demolition_and_disposal": "Demolition and Disposal related Carbon Emissions",
  "reconstruction|environmental|demolition_vehicular_emission_cost": "Carbon Emissions due to Rerouting during Demolition and Disposal",
  "reconstruction|environmental|carbon_cost_of_reconstruction_after_demolition": "Reconstruction related Carbon Emissions",
  "reconstruction|environmental|reconstruction_vehicular_emission_cost": "Carbon Emissions due to Rerouting during Reconstruction",
  "reconstruction|social|ruc_demolition": "Road User Costs related to Demolition and Disposal during Reconstruction",
  "reconstruction|social|ruc_reconstruction": "Road User Costs during Reconstruction",

  // End of Life Stage
  "end_of_life|economic|total_demolition_and_disposal_costs": "Demolition and Disposal Costs",
  "end_of_life|economic|total_scrap_value": "Recycling Costs",
  "end_of_life|environmental|carbon_costs_demolition_and_disposal": "Demolition and Disposal related Carbon Emissions",
  "end_of_life|environmental|demolition_vehicular_emission_cost": "Carbon Emissions due to Rerouting during Demolition and Disposal",
  "end_of_life|social|ruc_demolition": "Road User Costs due to Demolition and Disposal"
};

// Fallback for simple flat translations if needed
const LCCA_NAMES = {
  initial_construction_cost: 'Initial Construction Cost',
  time_cost_of_loan: 'Time Costs',
  initial_material_carbon_emission_cost: 'Initial Carbon Emissions',
  initial_vehicular_emission_cost: 'Carbon emissions due to Rerouting (Construction)',
  initial_road_user_cost: 'Road User Costs (Construction)'
};

const LCCA_PILLARS = [
  { id: 'economic',      label: 'Economic',      color: '#3b82f6', cvar: '--pl1' },
  { id: 'environmental', label: 'Environmental', color: '#10b981', cvar: '--pl2' },
  { id: 'social',        label: 'Social',        color: '#ff5a2a', cvar: '--pl3' }
];

function formatINR(v) {
  const s = v < 0 ? '-' : '';
  return s + '₹' + Math.round(Math.abs(v)).toLocaleString('en-IN');
}

function formatCompactINR(v) {
  const s = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1e7) return s + '₹' + (a/1e7).toFixed(2) + ' Cr';
  if (a >= 1e5) return s + '₹' + (a/1e5).toFixed(2) + ' L';
  if (a >= 1e3) return s + '₹' + (a/1e3).toFixed(1) + 'K';
  return s + '₹' + a.toFixed(0);
}

const pct = (v, of) => (of > 0 ? (100 * v / of).toFixed(1) : '0.0') + '%';
const cv = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function inkOn(hex) {
  if (!hex || hex[0] !== '#') return 'var(--text-main)';
  const n = parseInt(hex.slice(1), 16), r = n>>16, g = (n>>8)&255, b = n&255;
  return (0.2126*r + 0.7152*g + 0.0722*b) / 255 > 0.55 ? '#0f172a' : '#ffffff';
}

const ttRow = (color, label, value, lines) =>
  `<div class="t"><span class="sw" style="background:${color}"></span>${label}</div>` +
  `<div class="v">${formatINR(value)}</div>` + lines.map(l => `<div>${l}</div>`).join('');

function bindTip(sel, html) {
  let tooltip = document.getElementById('lcca-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'lcca-tooltip';
    tooltip.className = 'lcca-tooltip';
    document.body.appendChild(tooltip);
  }
  
  sel.on('mousemove.tt', (e, d) => {
    tooltip.innerHTML = html(d);
    tooltip.style.display = 'block';
    const r = tooltip.getBoundingClientRect();
    tooltip.style.left = Math.min(e.clientX + 14, window.innerWidth  - r.width  - 8) + 'px';
    tooltip.style.top  = Math.min(e.clientY + 14, window.innerHeight - r.height - 8) + 'px';
  })
  .on('mouseleave.tt', () => { tooltip.style.display = 'none'; })
  .on('focus.tt', function(e, d) { 
    const b = this.getBoundingClientRect(); 
    tooltip.innerHTML = html(d);
    tooltip.style.display = 'block';
    const r = tooltip.getBoundingClientRect();
    tooltip.style.left = Math.min(b.x + b.width/2 + 14, window.innerWidth  - r.width  - 8) + 'px';
    tooltip.style.top  = Math.min(b.y + b.height/2 + 14, window.innerHeight - r.height - 8) + 'px';
  })
  .on('blur.tt', () => { tooltip.style.display = 'none'; });
}

function renderDashCard(el, title, sub, legendGroups, footnote) {
  const d = document.getElementById(el);
  if (!d) return;
  d.innerHTML = `<h3>${title}</h3><p class="sub">${sub}</p><div class="legend">` +
    legendGroups.map(gp =>
      (gp.name ? `<span class="grp">${gp.name}</span>` : '') +
      gp.items.map(it => `<span class="it"><span class="sw" style="background:${it.color}"></span>${it.label}</span>`).join('')
    ).join('') + `</div>` +
    (footnote ? `<div class="footnote">${footnote}</div>` : '');
  return d;
}

function donut(el, data, o) {
  const W = o.W || 560, H = o.H || 330, R = o.R || 118, cx = W/2, cy = H/2;
  const root = d3.select(el);
  root.selectAll('svg').remove();
  root.selectAll('.nochart').remove();
  data = data.filter(d => d.value > 0);
  const total = d3.sum(data, d => d.value);
  if (!data.length || total <= 0) {
    root.insert('div', '.legend').attr('class', 'nochart')
      .text('Pie not drawn — no positive costs here. A pie chart cannot show negative values; the credits are listed in the table view.');
    return;
  }
  const svg = root.insert('svg', '.legend').attr('viewBox', `0 0 ${W} ${H}`)
    .attr('role', 'img').attr('aria-label', o.aria || o.title);
  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);
  const arcs = d3.pie().sort(null).value(d => d.value)(data);
  const arc = d3.arc().innerRadius(R*0.56).outerRadius(R).cornerRadius(2);

  const paths = g.selectAll('path').data(arcs).join('path')
    .attr('class', 'slice').attr('tabindex', 0)
    .attr('d', arc).attr('fill', d => d.data.color)
    .attr('stroke', 'none')
    .attr('aria-label', d => `${d.data.label}: ${formatINR(d.data.value)}, ${pct(d.data.value, total)}`);
  
  paths.on('mouseenter.hl', function() { paths.attr('opacity', 0.35); d3.select(this).attr('opacity', null); })
       .on('mouseleave.hl', () => paths.attr('opacity', null));
  
  bindTip(paths, d => ttRow(d.data.color, d.data.label, d.data.value,
    [`${pct(d.data.value, total)} of ${o.ofLabel || 'total'}`, ...(d.data.tip || [])]));

  g.append('text').attr('class', 'ctrTop').attr('text-anchor', 'middle').attr('dy', '0.05em').text(formatCompactINR(o.center ?? total));
  g.append('text').attr('class', 'ctrBot').attr('text-anchor', 'middle').attr('dy', '1.75em').text(o.centerLabel || 'gross cost');

  const min = o.labelMin ?? 0.03, sides = { 1: [], '-1': [] };
  arcs.forEach(d => {
    const f = d.data.value / total; if (f < min) return;
    const m = (d.startAngle + d.endAngle) / 2, side = m < Math.PI ? 1 : -1;
    sides[side].push({ d, m, side, y: -Math.cos(m) * (R + 16) });
  });
  Object.values(sides).forEach(list => {
    list.sort((a, b) => a.y - b.y);
    for (let i = 1; i < list.length; i++) if (list[i].y < list[i-1].y + 15) list[i].y = list[i-1].y + 15;
  });
  const lab = g.append('g');
  Object.values(sides).flat().forEach(({d, m, side, y}) => {
    const p1 = [Math.sin(m)*(R+2), -Math.cos(m)*(R+2)];
    const p2 = [Math.sin(m)*(R+11), y];
    const p3 = [p2[0] + side*10, y];
    lab.append('polyline').attr('class', 'leader').attr('points', [p1, p2, p3].map(p => p.join(',')).join(' '));
    const t = lab.append('text').attr('class', 'lab')
      .attr('x', p3[0] + side*4).attr('y', y).attr('dy', '0.32em')
      .attr('text-anchor', side === 1 ? 'start' : 'end');
    if (!o.pctOnly) t.append('tspan').text(d.data.label + ' ');
    t.append('tspan').attr('class', 'pct').text(pct(d.data.value, total));
  });
}

function nested(el, inner, o) {
  const W = 640, H = 380, cx = W/2, cy = H/2;
  const r0 = 58, r1 = 98, r2 = 102, r3 = 150;
  const root = d3.select(el);
  root.selectAll('svg').remove();
  root.selectAll('.nochart').remove();
  inner = inner.filter(d => d.value > 0);
  const total = d3.sum(inner, d => d.value);
  if (!inner.length || total <= 0) {
    root.insert('div', '.legend').attr('class', 'nochart')
      .text('Pie not drawn — no positive costs here. A pie chart cannot show negative values; the credits are listed in the table view.');
    return;
  }
  const svg = root.insert('svg', '.legend').attr('viewBox', `0 0 ${W} ${H}`)
    .attr('role', 'img').attr('aria-label', o.aria || o.title);
  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

  const innerArcs = d3.pie().sort(null).value(d => d.value)(inner);
  const arcIn  = d3.arc().innerRadius(r0).outerRadius(r1).cornerRadius(2);
  const arcOut = d3.arc().innerRadius(r2).outerRadius(r3).cornerRadius(2);

  const outerArcs = [];
  innerArcs.forEach(p => {
    const span = p.endAngle - p.startAngle, pt = d3.sum(p.data.children, c => c.value);
    let a = p.startAngle;
    p.data.children.forEach(c => {
      if (c.value <= 0) return;
      const e = a + span * c.value / pt;
      outerArcs.push({ startAngle: a, endAngle: e, data: c, parent: p.data });
      a = e;
    });
  });

  const allPaths = g.append('g');
  const pIn = allPaths.selectAll('.in').data(innerArcs).join('path')
    .attr('class', 'slice in').attr('tabindex', 0)
    .attr('d', arcIn).attr('fill', d => d.data.color)
    .attr('stroke', 'none')
    .attr('aria-label', d => `${d.data.label}: ${formatINR(d.data.value)}, ${pct(d.data.value, total)} of gross`);
  const pOut = allPaths.selectAll('.out').data(outerArcs).join('path')
    .attr('class', 'slice out').attr('tabindex', 0)
    .attr('d', arcOut).attr('fill', d => d.data.color)
    .attr('stroke', 'none')
    .attr('aria-label', d => `${d.parent.label} — ${d.data.label}: ${formatINR(d.data.value)}`);

  const both = allPaths.selectAll('path');
  function hl(target) { both.attr('opacity', 0.35); d3.select(target).attr('opacity', null); }
  pIn.on('mouseenter.hl', function() { hl(this); }).on('mouseleave.hl', () => both.attr('opacity', null));
  pOut.on('mouseenter.hl', function() { hl(this); }).on('mouseleave.hl', () => both.attr('opacity', null));
  
  bindTip(pIn, d => ttRow(d.data.color, d.data.label, d.data.value, [`${pct(d.data.value, total)} of gross cost`]));
  bindTip(pOut, d => ttRow(d.data.color, `${d.parent.label} — ${d.data.label}`, d.data.value,
    [`${pct(d.data.value, d.parent.value)} of ${d.parent.short || d.parent.label}`, `${pct(d.data.value, total)} of gross cost`]));

  g.append('text').attr('class', 'ctrTop').attr('text-anchor', 'middle').attr('dy', '0.05em').text(formatCompactINR(total));
  g.append('text').attr('class', 'ctrBot').attr('text-anchor', 'middle').attr('dy', '1.75em').text('gross cost');

  innerArcs.forEach(d => {
    const span = d.endAngle - d.startAngle; if (span < 0.5) return;
    const [x, y] = arcIn.centroid(d);
    const fill = inkOn(d.data.color);
    const t = g.append('text').attr('text-anchor', 'middle').attr('x', x).attr('y', y);
    if (span > 0.85) {
      t.append('tspan').attr('class', 'inLab').attr('x', x).attr('dy', '-0.25em').attr('fill', fill).text(d.data.short || d.data.label);
      t.append('tspan').attr('class', 'inLab2').attr('x', x).attr('dy', '1.25em').attr('fill', fill).text(pct(d.data.value, total));
    } else {
      t.append('tspan').attr('class', 'inLab2').attr('x', x).attr('dy', '0.35em').attr('fill', fill).text(pct(d.data.value, total));
    }
  });

  const sides = { 1: [], '-1': [] };
  outerArcs.forEach(d => {
    if (d.data.value / total < 0.055) return;
    const m = (d.startAngle + d.endAngle) / 2, side = m < Math.PI ? 1 : -1;
    sides[side].push({ d, m, side, y: -Math.cos(m) * (r3 + 14) });
  });
  Object.values(sides).forEach(list => {
    list.sort((a, b) => a.y - b.y);
    for (let i = 1; i < list.length; i++) if (list[i].y < list[i-1].y + 15) list[i].y = list[i-1].y + 15;
  });
  Object.values(sides).flat().forEach(({d, m, side, y}) => {
    const p1 = [Math.sin(m)*(r3+2), -Math.cos(m)*(r3+2)];
    const p2 = [Math.sin(m)*(r3+9), y];
    const p3 = [p2[0] + side*8, y];
    g.append('polyline').attr('class', 'leader').attr('points', [p1, p2, p3].map(p => p.join(',')).join(' '));
    const t = g.append('text').attr('class', 'lab')
      .attr('x', p3[0] + side*4).attr('y', y).attr('dy', '0.32em')
      .attr('text-anchor', side === 1 ? 'start' : 'end');
    t.append('tspan').text(d.data.label + ' ');
    t.append('tspan').attr('class', 'pct').text(pct(d.data.value, total));
  });
}

window.toggleLCCAMode = function (isLCCA) {
  const rp = document.getElementById("right-panel");
  const hudTriggers = document.getElementById("hud-triggers");
  const canvas = state.viewportContainer?.querySelector("canvas");
  
  if (isLCCA) {
    if (rp) rp.classList.add("lcca-active");
    if (hudTriggers) hudTriggers.style.display = "none";
    if (canvas) canvas.style.display = "none";
  } else {
    if (rp) rp.classList.remove("lcca-active");
    if (hudTriggers) hudTriggers.style.display = "flex";
    if (canvas) canvas.style.display = "block";
    
    // Trigger window resize so Three.js canvas size updates correctly
    window.dispatchEvent(new Event('resize'));
  }
};

export function renderLCCAData(lccaData) {
  const container = document.getElementById("lcca-container");
  if (!container) return;
  container.innerHTML = "";

  const RAW = lccaData.results || {};
  const META = lccaData.export_meta || {};

  const hasRecon = LCCA_PILLARS.some(p => RAW.reconstruction && RAW.reconstruction[p.id]);

  const STAGES = [
    { id: 'initial', label: 'Initial stage', short: 'Initial', color: '#64748b', cvar: '--st1', parts: [{ id: 'initial_stage', src: RAW.initial_stage || {}, tag: '' }] },
    { id: 'use',     label: 'Use stage',     short: 'Use', color: '#00C49A', cvar: '--st2', parts: [{ id: 'use_stage', src: RAW.use_stage || {}, tag: '' }] },
    { id: 'eol',     label: 'End of life',   short: 'End of life', color: '#EA9E9E', cvar: '--st3',
      parts: [
        ...(hasRecon ? [{ id: 'reconstruction', src: RAW.reconstruction, tag: ' (reconstruction)' }] : []),
        { id: 'end_of_life', src: RAW.end_of_life || {}, tag: hasRecon ? ' (final)' : '' }
      ]
    }
  ];

  // Flatten nested details to component items
  const components = [];
  STAGES.forEach(st => st.parts.forEach(part => LCCA_PILLARS.forEach(pl => {
    const grp = part.src[pl.id] || {};
    for (const [k, v] of Object.entries(grp)) {
      const scrap = /scrap/.test(k);
      const costEffect = scrap ? -v : v;
      const lookupKey = `${part.id}|${pl.id}|${k}`;
      const label = MASTER_LABELS[lookupKey] || ((LCCA_NAMES[k] || k) + part.tag);
      components.push({
        stage: st.id, pillar: pl.id, key: k,
        label, costEffect, isCredit: costEffect < 0
      });
    }
  })));

  const sumBy = f => components.filter(f).reduce((a, c) => a + c.costEffect, 0);
  const gross  = sumBy(c => !c.isCredit);
  const credit = sumBy(c => c.isCredit);
  const net    = gross + credit;

  const stageGross  = Object.fromEntries(STAGES.map(s => [s.id, sumBy(c => c.stage === s.id && !c.isCredit)]));
  const stageCredit = Object.fromEntries(STAGES.map(s => [s.id, sumBy(c => c.stage === s.id && c.isCredit)]));

  const cell = (s, p) => sumBy(c => c.stage === s && c.pillar === p && !c.isCredit);
  const pillarGross = Object.fromEntries(LCCA_PILLARS.map(p => [p.id, sumBy(c => c.pillar === p.id && !c.isCredit)]));
  const pillarCredit = Object.fromEntries(LCCA_PILLARS.map(p => [p.id, sumBy(c => c.pillar === p.id && c.isCredit)]));

  // Retrieve current color stylesheet values
  const stCol = Object.fromEntries(STAGES.map(s => [s.id, cv(s.cvar)]));
  const plCol = Object.fromEntries(LCCA_PILLARS.map(p => [p.id, cv(p.cvar)]));
  const compCols = ['--c1','--c2','--c3','--c4','--c5'].map(cv);
  const otherCol = cv('--other');

  const cellNet = (s, p) => sumBy(c => c.stage === s && c.pillar === p);

  // Matrix table HTML
  let matrixTableBody = `
    <tbody>
      <tr>
        <td class="matrix-lbl-initial">Initial Stage</td>
        <td class="val-cell">${formatINR(cellNet('initial', 'economic'))}</td>
        <td class="val-cell">${formatINR(cellNet('initial', 'environmental'))}</td>
        <td class="val-cell">${formatINR(cellNet('initial', 'social'))}</td>
        <td class="row-total">${formatINR(stageGross['initial'] + stageCredit['initial'])}</td>
      </tr>
      <tr>
        <td class="matrix-lbl-use">Use Stage</td>
        <td class="val-cell">${formatINR(cellNet('use', 'economic'))}</td>
        <td class="val-cell">${formatINR(cellNet('use', 'environmental'))}</td>
        <td class="val-cell">${formatINR(cellNet('use', 'social'))}</td>
        <td class="row-total">${formatINR(stageGross['use'] + stageCredit['use'])}</td>
      </tr>
      <tr>
        <td class="matrix-lbl-eol">End-of-Life Stage</td>
        <td class="val-cell">${formatINR(cellNet('eol', 'economic'))}</td>
        <td class="val-cell">${formatINR(cellNet('eol', 'environmental'))}</td>
        <td class="val-cell">${formatINR(cellNet('eol', 'social'))}</td>
        <td class="row-total">${formatINR(stageGross['eol'] + stageCredit['eol'])}</td>
      </tr>
      <tr class="grand-total">
        <td style="text-align: left; font-weight: 600;">Total</td>
        <td>${formatINR(pillarGross['economic'] + pillarCredit['economic'])}</td>
        <td>${formatINR(pillarGross['environmental'] + pillarCredit['environmental'])}</td>
        <td>${formatINR(pillarGross['social'] + pillarCredit['social'])}</td>
        <td style="font-weight: 600;">${formatINR(net)}</td>
      </tr>
    </tbody>
  `;

  // Detailed Cost table HTML
  let detailedTableBody = '';
  const maxVal = d3.max(components, c => Math.abs(c.costEffect)) || 1;

  STAGES.forEach(s => {
    const stageComponents = components.filter(c => c.stage === s.id);
    if (stageComponents.length === 0) return;

    stageComponents.forEach((c, idx) => {
      const isFirst = (idx === 0);
      const rowspanHtml = isFirst
        ? `<td rowspan="${stageComponents.length}" class="stage-rowspan-cell stage-rowspan-${s.id}"><div class="stage-rowspan-text">${s.short} Stage Costs</div></td>`
        : '';

      const pillar = LCCA_PILLARS.find(p => p.id === c.pillar) || LCCA_PILLARS[0];
      const colVar = pillar.cvar;
      const bgClass = `matrix-col-${c.pillar === 'economic' ? 'eco' : c.pillar === 'environmental' ? 'env' : 'soc'}`;

      // Calculate unidirectional bar chart styles with a 10% safety margin on the right
      const valPct = (Math.abs(c.costEffect) / maxVal) * 100;
      const barStyle = `left: 0; width: ${valPct * 0.9}%; background-color: var(${colVar}); border-radius: 0 2px 2px 0;`;

      detailedTableBody += `
        <tr class="${bgClass}">
          ${rowspanHtml}
          <td style="font-weight: 500; text-align: left;">${c.label}</td>
          <td class="num font-monospace" style="font-weight: 600;">${formatINR(c.costEffect)}</td>
          <td style="position: relative; height: 32px; padding: 0 8px; vertical-align: middle;">
            <!-- Value bar -->
            <div style="position: absolute; top: 6px; bottom: 6px; left: 0; z-index: 2; transition: width 0.3s ease; ${barStyle}"></div>
          </td>
        </tr>
      `;
    });
  });

  // Render everything inside lcca-container
  container.innerHTML = `
    <!-- Charts Row 1: Gross Stage & Pillar splits -->
    <h4 style="font-family:'Outfit'; font-weight:600; color:var(--text-title); margin-bottom:12px; font-size:16px; letter-spacing:0.5px; text-transform:uppercase;">Cost Distribution Overview</h4>
    <div class="lcca-dash-grid2">
      <div class="lcca-dash-card" id="dash-chStage"></div>
      <div class="lcca-dash-card" id="dash-chPillar"></div>
    </div>

    <!-- Charts Row 2: Nested Splits -->
    <h4 style="font-family:'Outfit'; font-weight:600; color:var(--text-title); margin-bottom:12px; font-size:16px; letter-spacing:0.5px; text-transform:uppercase;">Cross-Sectional Relations</h4>
    <div class="lcca-dash-grid2">
      <div class="lcca-dash-card" id="dash-chNestSP"></div>
      <div class="lcca-dash-card" id="dash-chNestPS"></div>
    </div>

    <!-- Charts Row 3: Inside Stages -->
    <h4 style="font-family:'Outfit'; font-weight:600; color:var(--text-title); margin-bottom:12px; font-size:16px; letter-spacing:0.5px; text-transform:uppercase;">Stage Component Breakdowns</h4>
    <div class="lcca-dash-grid3" id="dash-chComps"></div>

    <!-- Summary Tables -->
    <h4 style="font-family:'Outfit'; font-weight:600; color:var(--text-title); margin-bottom:12px; font-size:16px; letter-spacing:0.5px; text-transform:uppercase;">Tabular Reports</h4>
    <div class="lcca-dash-card mb-4" style="overflow-x: auto;">
      <h3 style="font-size:15px; margin-bottom:4px;">Consolidated stage summary</h3>
      <p class="sub" style="margin-bottom: 16px;">A consolidated presentation of costs across the three pillars (economic, social, and environmental) for each lifecycle stage. This table facilitates the identification of phases that bear the most substantial burden.</p>
      <table class="matrix-table-lcca">
        <thead>
          <tr>
            <th style="width: 150px; text-align: left;">Stage</th>
            <th class="matrix-hdr-eco">Economic<br><span style="font-size: 10px; font-weight: normal; opacity: 0.85;">(INR)</span></th>
            <th class="matrix-hdr-env">Environmental<br><span style="font-size: 10px; font-weight: normal; opacity: 0.85;">(INR)</span></th>
            <th class="matrix-hdr-soc">Social<br><span style="font-size: 10px; font-weight: normal; opacity: 0.85;">(INR)</span></th>
            <th style="text-align: right; width: 150px;">Stage Total<br><span style="font-size: 10px; font-weight: normal; opacity: 0.85;">(INR)</span></th>
          </tr>
        </thead>
        ${matrixTableBody}
      </table>
    </div>

    <div class="lcca-dash-card" style="overflow-x: auto;">
      <h3 style="font-size:15px; margin-bottom:4px;">Detailed Component Cost Ledger</h3>
      <p class="sub" style="margin-bottom: 12px;">Fully itemized ledger of cost components compiled from the analysis model results</p>
      
      <!-- Color legend for the pillars -->
      <div class="d-flex gap-3 mb-3 px-1" style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
        <span class="d-flex align-items-center"><span class="lcca-dot me-2" style="background-color: var(--pl1); width: 10px; height: 10px; border-radius: 2px;"></span>Economic</span>
        <span class="d-flex align-items-center"><span class="lcca-dot me-2" style="background-color: var(--pl2); width: 10px; height: 10px; border-radius: 2px;"></span>Environmental</span>
        <span class="d-flex align-items-center"><span class="lcca-dot me-2" style="background-color: var(--pl3); width: 10px; height: 10px; border-radius: 2px;"></span>Social</span>
      </div>

      <table class="lcca-table">
        <thead>
          <tr>
            <th style="width: 85px; text-align: center;">Stage</th>
            <th>Cost Item</th>
            <th class="num" style="width: 160px; text-align: right;">Value (INR)</th>
            <th style="width: 250px; text-align: center;">Visual Representation</th>
          </tr>
        </thead>
        <tbody>
          ${detailedTableBody}
        </tbody>
      </table>
    </div>
  `;

  // Draw D3 Charts dynamically!
  try {
    // 1. Chart Stage Gross
    renderDashCard('dash-chStage', 'Gross Cost by Life-Cycle Stage',
      'Initial · Use · End of Life stages',
      [{ items: STAGES.map(s => ({ label: s.label, color: stCol[s.id] || s.color })) }]);
    donut('#dash-chStage', STAGES.map(s => ({
      label: s.short, value: stageGross[s.id], color: stCol[s.id] || s.color,
      tip: stageCredit[s.id] ? [`scrap credit ${formatCompactINR(stageCredit[s.id])} → net ${formatCompactINR(stageGross[s.id] + stageCredit[s.id])}`] : []
    })), { title: 'Gross cost by stage', ofLabel: 'gross cost' });

    // 2. Chart Pillar Gross
    renderDashCard('dash-chPillar', 'Gross Cost by Sustainability Pillar', 'Economic · Environmental · Social splits',
      [{ items: LCCA_PILLARS.map(p => ({ label: p.label, color: plCol[p.id] || p.color })) }]);
    donut('#dash-chPillar', LCCA_PILLARS.map(p => ({ label: p.label, value: pillarGross[p.id], color: plCol[p.id] || p.color })),
      { title: 'Gross cost by pillar', ofLabel: 'gross cost' });

    // 3. Chart Nested Stage x Pillar
    renderDashCard('dash-chNestSP', 'Life-Cycle Stage × Pillar Breakdown', 'Inner ring: Stage · Outer ring: Pillar split',
      [{ name: 'Stage', items: STAGES.map(s => ({ label: s.short, color: stCol[s.id] || s.color })) },
       { name: 'Pillar', items: LCCA_PILLARS.map(p => ({ label: p.label, color: plCol[p.id] || p.color })) }]);
    nested('#dash-chNestSP', STAGES.map(s => ({
      label: s.label, short: s.short, value: stageGross[s.id], color: stCol[s.id] || s.color,
      children: LCCA_PILLARS.map(p => ({ label: p.label, value: cell(s.id, p.id), color: plCol[p.id] || p.color }))
    })), { title: 'Stage by pillar double pie' });

    // 4. Chart Nested Pillar x Stage
    renderDashCard('dash-chNestPS', 'Sustainability Pillar × Stage Breakdown', 'Inner ring: Pillar · Outer ring: Stage split',
      [{ name: 'Pillar', items: LCCA_PILLARS.map(p => ({ label: p.label, color: plCol[p.id] || p.color })) },
       { name: 'Stage', items: STAGES.map(s => ({ label: s.short, color: stCol[s.id] || s.color })) }]);
    nested('#dash-chNestPS', LCCA_PILLARS.map(p => ({
      label: p.label, short: p.label, value: pillarGross[p.id], color: plCol[p.id] || p.color,
      children: STAGES.map(s => ({ label: s.short, value: cell(s.id, p.id), color: stCol[s.id] || s.color }))
    })), { title: 'Pillar by stage double pie' });

    // 5. Stage Component Breakdowns (Card + Donut for each stage)
    const dashChComps = document.getElementById('dash-chComps');
    STAGES.forEach(s => {
      const costs = components.filter(c => c.stage === s.id && !c.isCredit)
        .slice().sort((a, b) => b.costEffect - a.costEffect);
      const top = costs.slice(0, 5), rest = costs.slice(5);
      
      const data = top.map((c, i) => {
        let col = compCols[i] || '#607d8b';
        const lbl = c.label.toLowerCase();
        if (lbl.includes('steel')) col = cv('--steel_color') || '#6E0902';
        else if (lbl.includes('concrete')) col = cv('--concrete_color') || '#4B4B4B';
        return { label: c.label, value: c.costEffect, color: col };
      });
      
      if (rest.length) {
        data.push({
          label: `Other (${rest.length})`, value: d3.sum(rest, c => c.costEffect), color: otherCol || '#64748b',
          tip: rest.map(c => `${c.label}: ${formatCompactINR(c.costEffect)}`)
        });
      }
      
      const credits = components.filter(c => c.stage === s.id && c.isCredit);
      const foot = credits.length
        ? `Credit: ${credits.map(c => `${c.label} <b class="credit">${formatCompactINR(c.costEffect)}</b>`).join(' · ')} → net ${formatCompactINR(stageGross[s.id] + stageCredit[s.id])}`
        : '';
        
      const div = document.createElement('div');
      div.className = 'lcca-dash-card'; div.id = 'dash-comp_' + s.id;
      dashChComps.appendChild(div);
      
      renderDashCard('dash-comp_' + s.id, s.label, `${pct(stageGross[s.id], gross)} of gross cost`,
        [{ items: data.map(d => ({ label: d.label, color: d.color })) }], foot);
        
      donut('#dash-comp_' + s.id, data, { title: s.label + ' components', ofLabel: s.short, R: 96, W: 460, H: 290, labelMin: 0.055, pctOnly: true });
    });

  } catch (err) {
    console.error("Failed to render D3 charts:", err);
  }
}

export async function loadAndRenderLCCA() {
  const container = document.getElementById("lcca-container");
  if (!container) return;
  
  container.innerHTML = `
    <div class="d-flex justify-content-center align-items-center p-4">
      <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
      <span style="font-size: 12px; color: var(--text-muted);">Loading LCCA Data...</span>
    </div>
  `;

  // Determine path to LCCA results:
  // Look for test.lcca in the root folder by default
  const lccaPath = state.currentLoadedBridge?.lcca || "./test.lcca";
  
  try {
    const response = await fetch(lccaPath);
    if (!response.ok) throw new Error("Failed to load LCCA data");
    const lccaData = await response.json();
    renderLCCAData(lccaData);
  } catch (err) {
    console.error("Failed to load LCCA data:", err);
    container.innerHTML = `
      <div class="alert alert-danger m-3" role="alert" style="font-size: 12px; padding: 8px 12px;">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        Failed to load LCCA data: ${err.message}
      </div>
    `;
  }
}

window.toggleLCCADashboardHUD = function () {
  const isCurrentlyLCCA = (state.activeSidebarTab === 'lcca');
  if (isCurrentlyLCCA) {
    // Switch back to groups (3D viewer)
    window.switchRightTab('groups');
  } else {
    // Open the Right panel if collapsed
    const rp = document.getElementById("right-panel");
    if (rp && rp.classList.contains("collapsed")) {
      window.toggleRightPanel();
    }
    // Switch to LCCA tab
    window.switchRightTab('lcca');
  }
};
