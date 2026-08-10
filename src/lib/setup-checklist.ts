/**
 * Guided setup / quick-start checklist.
 *
 * Purely additive: derives completion from data that already exists in the
 * local store (mirrored from the backend). No writes, no permission changes.
 */
import { useMemo } from "react";
import { useDB } from "./store";
import { useAuth } from "./auth";
import { usePlan } from "./usePlan";
import { useSchoolParentAccounts } from "./useSchoolParentAccounts";
import { roleCanVisit } from "./permissions";
import type { FeatureId } from "./plans";

export interface SetupStep {
  id: string;
  /** i18n key suffix under `setup.steps.<id>` */
  to: string;
  feature?: FeatureId;
  done: boolean;
}

const DISMISS_KEY = "sm.setupChecklistDismissed";

export function isSetupDismissed(schoolId?: string | null): boolean {
  if (typeof window === "undefined" || !schoolId) return false;
  try {
    return window.localStorage.getItem(`${DISMISS_KEY}.${schoolId}`) === "1";
  } catch {
    return false;
  }
}

export function setSetupDismissed(schoolId: string | null | undefined, value: boolean) {
  if (typeof window === "undefined" || !schoolId) return;
  try {
    const k = `${DISMISS_KEY}.${schoolId}`;
    if (value) window.localStorage.setItem(k, "1");
    else window.localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
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
      { id: "school", to: "/parametres", done: schoolConfigured },
      { id: "classes", to: "/classes", done: db.classes.length > 0 },
      { id: "subjects", to: "/parametres", done: db.classSubjects.length > 0 },
      { id: "fees", to: "/scolarite", done: db.feeTypes.length > 0 },
      { id: "teachers", to: "/enseignants", done: db.teachers.length > 0 },
      { id: "students", to: "/eleves", done: db.students.length > 0 },
      { id: "parentAccounts", to: "/parents", done: accounts.length > 0 },
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

  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;

  return {
    steps,
    doneCount,
    total,
    complete: total > 0 && doneCount === total,
    loading: parentsLoading,
    schoolId: user?.schoolId ?? null,
  };
}
