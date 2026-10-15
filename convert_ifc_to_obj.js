/**
 * convert_ifc_to_obj.js
 * Node.js CLI script to convert IFC files in the database to OBJ files,
 * using the metadata inside their corresponding groups.json files to
 * group the 3D meshes by their structural groups (e.g. deck_slab, girder_sections).
 */

const fs = require("fs");
const path = require("path");
const WebIFC = require("web-ifc");
const { buildDeckFurniture, GROUPS: FURNITURE_GROUPS } = require("./barrier_geometry");

// Constants
const BASE_DIR = __dirname;
const REGISTRY_FILE = path.join(BASE_DIR, "registry_flat.json");

function applyMatrix(v, m) {
  const x = v[0], y = v[1], z = v[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w
  ];
}

/**
 * Adds the deck furniture to the vertex list / group faces and registers it in
 * groupsData. Does nothing when the model has no deck slab geometry.
 * Returns true when something was injected.
 */
function injectDeckFurniture(allVertices, groupFaces, groupsData, entry) {
  const injectedNames = new Set(Object.values(FURNITURE_GROUPS).map((g) => g.name));
  // Drop leftovers from a previous run so re-converting is idempotent.
  if (groupsData && groupsData.groups) {
    groupsData.groups = groupsData.groups.filter((g) => !injectedNames.has(g.name));
  }

  // Bounding box of the deck slab groups
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const name in groupFaces) {
    if (!/slab/i.test(name)) continue;
    for (const f of groupFaces[name]) {
      for (const idx of f) {
        const v = allVertices[idx - 1];
        for (let a = 0; a < 3; a++) {
          if (v[a] < min[a]) min[a] = v[a];
          if (v[a] > max[a]) max[a] = v[a];
        }
      }
    }
  }
  if (!isFinite(min[0]) || !groupsData || !groupsData.groups) {
    console.warn("  No deck slab geometry: skipping barrier injection.");
    return false;
  }

  const built = buildDeckFurniture(
    { min, max },
    {
      hasFootpath: entry.footpath === "OF",
      lanes: parseInt(entry.lanes, 10) || 1,
    },
  );

  for (const key in built) {
    const g = built[key];
    const base = allVertices.length;
    g.verts.forEach((v) => allVertices.push(v));
    groupFaces[g.name] = g.tris.map(([a, b, c]) => [a + base + 1, b + base + 1, c + base + 1]);
    groupsData.groups.push({
      name: g.name,
      partIDs: [g.partID],
      visible: true,
      meta: { length: "", color: "", custom: [] },
    });
  }
  console.log(`  Injected: ${Object.values(built).map((g) => g.name).join(", ")}`);
  return true;
}

async function convertModel(ifcPath, jsonPath, objPath, entry = {}) {
  console.log(`Processing: ${path.relative(BASE_DIR, ifcPath)}`);
  
  // 1. Initialize web-ifc API
  const ifcApi = new WebIFC.IfcAPI();
  await ifcApi.Init();

  try {
    // 2. Read input files
    const ifcData = fs.readFileSync(ifcPath);
    let groupsStr = fs.readFileSync(jsonPath, "utf-8");
    if (groupsStr.charCodeAt(0) === 0xFEFF) {
      groupsStr = groupsStr.substring(1);
    }
    const groupsData = JSON.parse(groupsStr);

    // 3. Map partIDs to group names
    const partToGroup = {};
    if (groupsData && groupsData.groups) {
      groupsData.groups.forEach((g) => {
        if (g.partIDs) {
          g.partIDs.forEach((pid) => {
            partToGroup[pid] = g.name;
          });
        }
      });
    }

    // 4. Open Model
    const modelID = ifcApi.OpenModel(ifcData);
    const allGeometry = ifcApi.LoadAllGeometry(modelID);
    
    const allVertices = [];
    const groupFaces = {}; // groupName -> Array of [idx1, idx2, idx3]

    // Initialize group faces arrays
    if (groupsData && groupsData.groups) {
      groupsData.groups.forEach((g) => {
        groupFaces[g.name] = [];
      });
    }
    groupFaces["unassigned"] = [];

    // 5. Parse Geometry
    for (let i = 0; i < allGeometry.size(); i++) {
      const placed = allGeometry.get(i);
      const expressID = placed.expressID;

      for (let j = 0; j < placed.geometries.size(); j++) {
        const part = placed.geometries.get(j);
        const partID = `${expressID}_${j}`;
        const groupName = partToGroup[partID] || "unassigned";

        const geo = ifcApi.GetGeometry(modelID, part.geometryExpressID);
        const verts = ifcApi.GetVertexArray(geo.GetVertexData(), geo.GetVertexDataSize());
        const inds = ifcApi.GetIndexArray(geo.GetIndexData(), geo.GetIndexDataSize());

        const hasTransform = part.flatTransformation && part.flatTransformation.length === 16;
        const localStart = allVertices.length;

        // Extract and transform vertices
        for (let k = 0; k < verts.length; k += 6) {
          let v = [verts[k], verts[k + 1], verts[k + 2]];
          if (hasTransform) {
            v = applyMatrix(v, part.flatTransformation);
          }
          allVertices.push(v);
        }

        // Add indices (1-indexed for OBJ)
        if (!groupFaces[groupName]) {
          groupFaces[groupName] = [];
        }

        for (let k = 0; k < inds.length; k += 3) {
          const idx1 = inds[k] + localStart + 1;
          const idx2 = inds[k + 1] + localStart + 1;
          const idx3 = inds[k + 2] + localStart + 1;
          groupFaces[groupName].push([idx1, idx2, idx3]);
        }
      }
    }

    // 5a. PSC models carry a duplicate "_delete" slab (stiffness filler) and loose
    // slab fragments; neither is a real member, so keep them out of the OBJ.
    if (entry.bridge_type === "PSC") {
      delete groupFaces["_delete"];
      delete groupFaces["unassigned"];
      if (groupsData && groupsData.groups) {
        groupsData.groups = groupsData.groups.filter((g) => g.name !== "_delete");
        fs.writeFileSync(jsonPath, JSON.stringify(groupsData));
      }
    }

    // 5b. Inject railing, crash barrier, footpath, carriageway and lanes on the deck slab
    const injected = injectDeckFurniture(allVertices, groupFaces, groupsData, entry);

    // 6. Write OBJ file
    console.log(`Writing OBJ file: ${path.relative(BASE_DIR, objPath)} (${allVertices.length} vertices)`);
    const writeStream = fs.createWriteStream(objPath);

    // Header comment
    writeStream.write(`# Generated by Bridge LCCA Converter\n`);
    writeStream.write(`# Source IFC: ${path.basename(ifcPath)}\n\n`);

    // Write all vertices
    for (let i = 0; i < allVertices.length; i++) {
      const v = allVertices[i];
      writeStream.write(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}\n`);
    }
    writeStream.write(`\n`);

    // Write groups and faces
    for (const groupName in groupFaces) {
      const faces = groupFaces[groupName];
      if (faces.length === 0) continue;

      // Group tag
      writeStream.write(`g ${groupName.replace(/\s+/g, "_")}\n`);
      
      for (let i = 0; i < faces.length; i++) {
        const f = faces[i];
        writeStream.write(`f ${f[0]} ${f[1]} ${f[2]}\n`);
      }
      writeStream.write(`\n`);
    }

    writeStream.end();

    // Register the injected groups so the viewer can select them
    if (injected) {
      fs.writeFileSync(jsonPath, JSON.stringify(groupsData));
    }
    
    // Close model
    ifcApi.CloseModel(modelID);
    console.log(`Successfully converted model.`);
    return true;
  } catch (err) {
    console.error(`Failed to convert model:`, err);
    return false;
  }
}

async function main() {
  console.log("=== Starting IFC to OBJ Conversion CLI ===");
  
  if (!fs.existsSync(REGISTRY_FILE)) {
    console.error(`Registry file not found: ${REGISTRY_FILE}`);
    process.exit(1);
  }

  const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8"));
  console.log(`Found ${registry.length} models in registry.`);

  let succeeded = 0;
  let failed = 0;

  // Optional filter: node convert_ifc_to_obj.js <substring of ifc path>
  const filter = process.argv[2];

  for (const entry of registry) {
    if (filter && !entry.ifc.includes(filter)) continue;
    const ifcPath = path.join(BASE_DIR, entry.ifc);
    const jsonPath = path.join(BASE_DIR, entry.json);
    const objPath = ifcPath.replace(/\.ifc$/i, ".obj");

    if (!fs.existsSync(ifcPath)) {
      console.warn(`IFC file not found: ${ifcPath}`);
      failed++;
      continue;
    }

    if (!fs.existsSync(jsonPath)) {
      console.warn(`Groups JSON sidecar not found: ${jsonPath}`);
      failed++;
      continue;
    }

    const success = await convertModel(ifcPath, jsonPath, objPath, entry);
    if (success) {
      succeeded++;
    } else {
      failed++;
    }
    console.log("-----------------------------------------");
  }

  console.log(`Conversion finished: ${succeeded} succeeded, ${failed} failed.`);
}

main().catch(err => {
  console.error("Critical error in main loop:", err);
});
