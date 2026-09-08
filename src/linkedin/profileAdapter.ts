// The ONE file that queries LinkedIn's own DOM for the profile surface. Every other module
// (matching, storage, UI) works only with the LinkedInProfile type this file produces — never
// with a LinkedIn selector directly — so the place that has to change when LinkedIn's markup
// changes stays exactly one file.
//
// Reads only what is already rendered on the current page. Never fetches another page, never
// expands a collapsed section by itself, never reads anything the user hasn't already
// navigated to and had LinkedIn render for them.
import {
  EMPTY_PROFILE,
  type LinkedInProfile,
  type ProfileEducationEntry,
  type ProfileExperienceEntry,
  type ProfileProjectEntry,
} from "../models/profile";

const SECTION_HEADINGS = ["about", "experience", "education", "skills", "projects"] as const;
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

/** Headings are queried once by the caller and passed in here — five separate full-subtree
 * traversals (one per section) visibly degraded page responsiveness when extraction ran
 * repeatedly on every scroll/mutation tick. */
function findHeadingSection(headings: HTMLElement[], heading: SectionName): HTMLElement | null {
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

/** The profile name heading. LinkedIn doesn't consistently render an `<h1>` here — the name is
 * often the first `<h2>` inside `<main>`, with section headings ("About", "Experience", …)
 * further down, so "first heading inside main" still resolves to the name by document order. */
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

/** The name heading's closest ancestor that also contains the headline/location/follower count.
 * Not reliably `.closest("section")` — on a real profile page that resolved to a much larger,
 * unrelated wrapper (most of the page), while the true top-card boundary was a plain `<div>`
 * further up. Walking up until text grows meaningfully past the name alone finds that boundary
 * regardless of element type. */
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
  // LinkedIn doesn't consistently use one tag here — check div/span/p rather than assume.
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

function extractAbout(headings: HTMLElement[]): string | undefined {
  const section = findHeadingSection(headings, "about");
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

/** Current LinkedIn often doesn't render Experience as `<li>`/`<ul>` at all, just unlabeled
 * nested `<div>`s with no reliable boundary between roles — in that case the whole section's
 * text becomes one entry's `description` rather than guessing at fragile per-entry splits.
 * `<li>`-based extraction is tried first and preferred when a page does provide it. */
function extractExperience(headings: HTMLElement[]): ProfileExperienceEntry[] {
  const section = findHeadingSection(headings, "experience");
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

function extractEducation(headings: HTMLElement[]): ProfileEducationEntry[] {
  const section = findHeadingSection(headings, "education");
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

/** Same "try `<li>` first, fall back to the section's blob text" shape as Experience/Education
 * — projects render identically inconsistently across profiles. */
function extractProjects(headings: HTMLElement[]): ProfileProjectEntry[] {
  const section = findHeadingSection(headings, "projects");
  if (!section) return [];

  const items = Array.from(section.querySelectorAll<HTMLElement>("li"));
  if (items.length > 0) {
    const entries: ProfileProjectEntry[] = [];
    for (const item of items) {
      const textLines = Array.from(item.querySelectorAll<HTMLElement>("span[aria-hidden='true'], div, span"))
        .map((el) => visibleText(el))
        .filter((text): text is string => Boolean(text));
      const unique = [...new Set(textLines)];
      if (unique.length === 0) continue;

      const [name, ...rest] = unique;
      const description = rest.find((line) => line.length > 20);
      const entry: ProfileProjectEntry = { name: cleanText(name), description: cleanText(description) };
      if (entry.name || entry.description) entries.push(entry);
    }
    if (entries.length > 0) return entries;
  }

  const body = sectionBodyText(section, "projects");
  return body ? [{ description: body }] : [];
}

/** A compact "Top skills" widget (a `<p>` label, not an `h2`/`h3` heading) often appears near
 * the top of a profile, listing a few skills separated by "•", even when no full "Skills"
 * section exists — checked first since it's the more commonly available source; a full section
 * (when present) is merged in alongside it, deduplicated. */
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

function extractSkills(main: HTMLElement, headings: HTMLElement[]): string[] {
  const skills: string[] = [...extractTopSkillsWidget(main)];

  const section = findHeadingSection(headings, "skills");
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

  // Queried once and reused by every section lookup below — see findHeadingSection's doc
  // comment for why this matters when extraction runs repeatedly on scroll/mutation ticks.
  const headings = Array.from(main.querySelectorAll<HTMLElement>("h2, h3"));
  const about = extractAbout(headings);
  const experience = extractExperience(headings);
  const education = extractEducation(headings);
  const skills = extractSkills(main, headings);
  const projects = extractProjects(headings);

  const extracted = Boolean(name || headline);
  if (!extracted) return { ...EMPTY_PROFILE };

  return { name, headline, location, about, experience, education, skills, projects, extracted };
}

/**
 * A stable identity for "which profile is this" — the `/in/<vanity-slug>/` path segment,
 * never the full URL (which can carry volatile tracking query params that change between
 * visits to the SAME person). Used to detect a genuine navigation to a DIFFERENT profile
 * (reset collection state) versus more content loading on the SAME one (keep accumulating).
 * Returns `null` when the current URL isn't a profile page at all.
 */
export function profileIdentityKey(url: string): string | null {
  const match = /\/in\/([^/?#]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}
