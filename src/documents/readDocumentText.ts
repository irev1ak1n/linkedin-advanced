// Reads a locally-selected file's text content entirely client-side, inside the side panel —
// never uploaded anywhere, never sent to a server, no OCR. Supports plain text/Markdown
// directly, and PDF/DOCX via bundled parsing libraries. A file this can't read (wrong type,
// corrupted, or a scanned-image-only PDF with no text layer) produces an honest error message,
// never a guessed/partial result.
import * as pdfjsLib from "pdfjs-dist";
// Vite resolves this to a bundled asset URL at build time — the worker ships as a real file
// inside the extension, loaded from the extension's own origin, never a remote CDN.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface DocumentReadResult {
  text?: string;
  error?: string;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB — generous for a text-based document, bounds worst-case parse time

async function readPlainText(file: File): Promise<DocumentReadResult> {
  try {
    const text = (await file.text()).trim();
    if (!text) return { error: "This file appears to be empty." };
    return { text };
  } catch {
    return { error: "Could not read this file as text." };
  }
}

async function readPdfText(file: File): Promise<DocumentReadResult> {
  try {
    const buffer = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      pageTexts.push(pageText);
    }
    const text = pageTexts.join("\n").replace(/\s+/g, " ").trim();
    if (!text) {
      return {
        error: "This PDF has no extractable text — it may be a scanned image. OCR isn't supported; try a text-based file instead.",
      };
    }
    return { text };
  } catch {
    return { error: "Could not read this PDF file. It may be corrupted or password-protected." };
  }
}

async function readDocxText(file: File): Promise<DocumentReadResult> {
  try {
    const mammoth = await import("mammoth");
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    const text = (result.value ?? "").trim();
    if (!text) return { error: "This document appears to be empty." };
    return { text };
  } catch {
    return { error: "Could not read this .docx file. It may be corrupted or in an unsupported format." };
  }
}

/** Dispatches by file extension — LinkedIn/browser file pickers don't reliably expose a
 * trustworthy MIME type for every one of these formats, but the extension is exactly what the
 * user chose when saving the file, so it's the more honest signal here. */
export async function readDocumentText(file: File): Promise<DocumentReadResult> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: "This file is too large (max 10 MB). Please use a shorter document." };
  }

  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".md")) return readPlainText(file);
  if (name.endsWith(".pdf")) return readPdfText(file);
  if (name.endsWith(".docx")) return readDocxText(file);

  return { error: "Unsupported file type. Please upload a .txt, .md, .pdf, or .docx file." };
}
