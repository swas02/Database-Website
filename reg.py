"""
reg.py — Dev tool to scan the IFC folder and generate a file registry JSON.

Output: registry.json (next to this script)

Registry structure:
{
  "PSC": {
    "Darbhanga": {
      "Sub_Str": {
        "20": {
          "2L": {
            "NF": { "ifc": "...", "json": "..." },
            "OF": { "ifc": "...", "json": "..." }
          },
          "3L": { ... }
        }
      },
      "Sup_Str": { ... }
    },
    "Mumbai": { ... }
  },
  "Steel": { ... },
  "_flat": [ ... ]
}

Filename convention (parsed from stem):
  {LocationCode}_{Span}_{Lanes}_{FootpathType}_{BridgeCode}
  e.g.  D_20_2L_NF_P   or   M_45_3L_OF_P

  Structure type (Sub_Str / Sup_Str) is determined by the parent folder, not the filename.

  NF = No Footpath
  OF = One Footpath (with Footpath)

  Sub_Str  = Substructure  (piers, abutments, foundations)
  Sup_Str  = Superstructure (deck, girders, beams)
"""

import json
import logging
import re
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).parent
IFC_DIR = BASE_DIR / "IFC"
OUTPUT = BASE_DIR / "registry.json"
OUTPUT_FLAT = BASE_DIR / "registry_flat.json"
OUTPUT_LOG = BASE_DIR / "registry.log"

FILENAME_RE = re.compile(
    r"^([A-Z])_(\d+)_(\d+L)_(NF|OF)_([A-Z]+)$", re.IGNORECASE  # NF=No Footpath, OF=One Footpath
)

STRUCTURE_LABEL = {
    "Sub_Str": "Substructure",
    "Sup_Str": "Superstructure",
}


def setup_logging():
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s  %(levelname)-8s  %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.FileHandler(OUTPUT_LOG, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )
    logging.info(f"=== reg.py started at {datetime.now().isoformat()} ===")


def parse_filename(stem: str) -> dict | None:
    m = FILENAME_RE.match(stem)
    if not m:
        return None
    location_code, span, lanes, flood, bridge_code = m.groups()
    return {
        "location_code": location_code.upper(),
        "span": span,
        "lanes": lanes.upper(),
        "flood": flood.upper(),
        "bridge_code": bridge_code.upper(),
    }


def nested_set(d: dict, keys: list, value):
    for k in keys[:-1]:
        d = d.setdefault(k, {})
    d[keys[-1]] = value


def scan():
    registry: dict = {}
    flat: list = []
    missing_pairs: list = []

    if not IFC_DIR.exists():
        logging.error(f"IFC directory not found: {IFC_DIR}")
        raise FileNotFoundError(f"IFC directory not found: {IFC_DIR}")

    all_ifc = sorted(IFC_DIR.rglob("*.ifc"))
    logging.info(f"Found {len(all_ifc)} .ifc files to process")

    for ifc_path in all_ifc:
        rel = ifc_path.relative_to(BASE_DIR)
        parts = rel.parts  # ('IFC', 'PSC', 'Darbhanga', 'Sub_Str', 'D_20_2L_NF_P.ifc')

        if len(parts) != 5:
            logging.warning(f"SKIP — unexpected folder depth ({len(parts)} levels): {rel}")
            continue

        _, bridge_type, location, structure_dir, filename = parts
        parsed = parse_filename(ifc_path.stem)
        if parsed is None:
            logging.warning(f"SKIP — filename does not match expected pattern: {filename}")
            continue

        json_path = ifc_path.with_suffix(".json")
        ifc_rel = str(rel).replace("\\", "/")
        json_rel = str(json_path.relative_to(BASE_DIR)).replace("\\", "/")

        if not json_path.exists():
            logging.warning(f"MISSING JSON — skipping: {ifc_rel}")
            missing_pairs.append(ifc_rel)
            continue

        logging.debug(f"OK — {ifc_rel}")

        entry = {
            "ifc": ifc_rel,
            "json": json_rel,
        }

        nested_set(registry, [bridge_type, location, structure_dir,
                               parsed["span"], parsed["lanes"], parsed["flood"]], entry)

        flat.append({
            "bridge_type": bridge_type,
            "location": location,
            "structure": STRUCTURE_LABEL.get(structure_dir, structure_dir),
            "structure_dir": structure_dir,
            "span": parsed["span"],
            "lanes": parsed["lanes"],
            "footpath": parsed["flood"],  # NF=No Footpath, OF=One Footpath
            **entry,
        })

    return registry, flat, missing_pairs


def main():
    setup_logging()
    logging.info(f"Scanning: {IFC_DIR}")

    registry, flat, missing = scan()

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2)
    logging.info(f"Registry written : {OUTPUT}")

    with open(OUTPUT_FLAT, "w", encoding="utf-8") as f:
        json.dump(flat, f, indent=2)
    logging.info(f"Flat list written: {OUTPUT_FLAT}")

    from collections import Counter

    counts = Counter(f"{e['bridge_type']}/{e['location']}/{e['structure_dir']}" for e in flat)
    empty_folders = []

    logging.info("=" * 50)
    logging.info("SUMMARY")
    logging.info("=" * 50)
    logging.info(f"  Total .ifc files found   : {len(flat)}")
    logging.info(f"  Total .json sidecars      : {len(flat) - len(missing)}")
    logging.info(f"  Missing .json sidecars    : {len(missing)}")
    logging.info("  ---")
    logging.info("  Files per folder:")
    for folder, count in sorted(counts.items()):
        logging.info(f"    {folder:<40} {count} file(s)")
    if missing:
        logging.info("  ---")
        logging.info("  Missing .json sidecars:")
        for p in missing:
            logging.warning(f"    {p}")
    logging.info("=" * 50)
    logging.info("=== reg.py finished ===")


if __name__ == "__main__":
    main()
