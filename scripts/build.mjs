// Small build driver using Vite's JS API directly, instead of adding a Chrome-extension
// bundler plugin dependency. Two targets (side panel app, background service worker) need
// different Vite configs in one `npm run build` / `npm run dev`, which a single
// vite.config.ts cannot express — this script is the minimal-dependency alternative.
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdirSync, copyFileSync } from "node:fs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const watch = process.argv.includes("--watch");

async function buildSidePanel() {
  await build({
    root: path.join(root, "src/sidepanel"),
    configFile: false,
    base: "./",
    plugins: [react()],
    build: {
      outDir: path.join(root, "dist/sidepanel"),
      emptyOutDir: true,
      watch: watch ? {} : null,
    },
  });
}

async function buildBackground() {
  await build({
    root,
    configFile: false,
    build: {
      outDir: path.join(root, "dist/background"),
      emptyOutDir: true,
      watch: watch ? {} : null,
      lib: {
        entry: path.join(root, "src/background/index.ts"),
        formats: ["es"],
        fileName: () => "index.js",
      },
    },
  });
}

function copyManifest() {
  mkdirSync(path.join(root, "dist"), { recursive: true });
  copyFileSync(path.join(root, "manifest.json"), path.join(root, "dist/manifest.json"));
}

await buildSidePanel();
await buildBackground();
copyManifest();

console.log(
  watch
    ? "Finder: watching for changes (reload the extension in Chrome after each rebuild)."
    : "Finder: build complete.",
);
