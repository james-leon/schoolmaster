import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { useDB } from "./store";
import { getPlan, type PlanConfig, type FeatureId, type PlanId } from "./plans";

export type SubscriptionStatus = "active" | "trial" | "suspended" | "expired";

export interface SchoolSubscription {
  plan: PlanConfig;
  planId: PlanId;
  status: SubscriptionStatus;
  trialEnd: string | null;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
  /** Computed effective status (auto-expire if dates passed). */
  effectiveStatus: SubscriptionStatus;
}

interface UsePlanResult extends SchoolSubscription {
  loading: boolean;
  limits: { maxStudents: number; maxTeachers: number };
  studentCount: number;
  teacherCount: number;
  hasFeature: (f: FeatureId) => boolean;
  canAddStudent: () => boolean;
  canAddTeacher: () => boolean;
  isBlocked: boolean;
  isTrial: boolean;
  daysLeftInTrial: number | null;
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
  plan: getPlan("starter"), planId: "starter", status: "active",
  trialEnd: null, subscriptionStart: null, subscriptionEnd: null,
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
      .select("subscription_plan, status, trial_ends_at, subscription_start, subscription_end")
      .eq("id", schoolId)
      .maybeSingle();
    const next: SchoolSubscription = {
      plan: getPlan((data?.subscription_plan as string) ?? "starter"),
      planId: ((data?.subscription_plan as PlanId) ?? "starter"),
      status: ((data?.status as SubscriptionStatus) ?? "active"),
      trialEnd: (data?.trial_ends_at as string | null) ?? null,
      subscriptionStart: (data?.subscription_start as string | null) ?? null,
      subscriptionEnd: (data?.subscription_end as string | null) ?? null,
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

  const hasFeature = (f: FeatureId) => sub.plan.features.includes(f);
  const canAddStudent = () => studentCount < sub.plan.maxStudents;
  const canAddTeacher = () => teacherCount < sub.plan.maxTeachers;

  const isTrial = sub.effectiveStatus === "trial";
  const isBlocked = sub.effectiveStatus === "suspended" || sub.effectiveStatus === "expired";

  let daysLeftInTrial: number | null = null;
  if (isTrial && sub.trialEnd) {
    const ms = new Date(sub.trialEnd).getTime() - Date.now();
    daysLeftInTrial = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  return {
    ...sub,
    loading,
    limits: { maxStudents: sub.plan.maxStudents, maxTeachers: sub.plan.maxTeachers },
    studentCount, teacherCount,
    hasFeature, canAddStudent, canAddTeacher,
    isBlocked, isTrial, daysLeftInTrial,
    refresh: fetchSub,
  };
}
