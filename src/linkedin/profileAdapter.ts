// The ONE file that queries LinkedIn's own DOM for the profile surface. Every other module
// (matching, storage, UI) works only with the LinkedInProfile type this file produces — never
// with a LinkedIn selector directly — so the place that has to change when LinkedIn's markup
// changes stays exactly one file.
//
// Reads only what is already rendered on the current page. Never fetches another page, never
// expands a collapsed section by itself, never reads anything the user hasn't already
// navigated to and had LinkedIn render for them.
import { EMPTY_PROFILE, type LinkedInProfile, type ProfileEducationEntry, type ProfileExperienceEntry } from "../models/profile";

const SECTION_HEADINGS = ["about", "experience", "education", "skills"] as const;
type SectionName = (typeof SECTION_HEADINGS)[number];

function cleanText(text: string | null | undefined): string | undefined {
  const trimmed = text?.replace(/\s+/g, " ").trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/** LinkedIn commonly duplicates visible text inside an `aria-hidden` twin (for its own
 * accessibility markup) right next to a `visually-hidden` screen-reader copy of the SAME
 * text — reading `textContent` naively doubles it (e.g. "Software EngineerSoftware
 * Engineer"). Prefer the `aria-hidden="true"` copy when one exists; it is the one meant to be
 * visually read. */
function visibleText(element: Element): string | undefined {
  const ariaHidden = element.querySelector('[aria-hidden="true"]');
  if (ariaHidden) return cleanText(ariaHidden.textContent);
  return cleanText(element.textContent);
}

function findMain(doc: Document): HTMLElement {
  return doc.querySelector<HTMLElement>('main[role="main"], main') ?? doc.body;
}

function findHeadingSection(main: HTMLElement, heading: SectionName): HTMLElement | null {
  const headings = Array.from(main.querySelectorAll<HTMLElement>("h2, h3"));
  const match = headings.find((el) => (el.textContent ?? "").trim().toLowerCase() === heading);
  if (!match) return null;
  // The section content lives in a shared ancestor with the heading — walk up to the nearest
  // <section>, falling back to a bounded ancestor walk if LinkedIn doesn't use <section> here.
  const section = match.closest("section");
  if (section) return section;
  let node: HTMLElement | null = match.parentElement;
  let depth = 0;
  while (node && depth < 6) {
    if (node.parentElement && node.parentElement.children.length <= 3) return node;
    node = node.parentElement;
    depth++;
  }
  return match.parentElement;
}

/**
 * The profile name heading. Confirmed live: LinkedIn does not consistently use `<h1>` for
 * this — a real profile page renders it as the first `<h2>` inside `<main>` instead (`<h1>`
 * absent from the page entirely). Section headings ("About", "Experience", …) are also
 * `<h2>`s further down the page, so "first heading inside main" still reliably resolves to
 * the name specifically, by document order.
 */
function findIdentityHeading(main: HTMLElement): HTMLElement | null {
  return main.querySelector<HTMLElement>("h1") ?? main.querySelector<HTMLElement>("h2");
}

function extractName(main: HTMLElement): string | undefined {
  const heading = findIdentityHeading(main);
  return heading ? visibleText(heading) : undefined;
}

const MAX_IDENTITY_CARD_WALK = 12;
/** An upper bound on how much text a legitimate "top card" (name, headline, location,
 * follower count, connect/follow buttons) can plausibly contain — past this, an ancestor has
 * almost certainly widened out to the rest of the page. */
const MAX_IDENTITY_CARD_TEXT_LENGTH = 3000;

/**
 * The name heading's closest ANCESTOR that contains more than just the name — the headline,
 * location, and follower count live here. Confirmed live this is NOT reliably `.closest
 * ("section")`: on a real profile page, the nearest actual `<section>` ancestor turned out to
 * be a much larger, unrelated wrapper (28k+ characters — most of the page), while the true
 * top-card boundary was a plain `<div>` several levels further up from the heading than any
 * `<section>` landmark. Walking up until text grows meaningfully past the name alone finds
 * that real boundary regardless of which element type LinkedIn wraps it in.
 */
function findIdentityCardContainer(heading: HTMLElement): HTMLElement | null {
  const nameLength = (heading.textContent ?? "").trim().length;
  let node: HTMLElement | null = heading.parentElement;
  let depth = 0;
  while (node && depth < MAX_IDENTITY_CARD_WALK) {
    const textLength = (node.textContent ?? "").trim().length;
    if (textLength > nameLength + 15 && textLength < MAX_IDENTITY_CARD_TEXT_LENGTH) return node;
    node = node.parentElement;
    depth++;
  }
  return heading.parentElement;
}

/** The headline sits just below the name, as a short (non-list, non-button) text block —
 * distinguished from surrounding chrome by being plain text without interactive children. */
function extractHeadline(main: HTMLElement): string | undefined {
  const heading = findIdentityHeading(main);
  if (!heading) return undefined;
  const container = findIdentityCardContainer(heading);
  if (!container) return undefined;

  const name = extractName(main);
  // Confirmed live: LinkedIn renders the headline/location text in `<p>` elements here, not
  // consistently `<div>`/`<span>` — include all three rather than assuming one tag.
  const candidates = Array.from(container.querySelectorAll<HTMLElement>("div, span, p"));
  for (const el of candidates) {
    if (el.querySelector("h1, h2, button, a, ul, li")) continue;
    const text = visibleText(el);
    if (text && text.length >= 3 && text.length <= 220 && text !== name) {
      return text;
    }
  }
  return undefined;
}

function extractLocation(main: HTMLElement, headline: string | undefined): string | undefined {
  const heading = findIdentityHeading(main);
  if (!heading) return undefined;
  const container = findIdentityCardContainer(heading);
  if (!container) return undefined;

  const candidates = Array.from(container.querySelectorAll<HTMLElement>("span, p"));
  for (const el of candidates) {
    const text = visibleText(el);
    if (!text || text === headline || text.length > 100) continue;
    // A location line is short and typically contains a comma or a recognizable geo pattern
    // ("City, State", "City, Country", "Area") — a conservative, non-overfit heuristic rather
    // than a hardcoded list of place names.
    if (/,/.test(text) || /\barea\b/i.test(text)) return text;
  }
  return undefined;
}

function extractAbout(main: HTMLElement): string | undefined {
  const section = findHeadingSection(main, "about");
  if (!section) return undefined;

  // The body text's own wrapping element varies (a bare `<span>`, sometimes with
  // `aria-hidden="true"`, sometimes without) — rather than depend on one exact shape,
  // take the section's full text and strip the heading's own "About" prefix from it,
  // which works regardless of how the body itself is wrapped.
  const heading = Array.from(section.querySelectorAll<HTMLElement>("h2, h3")).find(
    (h) => (h.textContent ?? "").trim().toLowerCase() === "about",
  );
  const headingText = (heading?.textContent ?? "").trim();
  let text = (section.textContent ?? "").trim();
  if (headingText && text.startsWith(headingText)) {
    text = text.slice(headingText.length);
  }
  return cleanText(text.replace(/…\s*see more/i, ""));
}

/** Strips a section's own heading text from its full text content — the same technique
 * `extractAbout` uses, factored out since Experience/Education need it too. */
function sectionBodyText(section: HTMLElement, headingLabel: string): string | undefined {
  const heading = Array.from(section.querySelectorAll<HTMLElement>("h2, h3")).find(
    (h) => (h.textContent ?? "").trim().toLowerCase() === headingLabel,
  );
  const headingText = (heading?.textContent ?? "").trim();
  let text = (section.textContent ?? "").trim();
  if (headingText && text.startsWith(headingText)) {
    text = text.slice(headingText.length);
  }
  return cleanText(text.replace(/…\s*(see more|more)/gi, ""));
}

/**
 * Each experience entry is, in principle, a repeated list item — but confirmed live across
 * multiple real profiles, current LinkedIn does not render Experience as `<li>`/`<ul>` at
 * all, just deeply nested, unlabeled `<div>`s with no reusable structural signal to split
 * multiple roles apart. Rather than guess at fragile per-entry boundaries and risk silently
 * dropping real content, the whole section's text becomes ONE entry's `description` — every
 * word is preserved (and searchable by the matcher) even though per-role fields aren't
 * separated. `<li>`-based extraction is tried first and preferred when a page does provide it.
 */
function extractExperience(main: HTMLElement): ProfileExperienceEntry[] {
  const section = findHeadingSection(main, "experience");
  if (!section) return [];

  const items = Array.from(section.querySelectorAll<HTMLElement>("li"));
  if (items.length > 0) {
    const entries: ProfileExperienceEntry[] = [];
    for (const item of items) {
      const textLines = Array.from(item.querySelectorAll<HTMLElement>("span[aria-hidden='true'], div, span"))
        .map((el) => visibleText(el))
        .filter((text): text is string => Boolean(text));
      const unique = [...new Set(textLines)];
      if (unique.length === 0) continue;

      const [title, company, ...rest] = unique;
      const description = rest.find((line) => line.length > 40);
      const entry: ProfileExperienceEntry = {
        title: cleanText(title),
        company: cleanText(company),
        description: cleanText(description),
      };
      if (entry.title || entry.company || entry.description) entries.push(entry);
    }
    if (entries.length > 0) return entries;
  }

  const body = sectionBodyText(section, "experience");
  return body ? [{ description: body }] : [];
}

function extractEducation(main: HTMLElement): ProfileEducationEntry[] {
  const section = findHeadingSection(main, "education");
  if (!section) return [];

  const items = Array.from(section.querySelectorAll<HTMLElement>("li"));
  if (items.length > 0) {
    const entries: ProfileEducationEntry[] = [];
    for (const item of items) {
      const textLines = Array.from(item.querySelectorAll<HTMLElement>("span[aria-hidden='true'], div, span"))
        .map((el) => visibleText(el))
        .filter((text): text is string => Boolean(text));
      const unique = [...new Set(textLines)];
      if (unique.length === 0) continue;

      const [school, degreeAndField] = unique;
      const entry: ProfileEducationEntry = {
        school: cleanText(school),
        degree: cleanText(degreeAndField),
      };
      if (entry.school || entry.degree) entries.push(entry);
    }
    if (entries.length > 0) return entries;
  }

  const body = sectionBodyText(section, "education");
  return body ? [{ school: body }] : [];
}

/** Confirmed live: a compact "Top skills" widget (a `<p>` label, not an `h2`/`h3` section
 * heading) commonly appears near the top of a profile, listing a few skills separated by "•"
 * — often present even when no full "Skills" section has loaded/exists at all. Checked first
 * since it is the more commonly available source; a full "Skills" section (when present) is
 * merged in alongside it, deduplicated. */
function extractTopSkillsWidget(main: HTMLElement): string[] {
  const label = Array.from(main.querySelectorAll<HTMLElement>("p")).find(
    (p) => (p.textContent ?? "").trim().toLowerCase() === "top skills",
  );
  if (!label) return [];
  const container = label.parentElement?.parentElement ?? label.parentElement;
  if (!container) return [];

  const text = (container.textContent ?? "").trim();
  const withoutLabel = text.startsWith("Top skills") ? text.slice("Top skills".length) : text;
  const skills: string[] = [];
  for (const part of withoutLabel.split("•")) {
    const cleaned = cleanText(part);
    if (cleaned && cleaned.length < 60) skills.push(cleaned);
  }
  return skills;
}

function extractSkills(main: HTMLElement): string[] {
  const skills: string[] = [...extractTopSkillsWidget(main)];

  const section = findHeadingSection(main, "skills");
  if (section) {
    const items = Array.from(section.querySelectorAll<HTMLElement>("li"));
    if (items.length > 0) {
      for (const item of items) {
        const text = visibleText(item.querySelector<HTMLElement>("span[aria-hidden='true']") ?? item);
        if (text && text.length < 60) skills.push(text);
      }
    } else {
      const body = sectionBodyText(section, "skills");
      if (body) {
        for (const part of body.split(/[•,]/)) {
          const cleaned = cleanText(part);
          if (cleaned && cleaned.length < 60) skills.push(cleaned);
        }
      }
    }
  }

  return [...new Set(skills)];
}

/** Reads the currently-rendered LinkedIn profile page. Never throws — a page that isn't a
 * profile, or hasn't finished rendering yet, simply yields fields that are all undefined
 * (`extracted: false`), never a guessed/partial value presented as real. */
export function extractLinkedInProfile(doc: Document = document): LinkedInProfile {
  const main = findMain(doc);
  const name = extractName(main);
  const headline = extractHeadline(main);
  const location = extractLocation(main, headline);
  const about = extractAbout(main);
  const experience = extractExperience(main);
  const education = extractEducation(main);
  const skills = extractSkills(main);

  const extracted = Boolean(name || headline);
  if (!extracted) return { ...EMPTY_PROFILE };

  return { name, headline, location, about, experience, education, skills, extracted };
}
