// Loads readDocumentText.ts's real implementation on demand, from a SEPARATE build output
// (see scripts/build.mjs's `buildDocumentParsingChunk`) — never a static import. pdfjs-dist and
// mammoth are heavy enough that statically bundling them into the main content script (injected
// into every LinkedIn page load) ballooned it roughly 12x; this keeps that weight out of the
// always-injected script entirely; it's only fetched the moment a user actually clicks "Upload
// a document instead". `chrome.runtime.getURL(...)` — not a bundler-resolvable string literal —
// is what keeps Rollup from inlining this module into the main iife bundle in the first place.
import type { DocumentReadResult } from "./readDocumentText";

export async function loadDocumentParser(): Promise<(file: File) => Promise<DocumentReadResult>> {
  const url = chrome.runtime.getURL("content/documentParsing.js");
  const module = (await import(/* @vite-ignore */ url)) as { readDocumentText: (file: File) => Promise<DocumentReadResult> };
  return module.readDocumentText;
}
