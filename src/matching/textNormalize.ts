// Pure text utilities for the deterministic matcher — no AI, no network, no randomness.
// Same input always produces the same output.

/** Common English filler words that carry no matching signal on their own — stripped before
 * keyword comparison so e.g. "in" or "with" never counts as a "keyword" a profile must
 * contain. Deliberately short and conservative: better to under-strip (a harmless extra
 * keyword requirement) than over-strip (silently dropping a word the user actually meant). */
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "with",
  "is",
  "are",
  "be",
  "as",
  "by",
  "from",
  "my",
]);

export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/** Significant keywords only (stopwords removed, deduplicated) — the set a profile field
 * must cover for a "keyword match" (see criterionMatcher.ts). Returns an empty array only
 * when the criterion text is itself empty or entirely stopwords. */
export function significantKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  const words = normalized.split(" ").filter((w) => w.length > 0 && !STOPWORDS.has(w));
  return [...new Set(words)];
}

/** Splits text into sentences for evidence snippets — a plain, deterministic split on
 * sentence-ending punctuation or newlines, good enough for surfacing "the sentence that
 * matched" without needing real NLP. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const MAX_SNIPPET_LENGTH = 220;

/** Trims a long field down to a readable evidence snippet, centered on the first match
 * position when known, so evidence never dumps an entire multi-paragraph About section into
 * the UI. */
export function truncateSnippet(text: string, matchIndex = 0): string {
  if (text.length <= MAX_SNIPPET_LENGTH) return text;
  const start = Math.max(0, matchIndex - 40);
  const end = Math.min(text.length, start + MAX_SNIPPET_LENGTH);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}
