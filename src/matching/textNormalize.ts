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

/** Generic qualifier nouns that add no real specificity of their own — "engineering
 * background" and "engineering experience" both mean the same thing as plain "engineering"
 * for matching purposes. Dropped from the significant-keyword set ONLY when at least one
 * other, more specific keyword remains (a criterion that is JUST "experience" still needs
 * that word, or there'd be nothing left to match at all). This is deliberately a short,
 * curated list, not a stemming rule — "mentor" is not in it, so "FRC mentor" is untouched and
 * still requires real mentorship evidence, never satisfied by generic robotics interest. */
const GENERIC_QUALIFIER_WORDS = new Set(["background", "experience", "skills", "skill", "knowledge", "expertise"]);

export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/** Significant keywords only (stopwords removed, deduplicated) — the set a profile field
 * must cover for a "keyword match" (see criterionMatcher.ts). Returns an empty array only
 * when the criterion text is itself empty or entirely stopwords. */
export function significantKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  const words = [...new Set(normalized.split(" ").filter((w) => w.length > 0 && !STOPWORDS.has(w)))];

  const specific = words.filter((w) => !GENERIC_QUALIFIER_WORDS.has(w));
  return specific.length > 0 ? specific : words;
}

/**
 * A deliberately small, conservative stemmer — NOT a general Porter stemmer — used only to
 * compare two words for the "same root" purpose ("engineer" / "engineering" / "engineers"
 * should all count as the same keyword). Only strips a suffix when the remainder is still a
 * plausible word (>= 4 characters), and only ever applied to words >= 6 characters long in the
 * first place, specifically to avoid short, unrelated words accidentally colliding (e.g.
 * "mentor" must never be affected by this). Comparison-only: evidence text and display labels
 * always show the original word, never the stem.
 */
export function stem(word: string): string {
  if (word.length < 6) return word;
  // Deliberately does NOT strip a bare "-er"/"-ers" suffix: many real words end in "-eer"/"-er"
  // as part of the root itself, not as an inflection (engineer, volunteer, manager) — a naive
  // "-ers" strip turns "engineers" into "engine" instead of "engineer". Stripping only "-ing"
  // and a plain trailing "-s" still collapses "engineer"/"engineering"/"engineers" to the same
  // stem without that failure mode.
  if (word.endsWith("ing") && word.length - 3 >= 4) return word.slice(0, -3);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length - 1 >= 4) return word.slice(0, -1);
  return word;
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
