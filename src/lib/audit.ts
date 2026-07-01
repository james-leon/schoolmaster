/**
 * Audit logging — best-effort, fire-and-forget.
 *
 * Records sensitive user actions to public.audit_logs. RLS enforces that
 * user_id = auth.uid() and school_id matches the caller. Failures are
 * swallowed: logging must never block or break the main operation.
 *
 * Append-only: the table has no UPDATE or DELETE policy.
 */

import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "student_created" | "student_updated" | "student_deleted"
  | "grade_created" | "grade_updated" | "grade_deleted"
  | "invoice_created" | "invoice_deleted"
  | "payment_recorded" | "payment_deleted"
  | "expense_created" | "expense_updated" | "expense_deleted"
  | "medical_record_viewed" | "medical_record_updated"
  | "discipline_record_created"
  | "user_role_changed" | "password_reset"
  | "account_created" | "account_deleted" | "account_status_changed"
  | "data_reset"
  | (string & {});

interface LogInput {
  action: AuditAction;
  targetType?: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
}

// Cached identity so we don't hit getUser() on every write.
let cachedUser: { id: string; name: string; schoolId: string } | null = null;

async function resolveIdentity(): Promise<typeof cachedUser> {
  if (cachedUser) return cachedUser;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const id = auth.user?.id;
    if (!id) return null;
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, email, school_id")
      .eq("id", id)
      .maybeSingle();
    if (!prof?.school_id) return null;
    cachedUser = {
      id,
      name: (prof.full_name ?? prof.email ?? "Utilisateur") as string,
      schoolId: prof.school_id as string,
    };
    return cachedUser;
  } catch {
    return null;
  }
}

export function invalidateAuditIdentity() {
  cachedUser = null;
}

/** Fire-and-forget audit log. Never throws, never blocks the caller. */
export function logAudit(input: LogInput): void {
  void (async () => {
    try {
      const who = await resolveIdentity();
      if (!who) return;
      await supabase.from("audit_logs" as any).insert({
        school_id: who.schoolId,
        user_id: who.id,
        user_name: who.name,
        action_type: input.action,
        target_type: input.targetType ?? null,
        target_id: input.targetId ?? null,
        details: input.details ?? {},
      });
    } catch {
      /* swallow — logging must never break the app */
    }
  })();
}

// French labels for the admin UI.
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  student_created: "Élève créé",
  student_updated: "Élève modifié",
  student_deleted: "Élève supprimé",
  grade_created: "Note créée",
  grade_updated: "Note modifiée",
  grade_deleted: "Note supprimée",
  invoice_created: "Facture créée",
  invoice_deleted: "Facture supprimée",
  payment_recorded: "Paiement enregistré",
  payment_deleted: "Paiement supprimé",
  expense_created: "Dépense créée",
  expense_updated: "Dépense modifiée",
  expense_deleted: "Dépense supprimée",
  medical_record_viewed: "Dossier médical consulté",
  medical_record_updated: "Dossier médical modifié",
  discipline_record_created: "Observation disciplinaire ajoutée",
  user_role_changed: "Rôle utilisateur modifié",
  password_reset: "Mot de passe réinitialisé",
  account_created: "Compte créé",
  account_deleted: "Compte supprimé",
  account_status_changed: "Statut de compte modifié",
  data_reset: "Réinitialisation de données",
};

export function labelForAction(a: string): string {
  return AUDIT_ACTION_LABELS[a] ?? a;
}
