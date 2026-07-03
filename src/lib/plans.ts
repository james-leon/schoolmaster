// Subscription plan definitions for SchoolMaster.
// Two base plans (Essentiel / Pro) + one combinable add-on (Transport).
// This file is the single source of truth for pricing and feature gating.

export type PlanId = "essentiel" | "pro";
export type AddonId = "transport";

export type FeatureId =
  // Base features (Essentiel and up)
  | "students" | "classes" | "grades" | "bulletins" | "fees" | "payments"
  | "attendance" | "parent_portal" | "announcements" | "timetable" | "calendar"
  // Pro-only features
  | "accounting" | "budget" | "personnel" | "extra_roles"
  // Add-on
  | "transport";

export interface PlanConfig {
  id: PlanId;
  label: string;
  priceFcfa: number;
  features: FeatureId[];
  /** UI tone (matches design tokens) */
  tone: "teal" | "blue" | "orange";
}

export interface AddonConfig {
  id: AddonId;
  label: string;
  priceFcfa: number;
  features: FeatureId[];
}

const ESSENTIEL_FEATURES: FeatureId[] = [
  "students", "classes", "grades", "bulletins", "fees", "payments",
  "attendance", "parent_portal", "announcements", "timetable", "calendar",
];
const PRO_ONLY_FEATURES: FeatureId[] = [
  "accounting", "budget", "personnel", "extra_roles",
];
const PRO_FEATURES: FeatureId[] = [...ESSENTIEL_FEATURES, ...PRO_ONLY_FEATURES];

export const PLAN_CONFIG: Record<PlanId, PlanConfig> = {
  essentiel: {
    id: "essentiel", label: "Essentiel", priceFcfa: 50000,
    features: ESSENTIEL_FEATURES, tone: "teal",
  },
  pro: {
    id: "pro", label: "Pro", priceFcfa: 100000,
    features: PRO_FEATURES, tone: "orange",
  },
};

export const ADDON_CONFIG: Record<AddonId, AddonConfig> = {
  transport: {
    id: "transport", label: "Transport", priceFcfa: 40000,
    features: ["transport"],
  },
};

export const PLAN_LIST: PlanConfig[] = [PLAN_CONFIG.essentiel, PLAN_CONFIG.pro];

export function getPlan(id?: string | null): PlanConfig {
  if (id === "essentiel") return PLAN_CONFIG.essentiel;
  if (id === "pro") return PLAN_CONFIG.pro;
  // Any legacy plan (starter, school+, premium, …) collapses to Pro so no
  // school loses access before the migration runs.
  return PLAN_CONFIG.pro;
}

/** Returns the base plan that first unlocks a feature, or null if it's an add-on. */
export function requiredPlanFor(feature: FeatureId): PlanConfig {
  if (feature === "transport") {
    // Transport isn't part of any base plan — see addonRequiredFor().
    return PLAN_CONFIG.essentiel;
  }
  return PLAN_LIST.find((p) => p.features.includes(feature)) ?? PLAN_CONFIG.pro;
}

/** Returns the add-on required by a feature, if any. */
export function addonRequiredFor(feature: FeatureId): AddonConfig | null {
  if (feature === "transport") return ADDON_CONFIG.transport;
  return null;
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
