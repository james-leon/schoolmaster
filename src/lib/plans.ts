// Subscription plan definitions for SchoolMaster.
// Modify here to tune limits, prices or features.

export type PlanId = "starter" | "pro" | "school+";
export type FeatureId =
  | "students" | "classes" | "grades" | "bulletins" | "fees" | "payments" | "attendance"
  | "sms" | "parent_portal" | "announcements"
  | "multi_campus" | "advanced_reports" | "priority_support";

export interface PlanConfig {
  id: PlanId;
  label: string;
  priceFcfa: number;
  maxStudents: number;
  maxTeachers: number;
  features: FeatureId[];
  /** UI tone (matches design tokens) */
  tone: "teal" | "blue" | "orange";
}

const STARTER_FEATURES: FeatureId[] = [
  "students", "classes", "grades", "bulletins", "fees", "payments", "attendance",
];
const PRO_FEATURES: FeatureId[] = [
  ...STARTER_FEATURES, "sms", "parent_portal", "announcements",
];
const SCHOOL_PLUS_FEATURES: FeatureId[] = [
  ...PRO_FEATURES, "multi_campus", "advanced_reports", "priority_support",
];

export const PLAN_CONFIG: Record<PlanId, PlanConfig> = {
  starter: {
    id: "starter", label: "Starter", priceFcfa: 15000,
    maxStudents: 100, maxTeachers: 10,
    features: STARTER_FEATURES, tone: "teal",
  },
  pro: {
    id: "pro", label: "Pro", priceFcfa: 30000,
    maxStudents: 300, maxTeachers: 30,
    features: PRO_FEATURES, tone: "blue",
  },
  "school+": {
    id: "school+", label: "School+", priceFcfa: 55000,
    maxStudents: 999_999, maxTeachers: 999_999,
    features: SCHOOL_PLUS_FEATURES, tone: "orange",
  },
};

export const PLAN_LIST: PlanConfig[] = [PLAN_CONFIG.starter, PLAN_CONFIG.pro, PLAN_CONFIG["school+"]];

export function getPlan(id?: string | null): PlanConfig {
  if (id && id in PLAN_CONFIG) return PLAN_CONFIG[id as PlanId];
  return PLAN_CONFIG.starter;
}

/** Returns the smallest plan that includes a given feature. */
export function requiredPlanFor(feature: FeatureId): PlanConfig {
  return PLAN_LIST.find((p) => p.features.includes(feature)) ?? PLAN_CONFIG["school+"];
}

export const FEATURE_LABELS: Record<FeatureId, string> = {
  students: "Élèves", classes: "Classes", grades: "Notes", bulletins: "Bulletins",
  fees: "Frais", payments: "Paiements", attendance: "Présences",
  sms: "Notifications SMS", parent_portal: "Espace parent",
  announcements: "Annonces", multi_campus: "Multi-campus",
  advanced_reports: "Rapports avancés", priority_support: "Support prioritaire",
};

export const WINTEK_CONTACT = {
  phone: "+237 6 80 00 00 00",
  email: "contact@wintek.cm",
};
