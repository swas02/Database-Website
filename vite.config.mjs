import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";

// Runtime data the viewer fetches by relative URL. Only what the registry lists
// is copied, so scratch files in IFC/ never reach dist/.
const STATIC_FILES = ["registry_flat.json", "data/steel_data.json", "test.lcca"];
const MODEL_FIELDS = ["json", "obj", "design_report", "design_file", "cad"]; // no .ifc: only OBJ + groups.json are served

// Every top-level .html page is a build entry (lab site + dataset viewer).
function htmlPages() {
  return Object.fromEntries(
    fs.readdirSync(process.cwd()).filter((f) => f.endsWith(".html")).map((f) => [f.replace(/\.html$/, ""), path.resolve(process.cwd(), f)])
  );
}

function copyModelData() {
  let outDir;
  return {
    name: "copy-model-data",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const root = process.cwd();
      const registry = JSON.parse(fs.readFileSync(path.join(root, "registry_flat.json"), "utf-8"));
      const files = new Set(STATIC_FILES);
      for (const entry of registry) {
        for (const f of MODEL_FIELDS) if (entry[f]) files.add(entry[f]);
      }
      let copied = 0;
      for (const rel of files) {
        const src = path.join(root, rel);
        if (!fs.existsSync(src)) continue;
        const dest = path.join(outDir, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        copied++;
      }
      // Award photos are referenced by path from data/research.json, so copy the whole folder.
      const awardImgs = path.join(root, "images", "awards");
      if (fs.existsSync(awardImgs)) fs.cpSync(awardImgs, path.join(outDir, "images", "awards"), { recursive: true });
      console.log(`copy-model-data: ${copied} files copied to ${path.relative(root, outDir)}/`);
    },
  };
}

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [copyModelData()],
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 1200, rollupOptions: { input: htmlPages() } },
});
