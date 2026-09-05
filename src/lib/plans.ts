// Subscription model for SchoolMaster.
//
// Pricing is driven by the school's STUDENT COUNT tier. All features are
// included in every tier — the only paid add-on is Transport.
//
// This file is the single source of truth for pricing and gating.

export type PlanId = "moins-100" | "100-250" | "plus-250";

/**
 * Kept for backward compatibility with nav items / checklist steps.
 * Only "transport" is actually gated now; every other feature is included
 * in every tier.
 */
export type FeatureId =
  | "students" | "classes" | "grades" | "bulletins" | "fees" | "payments"
  | "attendance" | "parent_portal" | "announcements" | "timetable" | "calendar"
  | "accounting" | "budget" | "personnel" | "extra_roles" | "transport";

export interface PlanConfig {
  id: PlanId;
  label: string;
  /** Short description of the student range. */
  range: string;
  priceFcfa: number;
  /** Max active students. Infinity = unlimited. */
  maxStudents: number;
  /** UI tone (matches design tokens) */
  tone: "teal" | "blue" | "orange";
}

export const PLAN_CONFIG: Record<PlanId, PlanConfig> = {
  "moins-100": {
    id: "moins-100", label: "Moins de 100", range: "< 100 élèves",
    priceFcfa: 90000, maxStudents: 99, tone: "teal",
  },
  "100-250": {
    id: "100-250", label: "100 à 250", range: "100 à 250 élèves",
    priceFcfa: 180000, maxStudents: 250, tone: "blue",
  },
  "plus-250": {
    id: "plus-250", label: "Plus de 250", range: "> 250 élèves",
    priceFcfa: 300000, maxStudents: Number.POSITIVE_INFINITY, tone: "orange",
  },
};

export const PLAN_LIST: PlanConfig[] = [
  PLAN_CONFIG["moins-100"], PLAN_CONFIG["100-250"], PLAN_CONFIG["plus-250"],
];

export const PLAN_IDS: PlanId[] = PLAN_LIST.map((p) => p.id);

/** The only paid add-on. */
export const TRANSPORT_ADDON = {
  id: "transport" as const,
  label: "Option Transport",
  priceFcfa: 60000,
};

/**
 * Normalizes any stored plan value (incl. legacy tiers) to a current tier id.
 * Unknown/legacy values fall back to the unlimited tier so that no existing
 * school is ever accidentally blocked from adding students.
 */
export function normalizePlanId(id?: string | null): PlanId {
  if (id === "moins-100" || id === "100-250" || id === "plus-250") return id;
  return "plus-250";
}

export function getPlan(id?: string | null): PlanConfig {
  return PLAN_CONFIG[normalizePlanId(id)];
}

/** Smallest tier that can host the given number of students. */
export function tierForStudentCount(n: number): PlanId {
  if (n < 100) return "moins-100";
  if (n <= 250) return "100-250";
  return "plus-250";
}

export const FEATURE_LABELS: Record<FeatureId, string> = {
  students: "Élèves", classes: "Classes", grades: "Notes", bulletins: "Bulletins",
  fees: "Frais", payments: "Paiements", attendance: "Présences",
  parent_portal: "Espace parent", announcements: "Annonces",
  timetable: "Emploi du temps", calendar: "Calendrier",
  accounting: "Comptabilité", budget: "Budget", personnel: "Personnel & Paie",
  extra_roles: "Rôles Secrétaire & Comptable",
  transport: "Transport",
};

/** Everything included in every tier (Transport excluded — it's an add-on). */
export const INCLUDED_FEATURES: FeatureId[] = [
  "students", "classes", "grades", "bulletins", "fees", "payments",
  "attendance", "parent_portal", "announcements", "timetable", "calendar",
  "accounting", "budget", "personnel", "extra_roles",
];

export const WINTEK_CONTACT = {
  /** Primary line. */
  phone: "+237 690 72 23 16",
  /** Secondary line. */
  phone2: "+237 675 86 72 45",
  /** Both lines, ready to display. */
  phones: "+237 690 72 23 16 / +237 675 86 72 45",
  email: "wintek2021@gmail.com",
};
