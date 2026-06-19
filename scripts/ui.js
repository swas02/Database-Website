import * as THREE from "three";
import { state } from "./state.js";
import { COLOR } from "./constants.js";

// Tab Navigation Explorer
window.switchRightTab = function (tab) {
  state.activeSidebarTab = tab;
  document
    .getElementById("tab-groups")
    .classList.toggle("active", tab === "groups");
  document
    .getElementById("tab-meta")
    .classList.toggle("active", tab === "meta");
  document.getElementById("content-groups").style.display =
    tab === "groups" ? "block" : "none";
  document.getElementById("content-meta").style.display =
    tab === "meta" ? "block" : "none";
};

window.toggleRightPanel = function () {
  const p = document.getElementById("right-panel");
  const t = document.getElementById("right-trigger");
  const col = p.classList.toggle("collapsed");
  t.style.display = col ? "block" : "none";
};

window.toggleLeftPanel = function () {
  const p = document.getElementById("left-panel");
  const t = document.getElementById("left-trigger");
  const col = p.classList.toggle("collapsed");
  t.style.display = col ? "block" : "none";
};

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
      overlay.style.background = "rgba(5, 8, 12, 0.9)";
      overlay.style.display = "flex";
      overlay.style.flexDirection = "column";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.zIndex = "999";
      overlay.innerHTML = `
        <div class="spinner-border text-success mb-3" style="width: 3rem; height: 3rem; color: #a8c520 !important;"></div>
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
}

export function renderGroupsPanel(list) {
  const container = document.getElementById("groups-container");
  container.innerHTML = "";

  list.forEach((g) => {
    const colorHex =
      "#" +
      new THREE.Color(
        COLOR[g.name.toUpperCase().split("_")[0]] || 0x607d8b,
      ).getHexString();
    const count = state.groupIndex.get(g.name)?.size || 0;

    const div = document.createElement("div");
    div.className = "group-item";
    div.setAttribute("data-group", g.name);
    div.setAttribute("onclick", `selectGroup('${g.name}')`);
    div.innerHTML = `
      <div class="group-info">
        <span class="group-dot" style="color: ${colorHex}; background-color: ${colorHex}"></span>
        <span class="group-name">${g.name.replace(/_/g, " ")}</span>
        <span class="group-count">${count}</span>
      </div>
      <div class="group-controls" onclick="event.stopPropagation()">
        <div class="color-picker-wrapper" style="background-color: ${colorHex}">
          <input type="color" class="color-picker-input" value="${colorHex}" onchange="changeGroupColor('${g.name}', this.value)">
        </div>
        <button class="vis-toggle" onclick="toggleGroupVisibility('${g.name}', this); event.stopPropagation();"><i class="bi bi-eye-fill"></i></button>
      </div>
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

export function updatePropertyInspector(group) {
  const panel = document.getElementById("left-panel");
  panel.classList.remove("collapsed");
  const trigger = document.getElementById("left-trigger");
  if (trigger) trigger.style.display = "none";

  const content = document.getElementById("inspector-grid-content");
  content.innerHTML = "";

  if (!group && state.bridgeData) {
    content.innerHTML = `
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
  } else if (group && group.name === "deck_slab" && state.bridgeData.deck_slab) {
    content.innerHTML = `
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
    group.name === "cross_bracing" &&
    state.bridgeData.cross_bracing
  ) {
    content.innerHTML = `
      <div class="metric-card mb-0" style="min-width: 250px;">
        <span class="metric-header">Cross Bracing Specifications</span>
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
    group.name === "girder_sections" &&
    state.bridgeData.girder_sections
  ) {
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

    content.innerHTML = `
      <div class="metric-card mb-0" style="display: flex; flex-direction: column; width: 100%;">
        <span class="metric-header" style="margin-bottom: 12px;">Girder Longitudinal Segmentation Specs</span>
        
        <!-- Visual Segment Bar -->
        <div style="display: flex; height: 28px; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.15); margin-bottom: 12px;">
          ${barHtml}
        </div>
        
        <!-- Vertically Stacked Specifications -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${cardsHtml}
        </div>
      </div>
      
      <!-- Girder Spacing -->
      <div class="metric-card mb-0" style="width: 100%; display: flex; flex-direction: row; justify-content: space-between; align-items: center; padding: 10px 14px;">
        <span class="metric-header" style="margin-bottom: 0;">Girder Spacing</span>
        <span class="metric-value font-monospace" style="font-size: 16px; color: #a8c520;">${state.bridgeData.grid_spacing_m || state.bridgeData.girder_spacing_m || "2.875"} m</span>
      </div>
    `;
  } else if (
    group &&
    group.name.includes("stiffeners") &&
    state.bridgeData[group.name]
  ) {
    const s = state.bridgeData[group.name];
    content.innerHTML = `
      <div class="metric-card mb-0" style="min-width: 250px;">
        <span class="metric-header">${group.name.replace(/_/g, " ")} Specs</span>
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
