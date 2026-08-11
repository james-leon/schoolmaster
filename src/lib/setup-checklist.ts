/**
 * Guided setup / quick-start checklist.
 *
 * Purely additive: derives completion from data that already exists in the
 * local store (mirrored from the backend). No writes, no permission changes,
 * except the user's own "hide the guide" preference on their profile.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDB } from "./store";
import { useAuth } from "./auth";
import { usePlan } from "./usePlan";
import { useSchoolParentAccounts } from "./useSchoolParentAccounts";
import { roleCanVisit } from "./permissions";
import { supabase } from "@/integrations/supabase/client";
import type { FeatureId } from "./plans";

export interface SetupStep {
  id: string;
  /** i18n key suffix under `setup.steps.<id>` */
  to: string;
  feature?: FeatureId;
  done: boolean;
  /** Optional steps never count toward the progress fraction. */
  optional?: boolean;
}

const DISMISS_KEY = "sm.setupChecklistDismissed";

function localKey(userId?: string | null) {
  return `${DISMISS_KEY}.${userId ?? "anon"}`;
}

export function isSetupDismissed(userId?: string | null): boolean {
  if (typeof window === "undefined" || !userId) return false;
  try {
    return window.localStorage.getItem(localKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function setSetupDismissed(userId: string | null | undefined, value: boolean) {
  if (typeof window === "undefined" || !userId) return;
  try {
    const k = localKey(userId);
    if (value) window.localStorage.setItem(k, "1");
    else window.localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/**
 * Persisted-per-user dismissal of the quick-start guide.
 * localStorage gives an instant answer; the profile column makes it survive
 * logout / other devices.
 */
export function useSetupDismissal() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [dismissed, setDismissedState] = useState(() => isSetupDismissed(userId));

  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    setDismissedState(isSetupDismissed(userId));
    supabase
      .from("profiles")
      .select("setup_dismissed")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const v = Boolean((data as { setup_dismissed?: boolean }).setup_dismissed);
        setSetupDismissed(userId, v);
        setDismissedState(v);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setDismissed = useCallback(
    (value: boolean) => {
      setDismissedState(value);
      setSetupDismissed(userId, value);
      if (userId) {
        supabase
          .from("profiles")
          .update({ setup_dismissed: value })
          .eq("id", userId)
          .then(() => {});
      }
    },
    [userId],
  );

  return { dismissed, setDismissed };
}

export function useSetupChecklist() {
  const db = useDB();
  const { user } = useAuth();
  const { hasFeature } = usePlan();
  const { accounts, loading: parentsLoading } = useSchoolParentAccounts();

  const school = db.schools[0];
  const year = db.academicYears.find((y) => y.isCurrent) ?? db.academicYears[0];

  const schoolConfigured = Boolean(
    school?.name &&
      (school.phone || school.email) &&
      year?.term1Start && year?.term1End &&
      year?.term2Start && year?.term2End &&
      year?.term3Start && year?.term3End,
  );

  const steps: SetupStep[] = useMemo(() => {
    const all: SetupStep[] = [
      // Essential — every school needs these
      { id: "school", to: "/parametres", done: schoolConfigured },
      { id: "classes", to: "/classes", done: db.classes.length > 0 },
      { id: "subjects", to: "/parametres", done: db.classSubjects.length > 0 },
      { id: "fees", to: "/scolarite", done: db.feeTypes.length > 0 },
      { id: "students", to: "/eleves", done: db.students.length > 0 },
      // Optional — situational, never counted
      { id: "teachers", to: "/enseignants", done: db.teachers.length > 0, optional: true },
      { id: "parentAccounts", to: "/parents", done: accounts.length > 0, optional: true },
      { id: "staff", to: "/personnel", done: false, optional: true },
      { id: "transport", to: "/transport", done: false, optional: true },
      { id: "budget", to: "/budget", done: false, optional: true },
    ];
    const role = user?.role;
    return all.filter(
      (s) =>
        (!s.feature || hasFeature(s.feature)) &&
        (!role || roleCanVisit(role, s.to)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    schoolConfigured, db.classes, db.classSubjects, db.feeTypes,
    db.teachers, db.students, accounts.length, user?.role,
  ]);

  const essentialSteps = steps.filter((s) => !s.optional);
  const optionalSteps = steps.filter((s) => s.optional);
  const doneCount = essentialSteps.filter((s) => s.done).length;
  const total = essentialSteps.length;

  return {
    steps,
    essentialSteps,
    optionalSteps,
    doneCount,
    total,
    complete: total > 0 && doneCount === total,
    loading: parentsLoading,
    schoolId: user?.schoolId ?? null,
  };
}
