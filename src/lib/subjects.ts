import type { DB } from "./types";

/**
 * Base defaults surfaced when a school hasn't yet defined any subject
 * on a class. These names seed the unified list so newly created schools
 * immediately see sensible options in teacher and class dialogs.
 */
export const BASE_SUBJECTS = [
  "Français",
  "Mathématiques",
  "Anglais",
  "Sciences",
  "Histoire-Géographie",
  "Éveil",
  "Éducation Civique",
  "Éducation Physique",
] as const;

/**
 * SINGLE SOURCE OF TRUTH for the school's subjects list.
 *
 * The `class_subjects` table is per-school (each row hangs off a class,
 * which belongs to the school). We derive the unified subject catalogue
 * by taking the DISTINCT names across all class_subjects rows plus the
 * base defaults. Any subject created in Classes therefore instantly
 * appears in the teacher assignment dropdown, and vice versa.
 */
export function getSchoolSubjects(db: DB): string[] {
  const set = new Map<string, string>(); // lowercase key -> canonical display
  for (const s of BASE_SUBJECTS) set.set(s.toLowerCase(), s);
  for (const cs of db.classSubjects ?? []) {
    const name = (cs.name ?? "").trim();
    if (!name) continue;
    if (!set.has(name.toLowerCase())) set.set(name.toLowerCase(), name);
  }
  return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "fr"));
}
