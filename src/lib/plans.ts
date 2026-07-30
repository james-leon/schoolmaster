// Subscription plan definitions for SchoolMaster.
// Two tiers: Essentiel / Complet. Transport is bundled into Complet
// (there is no separate add-on anymore).
// This file is the single source of truth for pricing and feature gating.

export type PlanId = "essentiel" | "complet";

export type FeatureId =
  // Base features (Essentiel and up)
  | "students" | "classes" | "grades" | "bulletins" | "fees" | "payments"
  | "attendance" | "parent_portal" | "announcements" | "timetable" | "calendar"
  // Complet-only features
  | "accounting" | "budget" | "personnel" | "extra_roles" | "transport";

export interface PlanConfig {
  id: PlanId;
  label: string;
  priceFcfa: number;
  features: FeatureId[];
  /** UI tone (matches design tokens) */
  tone: "teal" | "blue" | "orange";
}

const ESSENTIEL_FEATURES: FeatureId[] = [
  "students", "classes", "grades", "bulletins", "fees", "payments",
  "attendance", "parent_portal", "announcements", "timetable", "calendar",
];
const COMPLET_ONLY_FEATURES: FeatureId[] = [
  "accounting", "budget", "personnel", "extra_roles", "transport",
];
const COMPLET_FEATURES: FeatureId[] = [...ESSENTIEL_FEATURES, ...COMPLET_ONLY_FEATURES];

export const PLAN_CONFIG: Record<PlanId, PlanConfig> = {
  essentiel: {
    id: "essentiel", label: "Essentiel", priceFcfa: 150000,
    features: ESSENTIEL_FEATURES, tone: "teal",
  },
  complet: {
    id: "complet", label: "Complet", priceFcfa: 300000,
    features: COMPLET_FEATURES, tone: "orange",
  },
};

export const PLAN_LIST: PlanConfig[] = [PLAN_CONFIG.essentiel, PLAN_CONFIG.complet];

/** Normalizes any stored plan value (incl. legacy tiers) to a current plan id. */
export function normalizePlanId(id?: string | null): PlanId {
  if (id === "essentiel" || id === "starter") return "essentiel";
  // Any other legacy plan (pro, school+, premium, …) collapses to Complet so
  // no school loses access.
  return "complet";
}

export function getPlan(id?: string | null): PlanConfig {
  return PLAN_CONFIG[normalizePlanId(id)];
}

/** Returns the plan that first unlocks a feature. */
export function requiredPlanFor(feature: FeatureId): PlanConfig {
  return PLAN_LIST.find((p) => p.features.includes(feature)) ?? PLAN_CONFIG.complet;
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

export const WINTEK_CONTACT = {
  phone: "+237 6 80 00 00 00",
  email: "contact@wintek.cm",
};
