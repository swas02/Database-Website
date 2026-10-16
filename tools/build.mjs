// npm run build              -> vite build only
// npm run build -- --complete -> rebuild registry, regenerate every OBJ, then vite build
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const complete = process.argv.includes("--complete");

function run(label, cmd, args) {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`\n${label} failed (exit ${r.status}).`);
    process.exit(r.status || 1);
  }
}

if (complete) {
  run("1/3 Regenerate registry (reg.py)", "python", ["tools/reg.py"]);
  run("2/3 Convert IFC -> OBJ", "node", ["tools/convert_ifc_to_obj.js"]);
}
run(complete ? "3/3 Vite build" : "Vite build", "npx", ["vite", "build"]);
