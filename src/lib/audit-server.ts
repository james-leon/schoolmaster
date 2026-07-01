/**
 * Server-side audit logging.
 *
 * Uses the service-role client so it can insert entries on behalf of the
 * acting user (RLS is bypassed). Best-effort: any failure is logged to
 * stderr and swallowed — never blocks the caller.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

interface ServerLogInput {
  schoolId: string;
  userId: string | null;
  userName?: string;
  action: string;
  targetType?: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
}

export async function logAuditServer(
  admin: SupabaseClient,
  input: ServerLogInput,
): Promise<void> {
  try {
    let userName = input.userName;
    if (!userName && input.userId) {
      const { data } = await admin
        .from("profiles").select("full_name, email").eq("id", input.userId).maybeSingle();
      userName = (data?.full_name ?? data?.email ?? "Utilisateur") as string;
    }
    await admin.from("audit_logs").insert({
      school_id: input.schoolId,
      user_id: input.userId,
      user_name: userName ?? "Système",
      action_type: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      details: input.details ?? {},
    });
  } catch (err) {
    console.error("[audit-server] failed to log", input.action, err);
  }
}
