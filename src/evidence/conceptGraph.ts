// A small, hand-curated concept graph — this is what makes evidence classification "semantic"
// without a neural embedding model (see the milestone's own bundle-size/perf benchmark, noted
// in scoreProfile.ts's module doc comment, for why one wasn't added). Two independent axes:
//
//   DOMAIN  — what field/topic is this text about (engineering, software, robotics, ...)?
//             Detected by alias matching, same table used for both profile evidence and
//             criterion parsing so the two vocabularies can never drift apart.
//   ROLE LEVEL — how deeply engaged is the person with whatever domain applies (an ordered
//             ladder: interested < learning < participant < experienced < leader/mentor)?
//             Section context sets a default; explicit language in the text can raise it
//             further, never lower it below the section's own baseline (with one deliberate
//             exception: an explicit "student" self-description overrides a generic section
//             default, since a headline default should never outrank someone plainly saying
//             they're a student).
//
// This pair is exactly what lets the matcher distinguish "participated vs led", "member vs
// mentor", "student vs professional" — the concept-distinction rules the milestone explicitly
// calls for — as simple, explainable comparisons instead of trusting a similarity score alone
// to preserve those distinctions.
import type { ProfileSectionName } from "../models/profile";

export const ROLE_LEVEL = {
  NONE: 0,
  INTERESTED: 1,
  LEARNER: 2,
  PARTICIPANT: 3,
  PROFESSIONAL: 4,
  LEADER: 5,
} as const;

export type RoleLevelName = keyof typeof ROLE_LEVEL;

/** The baseline role level implied merely by WHERE a piece of text was found, before any
 * word-level signal in the text itself is considered — LinkedIn's own section semantics
 * ("Experience" = jobs held, "Education" = formal study) are real, honest signal. */
const SECTION_DEFAULT_ROLE_LEVEL: Partial<Record<ProfileSectionName | "headline" | "location", number>> = {
  about: ROLE_LEVEL.INTERESTED,
  experience: ROLE_LEVEL.PROFESSIONAL,
  education: ROLE_LEVEL.LEARNER,
  skills: ROLE_LEVEL.INTERESTED,
  projects: ROLE_LEVEL.LEARNER,
  certifications: ROLE_LEVEL.LEARNER,
  organizations: ROLE_LEVEL.PARTICIPANT,
  volunteering: ROLE_LEVEL.PARTICIPANT,
  headline: ROLE_LEVEL.PARTICIPANT,
  languages: ROLE_LEVEL.NONE,
  location: ROLE_LEVEL.NONE,
};

export function wordBoundaryMatches(lowerText: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(lowerText);
}

export function matchesAny(lowerText: string, phrases: string[]): boolean {
  return phrases.some((phrase) => wordBoundaryMatches(lowerText, phrase));
}

/** An explicit self-description as a student overrides a generic section default (mainly
 * "headline", which otherwise defaults to PARTICIPANT) — someone whose headline says "Computer
 * Science Student" is a student, not "participant tier". Not applied to "experience" entries:
 * describing OR teaching students there is real work (e.g. a teaching assistant role), not
 * evidence the profile's OWNER is a student. */
const STUDENT_SELF_DESCRIPTION = ["student", "studying", "undergraduate", "undergrad"];

/** Leadership/mentoring language — the strongest role signal, and detected the same way
 * regardless of which section it appears in, since genuinely leading or mentoring is leading
 * or mentoring whether it happened at a job, in a club, or as a volunteer. */
export const LEADER_WORDS = [
  "led",
  "lead",
  "leading",
  "founder",
  "founded",
  "co-founder",
  "president",
  "captain",
  "director",
  "mentor",
  "mentored",
  "mentoring",
  "coach",
  "coached",
  "coaching",
  "advisor",
  "advised",
  "chief",
  "chairman",
  "chairwoman",
  "chairperson",
  "vice president",
  "principal investigator",
  "tutor",
  "tutored",
  "tutoring",
  "managed",
  "management",
  "supervisor",
  "supervised",
];

/** Professional/employment language — real workplace engagement. Excluded from "education"
 * entries specifically, since a degree titled "Software Engineering" is a field of study, not
 * a job title, even though it contains the same word a real job title would. */
export const PROFESSIONAL_WORDS = [
  "engineer",
  "developer",
  "programmer",
  "scientist",
  "analyst",
  "designer",
  "consultant",
  "specialist",
  "employed",
  "worked as",
  "intern",
  "internship",
  "full-time",
  "part-time",
  "professional",
];
const PROFESSIONAL_WORDS_EXCLUDED_SECTIONS = new Set<ProfileSectionName | "headline" | "location">(["education"]);

/** Formal-learning language — degrees, coursework, enrollment. */
export const LEARNER_WORDS = [
  "student",
  "studying",
  "coursework",
  "b.s.",
  "bs ",
  "m.s.",
  "ms ",
  "bachelor",
  "master",
  "ph.d",
  "phd",
  "candidate",
  "pursuing",
  "degree",
];

/** Mere interest/enthusiasm — the weakest real signal, still worth distinguishing from nothing
 * at all. */
export const INTERESTED_WORDS = ["interested in", "aspiring", "passionate about", "enthusiast", "hobby"];

function boostFromWordLists(lowerText: string, section: ProfileSectionName | "headline" | "location"): number {
  let boost: number = ROLE_LEVEL.NONE;
  if (matchesAny(lowerText, LEADER_WORDS)) boost = Math.max(boost, ROLE_LEVEL.LEADER);
  if (!PROFESSIONAL_WORDS_EXCLUDED_SECTIONS.has(section) && matchesAny(lowerText, PROFESSIONAL_WORDS)) {
    boost = Math.max(boost, ROLE_LEVEL.PROFESSIONAL);
  }
  if (matchesAny(lowerText, LEARNER_WORDS)) boost = Math.max(boost, ROLE_LEVEL.LEARNER);
  if (matchesAny(lowerText, INTERESTED_WORDS)) boost = Math.max(boost, ROLE_LEVEL.INTERESTED);
  return boost;
}

/** The role level a piece of evidence text demonstrates, given which section it came from. */
export function detectRoleLevel(text: string, section: ProfileSectionName | "headline" | "location"): number {
  const lower = text.toLowerCase();

  if (section !== "experience" && matchesAny(lower, STUDENT_SELF_DESCRIPTION)) {
    // Still let genuine leadership language in the same text win out (e.g. "Student body
    // president" is a real leadership role, not merely a student).
    return Math.max(ROLE_LEVEL.LEARNER, matchesAny(lower, LEADER_WORDS) ? ROLE_LEVEL.LEADER : ROLE_LEVEL.NONE);
  }

  const sectionDefault = SECTION_DEFAULT_ROLE_LEVEL[section] ?? ROLE_LEVEL.PARTICIPANT;
  return Math.max(sectionDefault, boostFromWordLists(lower, section));
}

/** One recognized domain/field concept: a canonical id plus every phrase that indicates it.
 * Shared by both evidence extraction (what does this profile text touch on?) and criterion
 * parsing (what is this criterion actually asking about?) — the same vocabulary on both sides
 * is what lets "Mechanical Engineering" satisfy "engineering background" without the two
 * needing to share a single literal word. Order matters only in that longer/more specific
 * aliases should be listed so multi-word phrases aren't shadowed by a shorter one — matching
 * itself checks every alias independently, so this is a robustness note, not a hard rule. */
export interface DomainConcept {
  id: string;
  aliases: string[];
}

export const DOMAIN_CONCEPTS: DomainConcept[] = [
  {
    // Deliberately excludes the bare word "engineer" — that's a profession-noun (see
    // PROFESSIONAL_WORDS), not a domain by itself. Including it here would make "software
    // engineer" falsely cross-match "Mechanical Engineering" evidence via this domain, purely
    // because both contain the word "engineer".
    id: "engineering",
    aliases: [
      "engineering",
      "mechanical engineering",
      "electrical engineering",
      "civil engineering",
      "aerospace engineering",
      "chemical engineering",
      "industrial engineering",
      "biomedical engineering",
    ],
  },
  {
    id: "software",
    aliases: [
      "software",
      "software engineering",
      "computer science",
      "programming",
      "coding",
      "developer",
      "full stack",
      "backend",
      "frontend",
      "web development",
      "app development",
    ],
  },
  {
    id: "robotics",
    aliases: ["robotics", "robot", "frc", "first robotics", "vex robotics", "vex", "ftc"],
  },
  {
    id: "data_science",
    aliases: [
      "data science",
      "machine learning",
      "artificial intelligence",
      " ai ",
      "deep learning",
      "data analysis",
      "data analytics",
      "neural network",
    ],
  },
  { id: "business", aliases: ["business", "management", "marketing", "sales", "entrepreneurship", "startup"] },
  { id: "finance", aliases: ["finance", "financial", "accounting", "investment", "banking"] },
  { id: "education", aliases: ["teaching", "tutoring", "education", "instructor", "curriculum"] },
  { id: "healthcare", aliases: ["healthcare", "medicine", "medical", "clinical", "nursing", "biomedical"] },
  { id: "science", aliases: ["biology", "chemistry", "physics", "research", "laboratory", "scientific"] },
  { id: "design", aliases: ["design", "ux", "ui", "graphic design", "product design"] },
  { id: "law", aliases: ["law", "legal", "paralegal", "attorney"] },
];

export function detectDomains(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const found: string[] = [];
  for (const concept of DOMAIN_CONCEPTS) {
    if (concept.aliases.some((alias) => wordBoundaryMatches(lower, alias))) found.push(concept.id);
  }
  return found;
}
