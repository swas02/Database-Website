import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";

// Runtime data the viewer fetches by relative URL. Only what the registry lists
// is copied, so scratch files in IFC/ never reach dist/.
const STATIC_FILES = ["registry_flat.json", "test.lcca"];
const MODEL_FIELDS = ["json", "obj", "components", "design_report", "design_file", "cad", "input_file", "lcca"]; // no .ifc: only OBJ + groups.json are served

// Every top-level .html page is a build entry (lab site + dataset viewer).
function htmlPages() {
  const pages = {};
  const add = (dir) => {
    for (const f of fs.readdirSync(path.join(process.cwd(), dir))) {
      if (!f.endsWith(".html") || f === "template.html") continue;
      pages[path.join(dir, f).replaceAll("\\", "/").replace(/\.html$/, "")] = path.resolve(process.cwd(), dir, f);
    }
  };
  add(".");
  if (fs.existsSync(path.join(process.cwd(), "project"))) add("project"); // one page per project; project/template.html is skipped
  return pages;
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
      for (const bridge of registry) {
        for (const group of [bridge.sub, bridge.sup, bridge.common]) {
          if (!group) continue;
          for (const f of MODEL_FIELDS) if (group[f]) files.add(group[f]);
        }
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
      // Team photos are referenced the same way from data/team.json.
      for (const dir of ["awards", "team"]) {
        const imgs = path.join(root, "images", dir);
        if (fs.existsSync(imgs)) fs.cpSync(imgs, path.join(outDir, "images", dir), { recursive: true });
      }
      console.log(`copy-model-data: ${copied} files copied to ${path.relative(root, outDir)}/`);
    },
  };
}

// The research data is written into the script itself (dev and build), so no extra request is needed;
// editing data/research.json re-triggers the transform. The fetch in publications.js is only a fallback for other servers.
function inlineResearch() {
  const marker = /const raw = await \(await fetch\(new URL\("\.\/research\.json", import\.meta\.url\)\)\)\.json\(\);/;
  return {
    name: "inline-research",
    transform(code, id) {
      if (!id.replace(/\\/g, "/").endsWith("/data/publications.js")) return null;
      if (!marker.test(code)) this.error("inline-research: could not find the research.json fetch in data/publications.js");
      const file = path.resolve(path.dirname(id), "research.json");
      this.addWatchFile(file);
      const json = fs.readFileSync(file, "utf-8");
      return code.replace(marker, () => `const raw = ${JSON.stringify(JSON.parse(json))};`);
    },
  };
}

// Dev server: Vite only serves 404.html itself in preview, so answer unknown page URLs with it here.
function devNotFoundPage() {
  return {
    name: "dev-404-page",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "GET" || !(req.headers.accept || "").includes("text/html")) return next();
        const root = path.resolve(server.config.root);
        const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
        const target = path.join(root, rel);
        const page = path.join(root, "404.html");
        if (!target.startsWith(root) || !fs.existsSync(page)) return next();
        if (fs.existsSync(target) && (fs.statSync(target).isFile() || fs.existsSync(path.join(target, "index.html")))) return next();
        const html = await server.transformIndexHtml(req.url, fs.readFileSync(page, "utf-8"));
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/html");
        res.end(html);
      });
    },
  };
}

export default defineConfig({
  base: "./",
  appType: "mpa", // unknown URLs get 404.html instead of falling back to index.html
  publicDir: false,
  plugins: [inlineResearch(), copyModelData(), devNotFoundPage()],
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 1200, rollupOptions: { input: htmlPages() } },
});
