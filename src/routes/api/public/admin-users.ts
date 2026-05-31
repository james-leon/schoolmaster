import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Admin endpoint to manage user accounts in the current school.
 * All actions require the caller to be a school_admin of the target school.
 * Actions: create-teacher | create-parent | reset-password | set-active | delete
 */

type Ctx = { userId: string; schoolId: string };

async function authorizeAdmin(request: Request): Promise<Ctx | Response> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const token = auth.slice(7);
  const verifier = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
  const { data: u, error } = await verifier.auth.getUser(token);
  if (error || !u.user) return Response.json({ error: "Invalid token" }, { status: 401 });
  const userId = u.user.id;
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "school_admin").maybeSingle();
  if (!roleRow) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { data: prof } = await supabaseAdmin
    .from("profiles").select("school_id").eq("id", userId).maybeSingle();
  if (!prof?.school_id) return Response.json({ error: "No school" }, { status: 400 });
  return { userId, schoolId: prof.school_id as string };
}

function genPassword(len = 10): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => alphabet[n % alphabet.length]).join("");
}

async function ensureTargetInSchool(targetUserId: string, schoolId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from("profiles").select("school_id").eq("id", targetUserId).maybeSingle();
  return data?.school_id === schoolId;
}

export const Route = createFileRoute("/api/public/admin-users")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const ctx = await authorizeAdmin(request);
          if (ctx instanceof Response) return ctx;
          const body = await request.json();
          const action = String(body?.action ?? "");

          if (action === "create-teacher") {
            const { firstName, lastName, email, phone, subjects, assignedClasses } = body;
            if (!firstName || !lastName || !email) return Response.json({ error: "Champs requis manquants" }, { status: 400 });
            const tempPassword = genPassword(10);
            const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
              email, password: tempPassword, email_confirm: true,
              user_metadata: { full_name: `${firstName} ${lastName}` },
            });
            if (cErr || !created.user) return Response.json({ error: cErr?.message ?? "Création échouée" }, { status: 400 });
            const uid = created.user.id;
            await supabaseAdmin.from("user_roles").upsert({ user_id: uid, role: "teacher" }, { onConflict: "user_id,role" });
            await supabaseAdmin.from("profiles").upsert({
              id: uid, email, full_name: `${firstName} ${lastName}`, role: "teacher",
              school_id: ctx.schoolId, phone: phone ?? null,
              assigned_classes: assignedClasses ?? [], assigned_subjects: subjects ?? [],
              must_change_password: true, is_active: true,
            }, { onConflict: "id" });
            const { data: teacher } = await supabaseAdmin.from("teachers").insert({
              school_id: ctx.schoolId, first_name: firstName, last_name: lastName,
              email, phone: phone ?? null, subjects: subjects ?? [],
            }).select().single();
            return Response.json({ ok: true, userId: uid, tempPassword, teacherId: teacher?.id });
          }

          if (action === "create-parent") {
            const { firstName, lastName, email, phone, studentIds } = body;
            if (!firstName || !lastName || !email || !Array.isArray(studentIds) || studentIds.length === 0) {
              return Response.json({ error: "Champs requis manquants" }, { status: 400 });
            }
            const tempPassword = genPassword(10);
            const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
              email, password: tempPassword, email_confirm: true,
              user_metadata: { full_name: `${firstName} ${lastName}` },
            });
            if (cErr || !created.user) return Response.json({ error: cErr?.message ?? "Création échouée" }, { status: 400 });
            const uid = created.user.id;
            await supabaseAdmin.from("user_roles").upsert({ user_id: uid, role: "parent" }, { onConflict: "user_id,role" });
            await supabaseAdmin.from("profiles").upsert({
              id: uid, email, full_name: `${firstName} ${lastName}`, role: "parent",
              school_id: ctx.schoolId, phone: phone ?? null,
              student_id: studentIds[0], student_ids: studentIds,
              must_change_password: true, is_active: true,
            }, { onConflict: "id" });
            return Response.json({ ok: true, userId: uid, tempPassword });
          }

          if (action === "reset-password") {
            const { targetUserId } = body;
            if (!targetUserId) return Response.json({ error: "Utilisateur requis" }, { status: 400 });
            if (!(await ensureTargetInSchool(targetUserId, ctx.schoolId))) return Response.json({ error: "Forbidden" }, { status: 403 });
            const tempPassword = genPassword(10);
            const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password: tempPassword });
            if (error) return Response.json({ error: error.message }, { status: 400 });
            await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", targetUserId);
            return Response.json({ ok: true, tempPassword });
          }

          if (action === "set-active") {
            const { targetUserId, isActive } = body;
            if (!targetUserId) return Response.json({ error: "Utilisateur requis" }, { status: 400 });
            if (!(await ensureTargetInSchool(targetUserId, ctx.schoolId))) return Response.json({ error: "Forbidden" }, { status: 403 });
            // Ban / unban via Supabase Auth + flag in profile
            const banDuration = isActive ? "none" : "876000h"; // 100y
            const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { ban_duration: banDuration });
            if (error) return Response.json({ error: error.message }, { status: 400 });
            await supabaseAdmin.from("profiles").update({ is_active: !!isActive }).eq("id", targetUserId);
            return Response.json({ ok: true });
          }

          if (action === "delete") {
            const { targetUserId } = body;
            if (!targetUserId) return Response.json({ error: "Utilisateur requis" }, { status: 400 });
            if (targetUserId === ctx.userId) return Response.json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, { status: 400 });
            if (!(await ensureTargetInSchool(targetUserId, ctx.schoolId))) return Response.json({ error: "Forbidden" }, { status: 403 });
            const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
            if (error) return Response.json({ error: error.message }, { status: 400 });
            await supabaseAdmin.from("user_roles").delete().eq("user_id", targetUserId);
            await supabaseAdmin.from("profiles").delete().eq("id", targetUserId);
            return Response.json({ ok: true });
          }

          return Response.json({ error: "Unknown action" }, { status: 400 });
        } catch (e) {
          console.error("[admin-users]", e);
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
