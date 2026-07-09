# BridgeLCCA Developer Guide

This document describes the workflow for managing, converting, and registering 3D bridge models in the database.

---

## 1. 3D Model Pipeline Overview
To optimize loading times on the website, we load pre-converted **`.obj`** files instead of raw `.ifc` files:
* **Why OBJ?**: OBJ files load in under **150ms** directly into WebGL memory. This removes the 2MB WebAssembly parser overhead (`web-ifc.wasm` and dynamic initialization) completely from the client browser.
* **Groups Preservation**: The conversion script reads `groups.json` and embeds the group mapping directly in the OBJ file (using `g [group_name]` tags). This allows the frontend to toggle, color, and select meshes using your existing UI components seamlessly.

---

## 2. Re-Initialization Workflow (Adding New Models)

Whenever you add new models (new `.ifc` files and `groups.json` mappings) to the `IFC/` directory, execute the following sequence of commands in order from the project root:

### Step 1: Install Dependencies (If needed)
Ensure you have the required Node.js libraries:
```bash
npm install
```

### Step 2: Convert IFC to OBJ
Run the Node converter script to parse all `.ifc` files and output grouped `.obj` files in the same directory:
```bash
node convert_ifc_to_obj.js
```

### Step 3: Verify File Headers
Verify that the IFC files correspond to the folder names they reside in:
```bash
python verify_model_paths.py
```

### Step 4: Regenerate Registry Databases
Scan the folder structure and regenerate the website index databases (`registry.json` and `registry_flat.json`) listing both the `.ifc` and generated `.obj` paths:
```bash
python reg.py
```

---

## 3. Script References

* [convert_ifc_to_obj.js](./convert_ifc_to_obj.js) — Node.js CLI script using `web-ifc` to output grouped `.obj` files.
* [verify_model_paths.py](./verify_model_paths.py) — Python script checking IFC file headers for correct naming conventions.
* [reg.py](./reg.py) — Python script generating registry database.

---

## Appendix: Unique IFC Group Names Reference
The following group names are extracted and mapped across the current models:
* `deck_slab` (or `Slab`, `Deck`)
* `girder_sections` (or `Girder`)
* `cross_bracing` (or `Chord`, `Diaphragm`, `Diagonal Brace`)
* `transverse_stiffeners_per_girder_side` (or `Intermediate Stiffener`)
* `bearing_stiffeners_per_girder_side` (or `End Stiffener`)
* `Pier`
* `Pier Cap`
* `Pile`
* `Pile Cap`
