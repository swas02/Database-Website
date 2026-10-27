"""
split_steel_data.py — TEMPORARY helper. Splits data/steel_data.json into one <bridge>.<sub|sup>.component.json
per structure folder (Sub_Str / Sup_Str) of each steel bridge. Run once, then run reg.py.
Once the per-folder files are the source of truth, steel_data.json and this script can go.
"""

import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_DIR = BASE_DIR / "project_database" / "PSC_vs_Steel_Short_Span_Bridges"
STEEL_DATA = BASE_DIR / "archive" / "steel_data_v2.json"
OUT_SUFFIX = ".component.json"
KIND = {"Sub_Str": "sub", "Sup_Str": "sup"}

SUP_KEYS = ("total_width_m", "deck_slab", "girder_spacing_m", "cross_bracing",
            "transverse_stiffeners_per_girder_side", "bearing_stiffeners_per_girder_side",
            "girder_sections")


def split(spec: dict) -> dict:
    """steel_data.json entry -> {"Sub_Str": ..., "Sup_Str": ...}."""
    grades = spec.get("material_grades") or {}
    sub = {**(spec.get("substructure") or {}),  # pile, pile_cap, pier, pier_cap
           "material_grades": {k: v for k, v in grades.items() if k != "structural_steel"}}
    sup = {**{k: spec[k] for k in SUP_KEYS if k in spec}, "material_grades": grades}
    return {"Sub_Str": sub, "Sup_Str": sup}


def main():
    with open(STEEL_DATA, encoding="utf-8-sig") as f:
        entries = json.load(f)
    written = skipped = 0
    for spec in entries:
        bridge_id = spec["bridge_id"]
        bridge_dirs = list(DB_DIR.glob(f"*/*/{bridge_id}"))
        if not bridge_dirs:
            print(f"no folder for {bridge_id}")
            skipped += 1
            continue
        for structure, data in split(spec).items():
            folder = bridge_dirs[0] / structure
            if not folder.is_dir():
                print(f"no {structure} folder for {bridge_id}")
                continue
            with open(folder / f"{bridge_id}.{KIND[structure]}{OUT_SUFFIX}", "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
                f.write("\n")
            written += 1
    print(f"wrote {written} {OUT_SUFFIX} files, {skipped} bridges without a folder")


if __name__ == "__main__":
    main()
