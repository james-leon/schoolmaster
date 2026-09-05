import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { useDB } from "./store";
import { getPlan, normalizePlanId, type PlanConfig, type FeatureId, type PlanId } from "./plans";

export type SubscriptionStatus = "active" | "trial" | "suspended" | "expired";

export interface SchoolSubscription {
  plan: PlanConfig;
  planId: PlanId;
  /** Transport add-on active for this school. */
  hasTransport: boolean;
  status: SubscriptionStatus;
  trialEnd: string | null;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
  /** Computed effective status (auto-expire if dates passed). */
  effectiveStatus: SubscriptionStatus;
}

interface UsePlanResult extends SchoolSubscription {
  loading: boolean;
  studentCount: number;
  teacherCount: number;
  /** Full label incl. add-on, e.g. "100 à 250 + Transport". */
  planLabel: string;
  /** Only "transport" can be locked; everything else is included. */
  hasFeature: (f: FeatureId) => boolean;
  /** Max active students for the tier (Infinity = unlimited). */
  maxStudents: number;
  isUnlimited: boolean;
  /** 0-100, null when unlimited. */
  usagePct: number | null;
  atStudentLimit: boolean;
  nearStudentLimit: boolean;
  remainingStudentSlots: number;
  /** Deprecated — kept for backward compat. */
  limits: { maxStudents: number; maxTeachers: number };
  canAddStudent: () => boolean;
  canAddTeacher: () => boolean;
  isBlocked: boolean;
  isTrial: boolean;
  daysLeftInTrial: number | null;
  daysUntilExpiry: number | null;
  refresh: () => Promise<void>;
}

function computeEffectiveStatus(s: SchoolSubscription): SubscriptionStatus {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (s.status === "trial" && s.trialEnd) {
    if (new Date(s.trialEnd) < today) return "expired";
  }
  if (s.status === "active" && s.subscriptionEnd) {
    if (new Date(s.subscriptionEnd) < today) return "expired";
  }
  return s.status;
}

const DEFAULT: SchoolSubscription = {
  plan: getPlan("plus-250"), planId: "plus-250", hasTransport: false,
  status: "active", trialEnd: null, subscriptionStart: null, subscriptionEnd: null,
  effectiveStatus: "active",
};

export function usePlan(): UsePlanResult {
  const { user } = useAuth();
  const db = useDB();
  const [sub, setSub] = useState<SchoolSubscription>(DEFAULT);
  const [loading, setLoading] = useState(true);

  const schoolId = user?.schoolId;

  const fetchSub = async () => {
    if (!schoolId) { setSub(DEFAULT); setLoading(false); return; }
    const { data } = await supabase
      .from("schools")
      .select("subscription_plan, transport_addon, status, trial_ends_at, subscription_start, subscription_end" as any)
      .eq("id", schoolId)
      .maybeSingle();
    const raw = (data ?? {}) as any;
    const planId: PlanId = normalizePlanId(raw.subscription_plan);
    const next: SchoolSubscription = {
      plan: getPlan(planId),
      planId,
      hasTransport: Boolean(raw.transport_addon),
      status: ((raw.status as SubscriptionStatus) ?? "active"),
      trialEnd: (raw.trial_ends_at as string | null) ?? null,
      subscriptionStart: (raw.subscription_start as string | null) ?? null,
      subscriptionEnd: (raw.subscription_end as string | null) ?? null,
      effectiveStatus: "active",
    };
    next.effectiveStatus = computeEffectiveStatus(next);
    setSub(next);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchSub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const studentCount = db.students.filter((s) => s.status !== "inactive").length;
  const teacherCount = db.teachers.length;

  // Only Transport is gated — everything else ships with every tier.
  const hasFeature = (f: FeatureId) => (f === "transport" ? sub.hasTransport : true);

  const maxStudents = sub.plan.maxStudents;
  const isUnlimited = !Number.isFinite(maxStudents);
  const usagePct = isUnlimited ? null : Math.min(100, Math.round((studentCount / maxStudents) * 100));
  const atStudentLimit = !isUnlimited && studentCount >= maxStudents;
  const nearStudentLimit = !isUnlimited && !atStudentLimit && studentCount >= maxStudents * 0.9;
  const remainingStudentSlots = isUnlimited
    ? Number.POSITIVE_INFINITY
    : Math.max(0, maxStudents - studentCount);

  const isTrial = sub.effectiveStatus === "trial";
  const isBlocked = sub.effectiveStatus === "suspended" || sub.effectiveStatus === "expired";

  let daysLeftInTrial: number | null = null;
  if (isTrial && sub.trialEnd) {
    const ms = new Date(sub.trialEnd).getTime() - Date.now();
    daysLeftInTrial = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  let daysUntilExpiry: number | null = null;
  if (sub.subscriptionEnd) {
    const ms = new Date(sub.subscriptionEnd).getTime() - Date.now();
    daysUntilExpiry = Math.ceil(ms / (1000 * 60 * 60 * 24));
  }

  const planLabel = sub.hasTransport ? `${sub.plan.label} + Transport` : sub.plan.label;

  return {
    ...sub,
    loading,
    studentCount, teacherCount,
    planLabel,
    hasFeature,
    maxStudents, isUnlimited, usagePct,
    atStudentLimit, nearStudentLimit, remainingStudentSlots,
    limits: { maxStudents, maxTeachers: Number.POSITIVE_INFINITY },
    canAddStudent: () => !atStudentLimit,
    canAddTeacher: () => true,
    isBlocked, isTrial, daysLeftInTrial, daysUntilExpiry,
    refresh: fetchSub,
  };
}
