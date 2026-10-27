"""
reg.py — scan project_database/ and write the site index: registry_flat.json (+ registry.log).
It only lists the files that exist and reports the ones that are missing; it holds no bridge data.

Folder layout:
  project_database/<project>/<type>/<location>/<bridge>/
      <bridge>.3ps  <bridge>.3ps.pdf  <bridge>.results.lcca      shared by both structures
      Sub_Str/  model.ifc  model.obj  groups.json  <bridge>.sub.component.json  <bridge>.sub.mcb  [<bridge>.cad.dwg]
      Sup_Str/  model.ifc  model.obj  groups.json  <bridge>.sup.component.json  <bridge>.sup.mcb  [<bridge>.cad.dwg]

Bridge folder name: {D|M}_{span}_{2L|3L}_{NF|OF}_{P|S}   (NF = no footpath, OF = one footpath)

Output: one record per bridge
  {bridge_id, bridge_type, location, span, lanes, footpath,
   sub: {ifc, json, obj, components, design_file, cad} | null,
   sup: {ifc, json, obj, components, design_file, cad} | null,
   common: {design_report, input_file, lcca}}

Every file field is a path relative to the project root, or null when the file does not exist.
`components` is the file behind the viewer's Material tab / girder inspector (PSC bridges have none).
"""

import json
import logging
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_DIR = BASE_DIR / "project_database" / "PSC_vs_Steel_Short_Span_Bridges"
OUTPUT = BASE_DIR / "registry_flat.json"
OUTPUT_LOG = BASE_DIR / "registry.log"

BRIDGE_RE = re.compile(r"^[A-Z]_(\d+)_(\d+L)_(NF|OF)_[A-Z]+$", re.IGNORECASE)

# Structure folder -> key in the record. The key also names the design file: <bridge>.<key>.mcb
PARTS = {"Sub_Str": "sub", "Sup_Str": "sup"}

# Downloadable files are matched on the last two dot-segments, so the <bridge> prefix can be anything.
PART_ASSETS = {  # live inside Sub_Str / Sup_Str
    "components": lambda key: [".component.json"],
    "design_file": lambda key: [f".{key}.mcb"],
    "cad": lambda key: [".cad.dwg", ".cad.dxf"],
}
COMMON_ASSETS = {  # live once in the bridge folder (a copy inside a structure folder is still honoured)
    "design_report": [".3ps.pdf", ".report.pdf"],
    "input_file": [".3ps"],
    "lcca": [".results.lcca"],
}


def rel(path: Path | None) -> str | None:
    return path.relative_to(BASE_DIR).as_posix() if path else None


def find_asset(folder: Path, suffixes: list) -> Path | None:
    if not folder.is_dir():
        return None
    return next((f for f in sorted(folder.iterdir())
                 if f.is_file() and f.name.lower().endswith(tuple(suffixes))), None)


def find_json(folder: Path, bridge_id: str) -> Path | None:
    """Groups sidecar: <bridge>.json, then groups.json, then any .json in the folder."""
    for name in (f"{bridge_id}.json", "groups.json"):
        if (folder / name).exists():
            return folder / name
    return next(iter(sorted(folder.glob("*.json"))), None)


def scan_part(folder: Path, key: str, bridge_id: str, missing: list) -> dict | None:
    ifc = folder / "model.ifc"
    if not ifc.exists():
        return None
    json_path = find_json(folder, bridge_id)
    if json_path is None:
        logging.warning(f"MISSING JSON — skipping: {rel(ifc)}")
        missing.append(rel(ifc))
        return None
    obj = ifc.with_suffix(".obj")
    logging.debug(f"OK — {rel(ifc)}")
    return {
        "ifc": rel(ifc),
        "json": rel(json_path),
        "obj": rel(obj) if obj.exists() else None,
        **{field: rel(find_asset(folder, suffixes(key))) for field, suffixes in PART_ASSETS.items()},
    }


def scan() -> tuple:
    if not DB_DIR.exists():
        raise FileNotFoundError(f"Database directory not found: {DB_DIR}")
    bridges, missing = [], []

    for folder in sorted(DB_DIR.glob("*/*/*")):  # <type>/<location>/<bridge>
        if not folder.is_dir():
            continue
        bridge_type, location, bridge_id = folder.relative_to(DB_DIR).parts
        m = BRIDGE_RE.match(bridge_id)
        if not m:
            logging.warning(f"SKIP — folder name does not match the expected pattern: {bridge_id}")
            continue
        span, lanes, footpath = m.group(1), m.group(2).upper(), m.group(3).upper()

        record = {"bridge_id": bridge_id, "bridge_type": bridge_type, "location": location,
                  "span": span, "lanes": lanes, "footpath": footpath, "sub": None, "sup": None}
        for dirname, key in PARTS.items():
            record[key] = scan_part(folder / dirname, key, bridge_id, missing)
        if not (record["sub"] or record["sup"]):
            continue

        folders = [folder, *(folder / d for d in PARTS)]
        record["common"] = {field: rel(next(filter(None, (find_asset(d, s) for d in folders)), None))
                            for field, s in COMMON_ASSETS.items()}
        bridges.append(record)
    return bridges, missing


def main():
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s  %(levelname)-8s  %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[logging.FileHandler(OUTPUT_LOG, encoding="utf-8"), logging.StreamHandler()],
    )
    logging.info(f"=== reg.py started at {datetime.now().isoformat()} ===")
    logging.info(f"Scanning: {DB_DIR}")

    bridges, missing = scan()
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(bridges, f, indent=2)
    logging.info(f"Registry written : {OUTPUT}")

    counts = Counter(f"{b['bridge_type']}/{b['location']}/{dirname}"
                     for b in bridges for dirname, key in PARTS.items() if b[key])
    logging.info("=" * 50)
    logging.info(f"  Bridges                  : {len(bridges)}")
    logging.info(f"  Models (.ifc + .json)    : {sum(counts.values())}")
    logging.info(f"  Missing .json sidecars   : {len(missing)}")
    logging.info("  Files per folder:")
    for folder, count in sorted(counts.items()):
        logging.info(f"    {folder:<40} {count} file(s)")
    for p in missing:
        logging.warning(f"    missing json: {p}")

    # Report which optional files are absent, per kind
    logging.info("  Missing files (count of bridges / models without it):")
    for field in COMMON_ASSETS:
        absent = [b["bridge_id"] for b in bridges if not b["common"][field]]
        logging.info(f"    {field:<14} {len(absent)} of {len(bridges)} bridges")
    parts = [(b["bridge_id"], k, b[k]) for b in bridges for k in PARTS.values() if b[k]]
    for field in ("obj", *PART_ASSETS):
        absent = [f"{bid}/{k}" for bid, k, p in parts if not p[field]]
        logging.info(f"    {field:<14} {len(absent)} of {len(parts)} models")
        for name in absent if field in ("obj", "components") and len(absent) < 20 else []:
            logging.debug(f"      no {field}: {name}")
    logging.info("=" * 50)


if __name__ == "__main__":
    main()
