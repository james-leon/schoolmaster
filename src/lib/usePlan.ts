import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { useDB } from "./store";
import { getPlan, ADDON_CONFIG, type PlanConfig, type FeatureId, type PlanId } from "./plans";

export type SubscriptionStatus = "active" | "trial" | "suspended" | "expired";

export interface SchoolSubscription {
  plan: PlanConfig;
  planId: PlanId;
  hasTransportAddon: boolean;
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
  /** Full label incl. add-on, e.g. "Pro + Transport". */
  planLabel: string;
  hasFeature: (f: FeatureId) => boolean;
  /** Deprecated — both plans are now unlimited. Kept for backward compat. */
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
  plan: getPlan("essentiel"), planId: "essentiel", hasTransportAddon: false,
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
      .select("subscription_plan, status, trial_ends_at, subscription_start, subscription_end, has_transport_addon" as any)
      .eq("id", schoolId)
      .maybeSingle();
    const raw = (data ?? {}) as any;
    const planId: PlanId = raw.subscription_plan === "essentiel" ? "essentiel" : "pro";
    const next: SchoolSubscription = {
      plan: getPlan(planId),
      planId,
      hasTransportAddon: !!raw.has_transport_addon,
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

  const studentCount = db.students.length;
  const teacherCount = db.teachers.length;

  const hasFeature = (f: FeatureId) => {
    if (f === "transport") return sub.hasTransportAddon;
    if (ADDON_CONFIG.transport.features.includes(f)) return sub.hasTransportAddon;
    return sub.plan.features.includes(f);
  };

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

  const planLabel = sub.plan.label + (sub.hasTransportAddon ? " + Transport" : "");

  return {
    ...sub,
    loading,
    studentCount, teacherCount,
    planLabel,
    hasFeature,
    isBlocked, isTrial, daysLeftInTrial, daysUntilExpiry,
    refresh: fetchSub,
  };
}
