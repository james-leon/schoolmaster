import type { DB, FeeType, PaymentRecord, User } from "./types";
import { DEFAULT_FEE_TYPES } from "./types";

// Stable placeholder ID used only to satisfy legacy code paths that look for
// a "current school" before Supabase hydration completes. The real school_id
// is set when hydrateAll() runs after sign-in.
const SCHOOL_ID = "school-placeholder";

/**
 * Build an EMPTY local DB snapshot. Real data is hydrated from Supabase per
 * the signed-in user's school_id. Returning demo data here would leak Queen
 * Mary content into every new browser session — a multi-tenant data leak.
 */
export function buildSeed(): DB {
  let _uid = 0;
  const uid = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    _uid += 1;
    const hex = (_uid * 0x9e3779b1).toString(16).padStart(8, "0");
    return `${hex.slice(0, 8)}-0000-4000-8000-${hex.padStart(12, "0").slice(0, 12)}`;
  };

  return {
    schools: [],
    users: [] as User[],
    teachers: [],
    classes: [],
    students: [],
    payments: [],
    grades: [],
    attendance: [],
    activities: [],
    classSubjects: [],
    feeTypes: DEFAULT_FEE_TYPES.map((f) => ({ id: uid(), ...f })) as FeeType[],
    paymentRecords: [] as PaymentRecord[],
    parents: [],
    announcements: [],
    academicYears: [],
  };
}

export { SCHOOL_ID };
