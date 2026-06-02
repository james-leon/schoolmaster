import { supabase } from "@/integrations/supabase/client";

async function call(payload: Record<string, unknown>): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Session expirée");
  const res = await fetch("/api/public/super-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
  return json;
}

export interface PlatformSchool {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  subscription_plan: string | null;
  status: "active" | "trial" | "suspended" | "expired";
  trial_ends_at: string | null;
  subscription_start: string | null;
  subscription_end: string | null;
  created_at: string;
  director_name: string | null;
  student_count: number;
}

export interface PlatformKpis {
  totalSchools: number;
  activeSchools: number;
  trialSchools: number;
  suspendedSchools: number;
  paidSchools: number;
  totalStudents: number;
}

export const superAdminApi = {
  listSchools: () =>
    call({ action: "list-schools" }) as Promise<{ ok: true; schools: PlatformSchool[]; kpis: PlatformKpis }>,
  createSchool: (p: {
    schoolName: string; city?: string; country?: string; phone?: string; schoolEmail?: string;
    plan: string; status: "active" | "trial"; trialEndsAt?: string;
    directorName: string; directorEmail: string;
  }) => call({ action: "create-school", ...p }) as Promise<{
    ok: true; schoolId: string; schoolName: string; directorEmail: string; tempPassword: string;
  }>,
  updateStatus: (schoolId: string, status: "active" | "trial" | "suspended" | "expired") =>
    call({ action: "update-status", schoolId, status }),
  updatePlan: (schoolId: string, plan: string) =>
    call({ action: "update-plan", schoolId, plan }),
  extendTrial: (schoolId: string, trialEndsAt: string) =>
    call({ action: "extend-trial", schoolId, trialEndsAt }),
  deleteSchool: (schoolId: string) =>
    call({ action: "delete-school", schoolId, confirm: "DELETE" }),
  updateSubscription: (p: {
    schoolId: string;
    plan: string;
    status: "active" | "trial" | "suspended" | "expired";
    subscriptionStart?: string;
    subscriptionEnd?: string;
    trialEnd?: string;
  }) => call({ action: "update-subscription", ...p }),
  renewSubscription: (p: {
    schoolId: string; plan: string; months: number;
    amount?: number; paymentMethod?: string; reference?: string;
  }) => call({ action: "renew-subscription", ...p }) as Promise<{ ok: true; newEnd: string }>,
  convertTrial: (p: {
    schoolId: string; plan: string; months: number;
    amount?: number; paymentMethod?: string; reference?: string;
  }) => call({ action: "convert-trial", ...p }) as Promise<{ ok: true; newEnd: string }>,
  listSubscriptionPayments: (schoolId: string) =>
    call({ action: "list-subscription-payments", schoolId }) as Promise<{
      ok: true;
      payments: {
        id: string; plan: string; amount: number; payment_date: string;
        payment_method: string | null; status: string;
        period_start: string | null; period_end: string | null; reference: string | null;
      }[];
    }>,
};

// Impersonation state lives in localStorage so the AuthProvider can hydrate
// from it on reload.
const IMP_KEY = "wintek_impersonated_school_id";

export function getImpersonatedSchoolId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(IMP_KEY);
}

export function setImpersonatedSchoolId(schoolId: string | null) {
  if (typeof window === "undefined") return;
  if (schoolId) localStorage.setItem(IMP_KEY, schoolId);
  else localStorage.removeItem(IMP_KEY);
}
