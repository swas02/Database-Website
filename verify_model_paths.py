import sys
import re
from pathlib import Path

# Pattern to capture the first string parameter of FILE_NAME(...)
FILE_NAME_RE = re.compile(r"FILE_NAME\s*\(\s*['\"]([^'\"]*)['\"]", re.IGNORECASE)

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
    
    for ifc_path in model_files:
        # Parent directory is the config name (e.g. M_20_2L_NF_P)
        folder_name = ifc_path.parent.name
        
        file_name_val = None
        found_endsec = False
        
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
            print(f"\033[91m[ERROR] Failed to read {ifc_path.relative_to(base_dir)}: {e}\033[0m")
            continue
            
        rel_path = ifc_path.relative_to(base_dir)
        
        if file_name_val is None:
            print(f"\033[93m[WARNING] FILE_NAME line not found in {rel_path}\033[0m")
            missing_header.append((rel_path, folder_name))
            continue
            
        if file_name_val == "":
            print(f"\033[90m[INFO] {folder_name}: Empty FILE_NAME header (MIDAS/Osdag) in {rel_path}\033[0m")
            empty_headers.append((rel_path, folder_name))
            continue
            
        # Verify if folder name is contained in the FILE_NAME parameter (A)
        if folder_name.lower() in file_name_val.lower():
            print(f"\033[92m[OK] {folder_name} is in FILE_NAME '{file_name_val}' in {rel_path}\033[0m")
            ok_count += 1
        else:
            print(f"\033[91m[MISMATCH] Folder '{folder_name}' NOT found in FILE_NAME '{file_name_val}' in {rel_path}\033[0m")
            mismatches.append((rel_path, folder_name, file_name_val))
            
    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    print(f"Total files checked      : {len(model_files)}")
    print(f"Total verified matches   : {ok_count}")
    print(f"Total empty headers (OK) : {len(empty_headers)}")
    print(f"Total mismatches (FAIL)  : {len(mismatches)}")
    print(f"Total missing FILE_NAME  : {len(missing_header)}")
    
    if mismatches:
        print("\n\033[91mWarning: Mismatches Detected!\033[0m")
        for rel_path, folder, file_val in mismatches:
            print(f"  - {rel_path}: Folder name '{folder}' is missing from FILE_NAME '{file_val}'")
            
    if mismatches:
        sys.exit(1)
    else:
        print("\n\033[92mAll checked model files verified successfully!\033[0m")
        sys.exit(0)

if __name__ == "__main__":
    verify_models()
