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
    .getElementById("tab-downloads")
    .classList.toggle("active", tab === "downloads");
    
  document.getElementById("content-groups").style.display =
    tab === "groups" ? "block" : "none";
  document.getElementById("content-meta").style.display =
    tab === "meta" ? "block" : "none";
  document.getElementById("content-downloads").style.display =
    tab === "downloads" ? "block" : "none";
};

window.toggleRightPanel = function () {
  const p = document.getElementById("right-panel");
  const t = document.getElementById("right-trigger");
  if (!p) return;
  const col = p.classList.toggle("collapsed");
  if (t) t.style.display = col ? "block" : "none";
  
  // On mobile (<= 768px), if we open the right panel, collapse the left panel
  if (!col && window.innerWidth <= 768) {
    const lp = document.getElementById("left-panel");
    const lt = document.getElementById("left-trigger");
    if (lp && !lp.classList.contains("collapsed")) {
      lp.classList.add("collapsed");
      if (lt) lt.style.display = "block";
    }
  }
};

window.toggleLeftPanel = function () {
  const p = document.getElementById("left-panel");
  const t = document.getElementById("left-trigger");
  if (!p) return;
  const col = p.classList.toggle("collapsed");
  if (t) t.style.display = col ? "block" : "none";
  
  // On mobile (<= 768px), if we open the left panel, collapse the right panel
  if (!col && window.innerWidth <= 768) {
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

  if (window.innerWidth > 768) {
    // Desktop: both panels open, triggers hidden
    if (lp) lp.classList.remove("collapsed");
    if (lt) lt.style.display = "none";
    if (rp) rp.classList.remove("collapsed");
    if (rt) rt.style.display = "none";
  } else {
    // Mobile: Left Panel (Library) open, Right Panel (Explorer) collapsed
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
    { k: "Pier Diameter", v: data.substructure?.pier?.diameter_m + " m" },
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
    
    // On mobile (<= 768px), if we open the right panel, collapse the left panel
    if (wasCollapsed && window.innerWidth <= 768) {
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
    const bridgeIdFromPath = item.ifc.split("/").pop().replace(".ifc", "");
    
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

  const jsonPath = ifcPath ? ifcPath.replace(".ifc", ".json") : null;

  container.innerHTML = `
    <!-- PDF Design Report card -->
    <div class="metric-card mb-0">
      <span class="metric-header">Design Documentation</span>
      <div class="d-flex align-items-center justify-content-between py-2 border-bottom border-secondary border-opacity-25">
        <div>
          <div class="text-white fw-bold font-monospace" style="font-size: 11px;">${bridgeId}_design_report.pdf</div>
          <div class="text-muted" style="font-size: 9px;">PDF Document • ~4.5 MB</div>
        </div>
        <button class="btn btn-sm btn-outline-secondary" onclick="alert('PDF Design Report not generated yet for this bridge configuration.')" style="font-size: 10px; padding: 4px 8px;"><i class="bi bi-download"></i></button>
      </div>
    </div>

    <!-- MCB Analysis model card -->
    <div class="metric-card mb-0">
      <span class="metric-header">Analysis Model</span>
      <div class="d-flex align-items-center justify-content-between py-2 border-bottom border-secondary border-opacity-25">
        <div>
          <div class="text-white fw-bold font-monospace" style="font-size: 11px;">${bridgeId}_model.mcb</div>
          <div class="text-muted" style="font-size: 9px;">Midas Civil File • ~1.2 MB</div>
        </div>
        <button class="btn btn-sm btn-outline-secondary" onclick="alert('Midas Civil MCB analysis model not generated yet for this bridge configuration.')" style="font-size: 10px; padding: 4px 8px;"><i class="bi bi-download"></i></button>
      </div>
    </div>

    <!-- Real IFC File Download -->
    <div class="metric-card mb-0">
      <span class="metric-header">3D CAD Model</span>
      <div class="d-flex align-items-center justify-content-between py-2 border-bottom border-secondary border-opacity-25">
        <div>
          <div class="text-white fw-bold font-monospace" style="font-size: 11px;">${ifcPath ? ifcPath.split("/").pop() : "model.ifc"}</div>
          <div class="text-muted" style="font-size: 9px;">IFC Model File • Source</div>
        </div>
        ${ifcPath ? `
          <a href="${ifcPath}" download class="btn btn-sm btn-outline-primary" style="font-size: 10px; padding: 4px 8px; color: #3b82f6; border-color: rgba(59, 130, 246, 0.4);"><i class="bi bi-download"></i> Download</a>
        ` : `
          <button class="btn btn-sm btn-outline-secondary" disabled style="font-size: 10px; padding: 4px 8px;"><i class="bi bi-download"></i></button>
        `}
      </div>
    </div>

    <!-- Real JSON Schema Download -->
    <div class="metric-card mb-0">
      <span class="metric-header">Structural Schema Data</span>
      <div class="d-flex align-items-center justify-content-between py-2 border-bottom border-secondary border-opacity-25">
        <div>
          <div class="text-white fw-bold font-monospace" style="font-size: 11px;">${jsonPath ? jsonPath.split("/").pop() : "schema.json"}</div>
          <div class="text-muted" style="font-size: 9px;">JSON Data File</div>
        </div>
        ${jsonPath ? `
          <a href="${jsonPath}" download class="btn btn-sm btn-outline-primary" style="font-size: 10px; padding: 4px 8px; color: #3b82f6; border-color: rgba(59, 130, 246, 0.4);"><i class="bi bi-download"></i> Download</a>
        ` : `
          <button class="btn btn-sm btn-outline-secondary" disabled style="font-size: 10px; padding: 4px 8px;"><i class="bi bi-download"></i></button>
        `}
      </div>
    </div>
  `;
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

