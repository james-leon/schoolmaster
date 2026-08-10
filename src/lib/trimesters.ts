import type { AcademicYear } from "./types";
import { TERMS } from "./types";

/**
 * Single source of truth for REAL school trimester date ranges.
 * Replaces the old civil-quarter (getMonth()/3) assumption.
 *
 * Dates live on the current academic_years row (term1_start … term3_end).
 * When a school hasn't configured them, we fall back to sensible defaults
 * for a typical Cameroonian school year.
 */

export type TermIndex = 0 | 1 | 2;

export interface TrimesterRange {
  index: TermIndex;
  /** Matches the existing grades/séquences term labels ("1er trimestre", …). */
  term: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** School year starting year: Sept → Aug. September 2026 ⇒ 2026. */
export function schoolYearStartYear(date: Date = new Date()): number {
  return date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
}

/** Defaults: T1 Sept–Dec, T2 Jan–Mars, T3 Avr–Juil. */
export function defaultTrimesterRanges(startYear = schoolYearStartYear()): TrimesterRange[] {
  const y = startYear;
  const n = startYear + 1;
  return [
    { index: 0, term: TERMS[0], start: iso(y, 9, 1), end: iso(y, 12, 15) },
    { index: 1, term: TERMS[1], start: iso(n, 1, 5), end: iso(n, 3, 31) },
    { index: 2, term: TERMS[2], start: iso(n, 4, 1), end: iso(n, 7, 15) },
  ];
}

/** Picks the current academic year row (is_current, else the first one). */
export function currentAcademicYear(years: AcademicYear[] | undefined): AcademicYear | undefined {
  if (!years?.length) return undefined;
  return years.find((y) => y.isCurrent) ?? years[0];
}

/** Configured ranges for a school, falling back to defaults field by field. */
export function trimesterRanges(years?: AcademicYear[]): TrimesterRange[] {
  const ay = currentAcademicYear(years);
  const base = defaultTrimesterRanges(
    ay?.startDate ? schoolYearStartYear(new Date(ay.startDate + "T00:00:00")) : schoolYearStartYear()
  );
  if (!ay) return base;
  const pick = (v: string | undefined, fallback: string) => (v && v.length >= 10 ? v.slice(0, 10) : fallback);
  return [
    { ...base[0], start: pick(ay.term1Start, base[0].start), end: pick(ay.term1End, base[0].end) },
    { ...base[1], start: pick(ay.term2Start, base[1].start), end: pick(ay.term2End, base[1].end) },
    { ...base[2], start: pick(ay.term3Start, base[2].start), end: pick(ay.term3End, base[2].end) },
  ];
}

export interface ResolvedTrimester extends TrimesterRange {
  /** true when today is outside every range (vacation / between terms). */
  isFallback: boolean;
}

/**
 * Which trimester is "current" today?
 * - inside a range → that trimester
 * - outside all ranges → the most recently COMPLETED trimester (isFallback)
 * - before the first trimester → the first one (isFallback)
 */
export function resolveCurrentTrimester(
  ranges: TrimesterRange[],
  today: Date = new Date()
): ResolvedTrimester {
  const d = today.toISOString().slice(0, 10);
  const inside = ranges.find((r) => d >= r.start && d <= r.end);
  if (inside) return { ...inside, isFallback: false };
  const completed = [...ranges].filter((r) => r.end < d).sort((a, b) => (a.end < b.end ? 1 : -1))[0];
  return { ...(completed ?? ranges[0]), isFallback: true };
}

export function isWithin(dateStr: string | undefined, range: { start: string; end: string }): boolean {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  if (d.length < 10) return false;
  return d >= range.start && d <= range.end;
}

/** The trimester immediately preceding the given one (for trend comparisons). */
export function previousTrimester(
  ranges: TrimesterRange[],
  current: TrimesterRange
): TrimesterRange | undefined {
  if (current.index > 0) return ranges[current.index - 1];
  // Before T1 → same slot of the previous school year.
  const prev = defaultTrimesterRanges(
    schoolYearStartYear(new Date(current.start + "T00:00:00")) - 1
  );
  return prev[2];
}
