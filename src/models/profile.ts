// A LinkedIn profile as read directly from the currently-rendered page — never fetched,
// scraped from another page, or invented. Every field is optional because the adapter only
// ever reports what it actually found; a field being absent means "not visible on this
// profile as currently rendered," never "confirmed empty."

export interface ProfileExperienceEntry {
  title?: string;
  company?: string;
  description?: string;
}

export interface ProfileEducationEntry {
  school?: string;
  degree?: string;
  field?: string;
}

/** A generic named/described entry — used for the several profile sections (Projects,
 * Certifications, Organizations, Volunteering) that all render as either a list of short
 * "name + optional description" items or, when LinkedIn doesn't expose per-item structure,
 * one blob of section text. */
export interface ProfileListEntry {
  name?: string;
  description?: string;
}

export type ProfileProjectEntry = ProfileListEntry;
export type ProfileCertificationEntry = ProfileListEntry;
export type ProfileOrganizationEntry = ProfileListEntry;
export type ProfileVolunteeringEntry = ProfileListEntry;

/** Every section the adapter knows how to look for — used purely for progress display (“About
 * found, still watching for Education”), never to demand a profile contain all of them. A
 * profile missing a section here is simply a profile without that section, not an error.
 * Deliberately excludes identity fields (headline, location) that live in the top card rather
 * than a real LinkedIn "section" with its own heading. */
export type ProfileSectionName =
  | "about"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "organizations"
  | "volunteering";

export const ALL_PROFILE_SECTIONS: ProfileSectionName[] = [
  "about",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "organizations",
  "volunteering",
];

export interface LinkedInProfile {
  name?: string;
  headline?: string;
  location?: string;
  about?: string;
  experience: ProfileExperienceEntry[];
  education: ProfileEducationEntry[];
  skills: string[];
  projects: ProfileProjectEntry[];
  certifications: ProfileCertificationEntry[];
  organizations: ProfileOrganizationEntry[];
  volunteering: ProfileVolunteeringEntry[];
  /**
   * True once the adapter found at least a name or headline on the page — lets callers tell
   * "this is a real, at-least-partially-read profile" apart from "nothing could be read at
   * all" (e.g. the page hasn't finished rendering yet, or isn't a profile page).
   */
  extracted: boolean;
}

export const EMPTY_PROFILE: LinkedInProfile = {
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  organizations: [],
  volunteering: [],
  extracted: false,
};

/** Which known sections actually have content in this profile snapshot right now — the basis
 * for honest collection-progress display. Never implies a section that's absent is "missing
 * information"; some profiles genuinely have no Projects section, for example. */
export function foundSections(profile: LinkedInProfile): ProfileSectionName[] {
  const found: ProfileSectionName[] = [];
  if (profile.about) found.push("about");
  if (profile.experience.length > 0) found.push("experience");
  if (profile.education.length > 0) found.push("education");
  if (profile.skills.length > 0) found.push("skills");
  if (profile.projects.length > 0) found.push("projects");
  if (profile.certifications.length > 0) found.push("certifications");
  if (profile.organizations.length > 0) found.push("organizations");
  if (profile.volunteering.length > 0) found.push("volunteering");
  return found;
}

/** Every text field of a profile that matching is allowed to search, paired with a
 * human-readable label used in evidence — the single source of truth for "where can a
 * criterion's evidence come from," so the matcher and any future field never drift apart. */
export interface ProfileTextField {
  label: string;
  text: string;
}

export function profileTextFields(profile: LinkedInProfile): ProfileTextField[] {
  const fields: ProfileTextField[] = [];
  if (profile.headline) fields.push({ label: "Headline", text: profile.headline });
  if (profile.location) fields.push({ label: "Location", text: profile.location });
  if (profile.about) fields.push({ label: "About", text: profile.about });
  for (const entry of profile.experience) {
    const parts = [entry.title, entry.company, entry.description].filter(Boolean);
    if (parts.length > 0) {
      fields.push({
        label: `Experience${entry.title ? `: ${entry.title}` : ""}`,
        text: parts.join(" — "),
      });
    }
  }
  for (const entry of profile.education) {
    const parts = [entry.school, entry.degree, entry.field].filter(Boolean);
    if (parts.length > 0) {
      fields.push({ label: `Education${entry.school ? `: ${entry.school}` : ""}`, text: parts.join(" — ") });
    }
  }
  if (profile.skills.length > 0) {
    fields.push({ label: "Skills", text: profile.skills.join(", ") });
  }
  for (const entry of profile.projects) {
    const parts = [entry.name, entry.description].filter(Boolean);
    if (parts.length > 0) {
      fields.push({ label: `Project${entry.name ? `: ${entry.name}` : ""}`, text: parts.join(" — ") });
    }
  }
  for (const entry of profile.certifications) {
    const parts = [entry.name, entry.description].filter(Boolean);
    if (parts.length > 0) {
      fields.push({ label: `Certification${entry.name ? `: ${entry.name}` : ""}`, text: parts.join(" — ") });
    }
  }
  for (const entry of profile.organizations) {
    const parts = [entry.name, entry.description].filter(Boolean);
    if (parts.length > 0) {
      fields.push({ label: `Organization${entry.name ? `: ${entry.name}` : ""}`, text: parts.join(" — ") });
    }
  }
  for (const entry of profile.volunteering) {
    const parts = [entry.name, entry.description].filter(Boolean);
    if (parts.length > 0) {
      fields.push({ label: `Volunteering${entry.name ? `: ${entry.name}` : ""}`, text: parts.join(" — ") });
    }
  }
  return fields;
}
