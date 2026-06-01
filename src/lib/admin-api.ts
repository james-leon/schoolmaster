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
  createParent: (p: { firstName: string; lastName: string; email: string; phone?: string; studentIds: string[]; relationship?: string }) =>
    callAdmin({ action: "create-parent", ...p }),
  linkParentStudent: (p: { parentProfileId: string; studentId: string; relationship?: string }) =>
    callAdmin({ action: "link-parent-student", ...p }),
  unlinkParentStudent: (p: { parentProfileId: string; studentId: string }) =>
    callAdmin({ action: "unlink-parent-student", ...p }),
  listSchoolParents: () =>
    callAdmin({ action: "list-school-parents" }) as Promise<{ parents: { id: string; full_name: string; email: string; phone: string | null }[] }>,
  listStudentParents: (studentId: string) =>
    callAdmin({ action: "list-student-parents", studentId }) as Promise<{
      links: { id: string; parent_profile_id: string; relationship: string; created_at: string;
        profile: { id: string; full_name: string; email: string; phone: string | null } | null }[];
    }>,
  resetPassword: (targetUserId: string) =>
    callAdmin({ action: "reset-password", targetUserId }),
  setActive: (targetUserId: string, isActive: boolean) =>
    callAdmin({ action: "set-active", targetUserId, isActive }),
  delete: (targetUserId: string) =>
    callAdmin({ action: "delete", targetUserId }),
};
