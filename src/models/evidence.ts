// The structured evidence layer sits between raw profile text (models/profile.ts) and
// criterion matching (matching/semanticMatcher.ts) — every piece of evidence keeps its source
// section and original text so any claim shown to the user can be traced back to something
// real on the page. Nothing here is inferred beyond what the source text actually supports
// (see evidence/conceptGraph.ts for how domain/role are detected).
import type { ProfileSectionName } from "./profile";

/** How strongly a criterion is supported by the profile's evidence — a five-way classification
 * rather than true/false, so "closely related but not a direct match" (Moderate) and
 * "the data needed to judge this was never available" (Unknown) are never conflated with a
 * confirmed absence (Missing). */
export type EvidenceStrength = "strong" | "moderate" | "weak" | "missing" | "unknown";

export const EVIDENCE_STRENGTH_LABELS: Record<EvidenceStrength, string> = {
  strong: "Strong",
  moderate: "Moderate",
  weak: "Weak",
  missing: "Missing",
  unknown: "Unknown",
};

/** One piece of text pulled from the profile, tagged with which section it came from and
 * which domain concept(s)/role level it was found to support (see conceptGraph.ts) — the
 * source and sourceText a UI claim like "Strong engineering background" must be able to show. */
export interface EvidenceItem {
  text: string;
  sourceSection: ProfileSectionName | "headline" | "location";
  /** Canonical domain concept ids this text touches (see conceptGraph.ts's DOMAIN_CONCEPTS) —
   * empty when the text doesn't match any recognized domain. */
  domains: string[];
  /** The strongest role level this text demonstrates, on conceptGraph.ts's ROLE_LEVELS ladder
   * (0 = no signal, higher = deeper engagement: interested < learning < participant <
   * experienced < leader/mentor). Section context sets a default (e.g. "Experience" entries
   * default to the "experienced" level) which explicit language in the text can raise further
   * (e.g. "founded", "led", "mentored") — never lowered below the section's own default. */
  roleLevel: number;
}

/** A normalized, categorized view of everything `buildProfileEvidence` found — the categories
 * are how the Analysis screen groups strengths/gaps for display; criterion matching itself
 * scans `all`, which is the same items deduplicated into one flat list. */
export interface ProfileEvidence {
  roles: EvidenceItem[];
  companies: EvidenceItem[];
  education: EvidenceItem[];
  fieldsOfStudy: EvidenceItem[];
  skills: EvidenceItem[];
  projects: EvidenceItem[];
  organizations: EvidenceItem[];
  leadership: EvidenceItem[];
  mentoring: EvidenceItem[];
  competitions: EvidenceItem[];
  locations: EvidenceItem[];
  languages: EvidenceItem[];
  interests: EvidenceItem[];
  accomplishments: EvidenceItem[];
  all: EvidenceItem[];
  /** Which profile sections had any content at all when this was built — the basis for
   * telling "confirmed absent" (section present, nothing relevant found in it) apart from
   * "unknown" (the section was never collected/found at all). */
  sectionsWithContent: Set<ProfileSectionName | "headline" | "location">;
}

/** A traceable claim shown to the user — every strength, gap, or summary sentence LinkWise
 * displays must be backed by one of these, never free-floating prose. */
export interface EvidenceClaim {
  claim: string;
  strength: EvidenceStrength;
  sourceSection: ProfileSectionName | "headline" | "location" | null;
  sourceText: string | null;
}
