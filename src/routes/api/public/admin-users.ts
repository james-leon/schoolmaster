import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { safeError } from "@/lib/api-errors";

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
            if (cErr || !created.user) return safeError("admin-users:create-teacher", 400, cErr);
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
            const { firstName, lastName, email, phone, studentIds, relationship } = body;
            if (!firstName || !lastName || !email || !Array.isArray(studentIds) || studentIds.length === 0) {
              return Response.json({ error: "Champs requis manquants" }, { status: 400 });
            }
            // Verify EVERY studentId belongs to the caller's school before
            // creating any auth user or parent_students link.
            const { data: stRows, error: stErr } = await supabaseAdmin
              .from("students")
              .select("id, school_id")
              .in("id", studentIds as string[]);
            if (stErr) return safeError("admin-users:create-parent:students", 400, stErr);
            const foundIds = new Set((stRows ?? []).map((r: any) => r.id));
            const allInSchool =
              (stRows ?? []).every((r: any) => r.school_id === ctx.schoolId) &&
              (studentIds as string[]).every((id) => foundIds.has(id));
            if (!allInSchool) return Response.json({ error: "Élève hors école" }, { status: 403 });

            const tempPassword = genPassword(10);
            const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
              email, password: tempPassword, email_confirm: true,
              user_metadata: { full_name: `${firstName} ${lastName}` },
            });
            if (cErr || !created.user) return safeError("admin-users:create-parent", 400, cErr);
            const uid = created.user.id;
            await supabaseAdmin.from("user_roles").upsert({ user_id: uid, role: "parent" }, { onConflict: "user_id,role" });
            await supabaseAdmin.from("profiles").upsert({
              id: uid, email, full_name: `${firstName} ${lastName}`, role: "parent",
              school_id: ctx.schoolId, phone: phone ?? null,
              student_id: studentIds[0], student_ids: studentIds,
              must_change_password: true, is_active: true,
            }, { onConflict: "id" });
            const links = (studentIds as string[]).map((sid) => ({
              parent_profile_id: uid, student_id: sid,
              school_id: ctx.schoolId, relationship: relationship || "Tuteur",
            }));
            await supabaseAdmin.from("parent_students").upsert(links, { onConflict: "parent_profile_id,student_id" });
            return Response.json({ ok: true, userId: uid, tempPassword });
          }

          if (action === "link-parent-student") {
            const { parentProfileId, studentId, relationship } = body;
            if (!parentProfileId || !studentId) return Response.json({ error: "Paramètres manquants" }, { status: 400 });
            if (!(await ensureTargetInSchool(parentProfileId, ctx.schoolId))) return Response.json({ error: "Forbidden" }, { status: 403 });
            const { data: st } = await supabaseAdmin.from("students").select("school_id").eq("id", studentId).maybeSingle();
            if (st?.school_id !== ctx.schoolId) return Response.json({ error: "Élève hors école" }, { status: 403 });
            const { error } = await supabaseAdmin.from("parent_students")
              .upsert({ parent_profile_id: parentProfileId, student_id: studentId,
                        school_id: ctx.schoolId, relationship: relationship || "Tuteur" },
                      { onConflict: "parent_profile_id,student_id" });
            if (error) return safeError("admin-users:link-parent-student", 400, error);
            const { data: links } = await supabaseAdmin.from("parent_students")
              .select("student_id").eq("parent_profile_id", parentProfileId);
            const ids = (links ?? []).map((r: any) => r.student_id);
            await supabaseAdmin.from("profiles").update({
              student_id: ids[0] ?? null, student_ids: ids,
            }).eq("id", parentProfileId);
            return Response.json({ ok: true });
          }

          if (action === "unlink-parent-student") {
            const { parentProfileId, studentId } = body;
            if (!parentProfileId || !studentId) return Response.json({ error: "Paramètres manquants" }, { status: 400 });
            if (!(await ensureTargetInSchool(parentProfileId, ctx.schoolId))) return Response.json({ error: "Forbidden" }, { status: 403 });
            await supabaseAdmin.from("parent_students")
              .delete()
              .eq("parent_profile_id", parentProfileId)
              .eq("student_id", studentId);
            const { data: links } = await supabaseAdmin.from("parent_students")
              .select("student_id").eq("parent_profile_id", parentProfileId);
            const ids = (links ?? []).map((r: any) => r.student_id);
            await supabaseAdmin.from("profiles").update({
              student_id: ids[0] ?? null, student_ids: ids,
            }).eq("id", parentProfileId);
            return Response.json({ ok: true });
          }

          if (action === "list-school-parents") {
            const { data, error } = await supabaseAdmin
              .from("profiles")
              .select("id, full_name, email, phone")
              .eq("school_id", ctx.schoolId)
              .eq("role", "parent")
              .order("full_name", { ascending: true });
            if (error) return safeError("admin-users:list-school-parents", 400, error);
            return Response.json({ parents: data ?? [] });
          }

          if (action === "list-student-parents") {
            const { studentId } = body;
            if (!studentId) return Response.json({ error: "Élève requis" }, { status: 400 });
            const { data: links } = await supabaseAdmin
              .from("parent_students")
              .select("id, parent_profile_id, relationship, created_at")
              .eq("student_id", studentId)
              .eq("school_id", ctx.schoolId);
            const ids = (links ?? []).map((l: any) => l.parent_profile_id);
            const profsRes = ids.length
              ? await supabaseAdmin.from("profiles").select("id, full_name, email, phone").in("id", ids)
              : { data: [] as any[] };
            const byId = new Map((profsRes.data ?? []).map((p: any) => [p.id, p]));
            const merged = (links ?? []).map((l: any) => ({
              ...l, profile: byId.get(l.parent_profile_id) ?? null,
            }));
            return Response.json({ links: merged });
          }

          if (action === "reset-password") {
            const { targetUserId } = body;
            if (!targetUserId) return Response.json({ error: "Utilisateur requis" }, { status: 400 });
            if (!(await ensureTargetInSchool(targetUserId, ctx.schoolId))) return Response.json({ error: "Forbidden" }, { status: 403 });
            const tempPassword = genPassword(10);
            const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password: tempPassword });
            if (error) return safeError("admin-users:reset-password", 400, error);
            await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", targetUserId);
            return Response.json({ ok: true, tempPassword });
          }

          if (action === "list-school-teachers") {
            const { data, error } = await supabaseAdmin
              .from("profiles")
              .select("id, full_name, email, phone")
              .eq("school_id", ctx.schoolId)
              .eq("role", "teacher")
              .order("full_name", { ascending: true });
            if (error) return safeError("admin-users:list-school-teachers", 400, error);
            return Response.json({ teachers: data ?? [] });
          }

          if (action === "create-teacher-account") {
            const { teacherId } = body;
            if (!teacherId) return Response.json({ error: "Enseignant requis" }, { status: 400 });
            const { data: t } = await supabaseAdmin
              .from("teachers")
              .select("id, school_id, first_name, last_name, email, phone, subjects")
              .eq("id", teacherId).maybeSingle();
            if (!t || t.school_id !== ctx.schoolId) return Response.json({ error: "Forbidden" }, { status: 403 });
            if (!t.email) return Response.json({ error: "Cet enseignant n'a pas d'email" }, { status: 400 });
            // If a profile already exists for this email in this school, just reset password
            const { data: existing } = await supabaseAdmin
              .from("profiles").select("id, school_id").eq("email", t.email).maybeSingle();
            const tempPassword = genPassword(10);
            if (existing) {
              if (existing.school_id !== ctx.schoolId) return Response.json({ error: "Email déjà utilisé" }, { status: 400 });
              const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: tempPassword });
              if (uErr) return safeError("admin-users:create-teacher-account:reset", 400, uErr);
              await supabaseAdmin.from("profiles").update({ must_change_password: true, is_active: true }).eq("id", existing.id);
              return Response.json({ ok: true, userId: existing.id, tempPassword });
            }
            const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
              email: t.email, password: tempPassword, email_confirm: true,
              user_metadata: { full_name: `${t.first_name} ${t.last_name}` },
            });
            if (cErr || !created.user) return safeError("admin-users:create-teacher-account", 400, cErr);
            const uid = created.user.id;
            await supabaseAdmin.from("user_roles").upsert({ user_id: uid, role: "teacher" }, { onConflict: "user_id,role" });
            await supabaseAdmin.from("profiles").upsert({
              id: uid, email: t.email, full_name: `${t.first_name} ${t.last_name}`, role: "teacher",
              school_id: ctx.schoolId, phone: t.phone ?? null,
              assigned_subjects: t.subjects ?? [],
              must_change_password: true, is_active: true,
            }, { onConflict: "id" });
            return Response.json({ ok: true, userId: uid, tempPassword });
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
            await supabaseAdmin.from("parent_students").delete().eq("parent_profile_id", targetUserId);
            await supabaseAdmin.from("user_roles").delete().eq("user_id", targetUserId);
            await supabaseAdmin.from("profiles").delete().eq("id", targetUserId);
            return Response.json({ ok: true });
          }

          if (action === "announcement-read-stats" || action === "announcement-read-details") {
            const { data: anns } = await supabaseAdmin
              .from("announcements")
              .select("id,audience,target_class_id")
              .eq("school_id", ctx.schoolId);
            const annList = anns ?? [];

            const { data: profiles } = await supabaseAdmin
              .from("profiles")
              .select("id,full_name,email,phone,role")
              .eq("school_id", ctx.schoolId)
              .eq("is_active", true)
              .in("role", ["parent", "teacher"]);
            const profs = profiles ?? [];

            const { data: links } = await supabaseAdmin
              .from("parent_students")
              .select("parent_profile_id,student_id")
              .eq("school_id", ctx.schoolId);
            const { data: students } = await supabaseAdmin
              .from("students").select("id,class_id").eq("school_id", ctx.schoolId);
            const studentClass = new Map<string, string | null>(
              (students ?? []).map((s) => [s.id as string, (s.class_id as string | null) ?? null]),
            );
            const parentClasses = new Map<string, Set<string>>();
            for (const l of links ?? []) {
              const cls = studentClass.get(l.student_id as string);
              if (!cls) continue;
              const pid = l.parent_profile_id as string;
              if (!parentClasses.has(pid)) parentClasses.set(pid, new Set());
              parentClasses.get(pid)!.add(cls);
            }

            const teachers = profs.filter((p) => p.role === "teacher");
            const parents = profs.filter((p) => p.role === "parent");

            const recipientsFor = (audience: string, targetClassId: string | null) => {
              if (audience === "Tous") return profs;
              if (audience === "Enseignants") return teachers;
              if (audience === "Parents") return parents;
              if (audience === "Classe" && targetClassId) {
                return parents.filter((p) => parentClasses.get(p.id as string)?.has(targetClassId));
              }
              return [];
            };

            if (action === "announcement-read-stats") {
              const { data: reads } = await supabaseAdmin
                .from("announcement_reads")
                .select("announcement_id,user_id")
                .eq("school_id", ctx.schoolId);
              const readsBy = new Map<string, Set<string>>();
              for (const r of reads ?? []) {
                const aid = r.announcement_id as string;
                if (!readsBy.has(aid)) readsBy.set(aid, new Set());
                readsBy.get(aid)!.add(r.user_id as string);
              }
              const stats: Record<string, { read: number; total: number }> = {};
              for (const a of annList) {
                const rec = recipientsFor(a.audience as string, (a.target_class_id as string | null) ?? null);
                const readSet = readsBy.get(a.id as string) ?? new Set();
                let read = 0;
                for (const r of rec) if (readSet.has(r.id as string)) read++;
                stats[a.id as string] = { read, total: rec.length };
              }
              return Response.json({ ok: true, stats });
            }

            const { announcementId } = body;
            const ann = annList.find((a) => a.id === announcementId);
            if (!ann) return Response.json({ error: "Annonce introuvable" }, { status: 404 });
            const rec = recipientsFor(ann.audience as string, (ann.target_class_id as string | null) ?? null);
            const { data: reads } = await supabaseAdmin
              .from("announcement_reads")
              .select("user_id,read_at")
              .eq("announcement_id", announcementId);
            const readMap = new Map<string, string>((reads ?? []).map((r) => [r.user_id as string, r.read_at as string]));
            const readers: Array<{ id: string; full_name: string; role: string; email: string | null; phone: string | null; read_at: string }> = [];
            const nonReaders: Array<{ id: string; full_name: string; role: string; email: string | null; phone: string | null }> = [];
            for (const p of rec) {
              const base = {
                id: p.id as string,
                full_name: (p.full_name as string) ?? "",
                role: (p.role as string) ?? "",
                email: (p.email as string | null) ?? null,
                phone: (p.phone as string | null) ?? null,
              };
              const rAt = readMap.get(base.id);
              if (rAt) readers.push({ ...base, read_at: rAt });
              else nonReaders.push(base);
            }
            readers.sort((a, b) => b.read_at.localeCompare(a.read_at));
            nonReaders.sort((a, b) => a.full_name.localeCompare(b.full_name));
            return Response.json({ ok: true, readers, nonReaders, total: rec.length });
          }

          return Response.json({ error: "Unknown action" }, { status: 400 });
        } catch (e) {
          console.error("[admin-users]", e);
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
