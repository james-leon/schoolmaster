import { supabase } from "@/integrations/supabase/client";

async function callAdmin(payload: Record<string, unknown>): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Session expirée");
  const res = await fetch("/api/public/admin-users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
  return json;
}

export const adminApi = {
  createTeacher: (p: { firstName: string; lastName: string; email: string; phone?: string; subjects: string[]; assignedClasses: string[] }) =>
    callAdmin({ action: "create-teacher", ...p }),
  createParent: (p: { firstName: string; lastName: string; email: string; phone?: string; studentIds: string[] }) =>
    callAdmin({ action: "create-parent", ...p }),
  resetPassword: (targetUserId: string) =>
    callAdmin({ action: "reset-password", targetUserId }),
  setActive: (targetUserId: string, isActive: boolean) =>
    callAdmin({ action: "set-active", targetUserId, isActive }),
  delete: (targetUserId: string) =>
    callAdmin({ action: "delete", targetUserId }),
};
