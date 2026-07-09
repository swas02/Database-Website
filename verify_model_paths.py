import sys
import re
import hashlib
import json
from pathlib import Path

# Pattern to capture the first string parameter of FILE_NAME(...)
FILE_NAME_RE = re.compile(r"FILE_NAME\s*\(\s*['\"]([^'\"]*)['\"]", re.IGNORECASE)

def calculate_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def verify_models():
    base_dir = Path(__file__).parent
    ifc_dir = base_dir / "IFC"
    
    if not ifc_dir.exists():
        print(f"\033[91mError: IFC directory not found at {ifc_dir}\033[0m")
        sys.exit(1)
        
    model_files = sorted(ifc_dir.rglob("model.ifc"))
    
    print(f"Found {len(model_files)} 'model.ifc' files. Starting verification...\n")
    
    ok_count = 0
    mismatches = []
    empty_headers = []
    missing_header = []
    hash_mismatches = []
    
    for ifc_path in model_files:
        # Parent directory is the config name (e.g. M_20_2L_NF_P)
        folder_name = ifc_path.parent.name
        rel_path = ifc_path.relative_to(base_dir)
        
        file_name_val = None
        found_endsec = False
        
        # 1. FILE_NAME Header Check
        try:
            with open(ifc_path, "r", encoding="utf-8", errors="ignore") as f:
                for _ in range(100):  # limit to first 100 lines
                    line = f.readline()
                    if not line:
                        break
                    
                    match = FILE_NAME_RE.search(line)
                    if match:
                        file_name_val = match.group(1)
                        break
                    
                    if "ENDSEC" in line:
                        found_endsec = True
                        break
        except Exception as e:
            print(f"\033[91m[ERROR] Failed to read {rel_path}: {e}\033[0m")
            continue
        
        if file_name_val is None:
            print(f"\033[93m[WARNING] FILE_NAME line not found in {rel_path}\033[0m")
            missing_header.append((rel_path, folder_name))
        elif file_name_val == "":
            print(f"\033[90m[INFO] {folder_name}: Empty FILE_NAME header (MIDAS/Osdag) in {rel_path}\033[0m")
            empty_headers.append((rel_path, folder_name))
        elif folder_name.lower() in file_name_val.lower():
            print(f"\033[92m[OK] {folder_name} is in FILE_NAME '{file_name_val}' in {rel_path}\033[0m")
            ok_count += 1
        else:
            print(f"\033[91m[MISMATCH] Folder '{folder_name}' NOT found in FILE_NAME '{file_name_val}' in {rel_path}\033[0m")
            mismatches.append((rel_path, folder_name, file_name_val))

        # 2. SHA-256 Hash Integrity Check
        json_path = ifc_path.parent / "groups.json"
        if not json_path.exists():
            json_path = ifc_path.parent / f"{folder_name}.json"
            
        if json_path.exists():
            try:
                # Read JSON supporting UTF-8 BOM automatically
                content = json_path.read_text(encoding="utf-8-sig")
                groups_data = json.loads(content)
                expected_hash = groups_data.get("ifcHash")
                if expected_hash:
                    actual_hash = calculate_sha256(ifc_path)
                    if expected_hash.strip().lower() != actual_hash.strip().lower():
                        hash_mismatches.append((rel_path, expected_hash, actual_hash))
                        print(f"\033[91m  [HASH MISMATCH] groups.json hash '{expected_hash[:8]}...' != actual file '{actual_hash[:8]}...'\033[0m")
                    else:
                        print(f"\033[92m  [HASH OK] {folder_name} hash verified\033[0m")
                else:
                    print(f"\033[93m  [HASH WARNING] No 'ifcHash' property in JSON sidecar\033[0m")
            except Exception as e:
                print(f"\033[91m  [HASH ERROR] Failed to verify: {e}\033[0m")
        else:
            print(f"\033[93m  [HASH WARNING] No JSON sidecar found for hash verification\033[0m")
            
    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    print(f"Total files checked       : {len(model_files)}")
    print(f"Total verified matches    : {ok_count}")
    print(f"Total empty headers (OK)  : {len(empty_headers)}")
    print(f"Total path mismatches     : {len(mismatches)}")
    print(f"Total missing FILE_NAME   : {len(missing_header)}")
    print(f"Total hash mismatches     : {len(hash_mismatches)}")
    
    if mismatches:
        print("\n\033[91mWarning: Path Mismatches Detected!\033[0m")
        for rel_path, folder, file_val in mismatches:
            print(f"  - {rel_path}: Folder name '{folder}' is missing from FILE_NAME '{file_val}'")
            
    if hash_mismatches:
        print("\n\033[91mWarning: Hash Mismatches Detected (groups.json is out of sync with model.ifc)!\033[0m")
        for rel_path, expected, actual in hash_mismatches:
            print(f"  - {rel_path}: Expected '{expected[:12]}...', got '{actual[:12]}...'")

    if mismatches or hash_mismatches:
        sys.exit(1)
    else:
        print("\n\033[92mAll checked model files verified successfully!\033[0m")
        sys.exit(0)

if __name__ == "__main__":
    verify_models()
