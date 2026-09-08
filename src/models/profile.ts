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

export interface LinkedInProfile {
  name?: string;
  headline?: string;
  location?: string;
  about?: string;
  experience: ProfileExperienceEntry[];
  education: ProfileEducationEntry[];
  skills: string[];
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
  extracted: false,
};

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
  return fields;
}
