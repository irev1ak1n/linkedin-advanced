// Small build driver using Vite's JS API directly, instead of adding a Chrome-extension
// bundler plugin dependency. Three targets (side panel app, background service worker,
// LinkedIn content script) need different Vite configs in one `npm run build` /
// `npm run dev`, which a single vite.config.ts cannot express — this script is the
// minimal-dependency alternative.
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdirSync, copyFileSync } from "node:fs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const watch = process.argv.includes("--watch");

// Vite's `build.lib` mode does not apply the automatic `process.env.NODE_ENV` production
// define that a normal (non-lib) app build gets for free — lib-mode output is meant to be
// re-bundled by a downstream consumer, which is the wrong assumption for a content script or
// service worker, since both are final, directly-Chrome-loaded bundles with no further build
// step. Without this, React's own package entry point ships its runtime dev/prod switcher
// (`process.env.NODE_ENV === "production" ? require(prod) : require(dev)`), and `process`
// does not exist in a Chrome content-script (or service-worker) context.
function nodeEnvDefine(mode) {
  return { "process.env.NODE_ENV": JSON.stringify(mode) };
}

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
    define: nodeEnvDefine(watch ? "development" : "production"),
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

async function buildLinkedInContentScript() {
  // Manifest V3 `content_scripts` entries cannot be ES modules (unlike the background
  // service worker, which explicitly opts into `"type": "module"`) — Chrome loads them as
  // classic scripts. `formats: ["iife"]` produces a single self-contained script with no
  // external imports, which is what a manifest-declared content script requires.
  await build({
    root,
    configFile: false,
    define: nodeEnvDefine(watch ? "development" : "production"),
    build: {
      outDir: path.join(root, "dist/content"),
      emptyOutDir: true,
      watch: watch ? {} : null,
      lib: {
        entry: path.join(root, "src/linkedin/content.ts"),
        formats: ["iife"],
        name: "FinderLinkedInContentScript",
        fileName: () => "linkedin.js",
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
await buildLinkedInContentScript();
copyManifest();

console.log(
  watch
    ? "Finder: watching for changes (reload the extension in Chrome after each rebuild)."
    : "Finder: build complete.",
);
