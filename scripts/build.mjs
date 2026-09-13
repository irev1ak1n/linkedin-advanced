// Small build driver using Vite's JS API directly, instead of adding a Chrome-extension
// bundler plugin dependency. Two targets (background service worker, LinkedIn content script)
// need different Vite configs in one `npm run build` / `npm run dev`, which a single
// vite.config.ts cannot express — this script is the minimal-dependency alternative. There is
// no browser side panel build anymore — LinkWise's entire UI lives inside the content script's
// own in-page panel.
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
  // external imports, which is what a manifest-declared content script requires. Needs the
  // React plugin: the in-page LinkWise panel (linkedin/panel/) is the ENTIRE LinkWise UI now —
  // goal setup (including document upload/parsing), profile scanning, and match analysis all
  // render inside this same content-script bundle, sharing a JS realm with the collection
  // engine instead of talking to it over chrome.runtime messaging.
  await build({
    root,
    configFile: false,
    plugins: [react()],
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

async function buildDocumentParsingChunk() {
  // Loaded lazily at runtime — see documents/loadDocumentParser.ts's
  // `import(chrome.runtime.getURL(...))` — specifically so the main content script (injected
  // into every LinkedIn page load) never pays for pdfjs-dist/mammoth's real weight. Confirmed
  // empirically: statically bundling this into the iife content script ballooned it from
  // ~230KB to ~2.9MB, just to support an optional "upload a document instead" button used by a
  // small fraction of sessions. `emptyOutDir: false` because this writes into the same
  // `dist/content` directory `buildLinkedInContentScript` already populated with `linkedin.js`;
  // only one of the two targets should ever clear it, and it must run first (see the call order
  // below).
  await build({
    root,
    configFile: false,
    define: nodeEnvDefine(watch ? "development" : "production"),
    build: {
      outDir: path.join(root, "dist/content"),
      emptyOutDir: false,
      watch: watch ? {} : null,
      rollupOptions: {
        output: { chunkFileNames: "[name].js" },
      },
      lib: {
        entry: path.join(root, "src/documents/readDocumentText.ts"),
        formats: ["es"],
        fileName: () => "documentParsing.js",
      },
    },
  });

  // Confirmed live: pdfjs-dist's own `?url` import of its worker script did not resolve to a
  // usable URL under this build (a Rollup lib-mode build driven directly through Vite's JS API
  // rather than the `vite build` CLI), which made pdfjs silently fall back to its own "fake
  // worker" mode — an internal fallback that tries to dynamically `import()` a
  // `data:text/javascript` URL of its own bundled core. Chrome's default extension CSP blocks
  // that outright, breaking PDF parsing entirely. Copying the real worker file to a fixed,
  // known path and pointing `GlobalWorkerOptions.workerSrc` at it via `chrome.runtime.getURL`
  // (see readDocumentText.ts) sidesteps bundler asset-URL resolution altogether.
  copyFileSync(
    path.join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"),
    path.join(root, "dist/content/pdf.worker.min.mjs"),
  );
}

function copyManifest() {
  mkdirSync(path.join(root, "dist"), { recursive: true });
  copyFileSync(path.join(root, "manifest.json"), path.join(root, "dist/manifest.json"));
}

await buildBackground();
await buildLinkedInContentScript();
await buildDocumentParsingChunk();
copyManifest();

console.log(
  watch
    ? "Finder: watching for changes (reload the extension in Chrome after each rebuild)."
    : "Finder: build complete.",
);
