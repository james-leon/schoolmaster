import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { safeError } from "@/lib/api-errors";
import { logAuditServer } from "@/lib/audit-server";
import { rateLimitOr429, RATE_LIMITS } from "@/lib/rate-limit.server";

// Any state-changing action.
const WRITE_ACTIONS = new Set([
  "update-notes", "create-school", "update-status", "update-subscription",
  "update-plan", "extend-trial", "renew-subscription", "convert-trial",
  "broadcast-announcement",
]);
// Destructive actions — much tighter budget.
const DESTRUCTIVE_ACTIONS = new Set(["delete-school"]);

/**
 * Super admin (Wintek) endpoint. Manages every school on the platform.
 * All actions require the caller to be a super_admin.
 */

type Ctx = { userId: string };

async function authorizeSuperAdmin(request: Request): Promise<Ctx | Response> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const token = auth.slice(7);
  const verifier = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
  const { data: u, error } = await verifier.auth.getUser(token);
  if (error || !u.user) return Response.json({ error: "Invalid token" }, { status: 401 });
  const userId = u.user.id;
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (!roleRow) return Response.json({ error: "Forbidden" }, { status: 403 });
  return { userId };
}

function genPassword(len = 12): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => alphabet[n % alphabet.length]).join("");
}

export const Route = createFileRoute("/api/public/super-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const ctx = await authorizeSuperAdmin(request);
          if (ctx instanceof Response) return ctx;
          const body = await request.json();
          const action = String(body?.action ?? "");

          if (DESTRUCTIVE_ACTIONS.has(action)) {
            const gate = await rateLimitOr429(
              supabaseAdmin, ctx.userId, RATE_LIMITS.superAdminDestructive,
            );
            if (gate) return gate;
          } else if (WRITE_ACTIONS.has(action)) {
            const gate = await rateLimitOr429(
              supabaseAdmin, ctx.userId, RATE_LIMITS.superAdminWrite,
            );
            if (gate) return gate;
          }

          if (action === "list-schools") {
            // Auto-expire schools whose subscription_end or trial_ends_at has passed.
            const today = new Date().toISOString().slice(0, 10);
            await (supabaseAdmin.from("schools") as any)
              .update({ status: "expired" })
              .lt("subscription_end", today)
              .in("status", ["active"]);
            await (supabaseAdmin.from("schools") as any)
              .update({ status: "expired" })
              .lt("trial_ends_at", today)
              .eq("status", "trial");

            const { data: schools, error } = await supabaseAdmin
              .from("schools")
              .select("id, name, city, country, email, phone, subscription_plan, status, trial_ends_at, subscription_start, subscription_end, created_at, director_name, last_activity_at, internal_notes, has_transport_addon")
              .order("created_at", { ascending: false });
            if (error) return safeError("super-admin", 500, error);

            // Student counts per school
            const { data: students } = await supabaseAdmin.from("students").select("school_id");
            const countsBySchool: Record<string, number> = {};
            for (const s of students ?? []) {
              countsBySchool[s.school_id] = (countsBySchool[s.school_id] ?? 0) + 1;
            }

            // Engagement signals: activity in the last 30 days
            const since = new Date(Date.now() - 30 * 86400000).toISOString();
            const sinceDate = since.slice(0, 10);
            const [paymentsRes, gradesRes, attRes] = await Promise.all([
              supabaseAdmin.from("payment_records").select("school_id").gte("date", sinceDate),
              supabaseAdmin.from("grades").select("school_id").gte("created_at", since),
              supabaseAdmin.from("attendance").select("school_id").gte("date", sinceDate),
            ]);
            const countBy = (rows: { school_id: string }[] | null | undefined) => {
              const m: Record<string, number> = {};
              for (const r of rows ?? []) m[r.school_id] = (m[r.school_id] ?? 0) + 1;
              return m;
            };
            const payCount = countBy(paymentsRes.data as any);
            const gradeCount = countBy(gradesRes.data as any);
            const attCount = countBy(attRes.data as any);

            const enriched = (schools ?? []).map((s: any) => ({
              ...s,
              student_count: countsBySchool[s.id] ?? 0,
              recent_payments: payCount[s.id] ?? 0,
              recent_grades: gradeCount[s.id] ?? 0,
              recent_attendance: attCount[s.id] ?? 0,
            }));
            const totalStudents = Object.values(countsBySchool).reduce((a, b) => a + b, 0);
            return Response.json({
              ok: true,
              schools: enriched,
              kpis: {
                totalSchools: schools?.length ?? 0,
                activeSchools: schools?.filter((s) => s.status === "active").length ?? 0,
                trialSchools: schools?.filter((s) => s.status === "trial").length ?? 0,
                suspendedSchools: schools?.filter((s) => s.status === "suspended").length ?? 0,
                paidSchools: schools?.filter((s) => s.subscription_plan && s.subscription_plan !== "free" && s.subscription_plan !== "trial").length ?? 0,
                totalStudents,
              },
            });
          }

          if (action === "update-notes") {
            const { schoolId, notes } = body;
            if (!schoolId) return Response.json({ error: "Paramètres invalides" }, { status: 400 });
            const trimmed = notes == null ? null : String(notes).slice(0, 4000);
            const { error } = await (supabaseAdmin.from("schools") as any)
              .update({ internal_notes: trimmed })
              .eq("id", schoolId);
            if (error) return safeError("super-admin", 500, error);
            return Response.json({ ok: true });
          }


          if (action === "create-school") {
            const {
              schoolName, city, country, phone, schoolEmail,
              plan, status, trialEndsAt,
              directorName, directorEmail,
            } = body;
            if (!schoolName || !directorName || !directorEmail) {
              return Response.json({ error: "Champs requis manquants" }, { status: 400 });
            }

            // 1) Create the school
            const { data: school, error: sErr } = await supabaseAdmin
              .from("schools")
              .insert({
                name: String(schoolName).slice(0, 200),
                city: city ? String(city).slice(0, 100) : null,
                country: country ? String(country).slice(0, 100) : "Cameroun",
                phone: phone ? String(phone).slice(0, 50) : null,
                email: schoolEmail ? String(schoolEmail).slice(0, 200) : null,
                director_name: String(directorName).slice(0, 200),
                subscription_plan: plan ?? "starter",
                status: status ?? "trial",
                trial_ends_at: trialEndsAt ?? null,
              })
              .select()
              .single();
            if (sErr) return safeError("super-admin", 500, sErr);

            // 2) Create the director's auth account
            const tempPassword = genPassword(12);
            const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
              email: directorEmail,
              password: tempPassword,
              email_confirm: true,
              user_metadata: { full_name: directorName },
            });
            if (cErr || !created.user) {
              // Roll back school creation if user creation fails
              await supabaseAdmin.from("schools").delete().eq("id", school.id);
              return safeError("super-admin", 400, cErr);
            }
            const uid = created.user.id;

            // 3) Grant school_admin role
            await supabaseAdmin
              .from("user_roles")
              .upsert({ user_id: uid, role: "school_admin" }, { onConflict: "user_id,role" });

            // 4) Patch profile
            await supabaseAdmin.from("profiles").upsert({
              id: uid,
              school_id: school.id,
              full_name: directorName,
              email: directorEmail,
              role: "school_admin",
              must_change_password: true,
              is_active: true,
            }, { onConflict: "id" });

            return Response.json({
              ok: true,
              schoolId: school.id,
              schoolName: school.name,
              directorEmail,
              tempPassword,
            });
          }

          if (action === "update-status") {
            const { schoolId, status } = body;
            if (!schoolId || !["active", "trial", "suspended", "expired"].includes(status)) {
              return Response.json({ error: "Paramètres invalides" }, { status: 400 });
            }
            const { error } = await supabaseAdmin.from("schools").update({ status }).eq("id", schoolId);
            if (error) return safeError("super-admin", 500, error);
            return Response.json({ ok: true });
          }

          if (action === "update-subscription") {
            const { schoolId, plan, status, subscriptionStart, subscriptionEnd, trialEnd, hasTransportAddon } = body;
            if (!schoolId || !plan || !["active", "trial", "suspended", "expired"].includes(status)) {
              return Response.json({ error: "Paramètres invalides" }, { status: 400 });
            }
            const patch: Record<string, unknown> = {
              subscription_plan: plan,
              status,
              subscription_start: subscriptionStart || null,
              subscription_end: subscriptionEnd || null,
              trial_ends_at: trialEnd || null,
            };
            if (typeof hasTransportAddon === "boolean") {
              patch.has_transport_addon = hasTransportAddon;
            }
            const { error } = await (supabaseAdmin.from("schools") as any).update(patch).eq("id", schoolId);
            if (error) return safeError("super-admin", 500, error);
            console.log("[super-admin] subscription updated", { schoolId, plan, status, hasTransportAddon, by: ctx.userId });
            return Response.json({ ok: true });
          }

          if (action === "update-plan") {
            const { schoolId, plan } = body;
            if (!schoolId || !plan) return Response.json({ error: "Paramètres invalides" }, { status: 400 });
            const { error } = await supabaseAdmin.from("schools").update({ subscription_plan: plan }).eq("id", schoolId);
            if (error) return safeError("super-admin", 500, error);
            return Response.json({ ok: true });
          }

          if (action === "extend-trial") {
            const { schoolId, trialEndsAt } = body;
            if (!schoolId || !trialEndsAt) return Response.json({ error: "Paramètres invalides" }, { status: 400 });
            const { error } = await supabaseAdmin
              .from("schools").update({ trial_ends_at: trialEndsAt, status: "trial" }).eq("id", schoolId);
            if (error) return safeError("super-admin", 500, error);
            return Response.json({ ok: true });
          }

          if (action === "delete-school") {
            const { schoolId, confirm } = body;
            if (!schoolId || confirm !== "DELETE") {
              return Response.json({ error: "Confirmation requise" }, { status: 400 });
            }
            // Find admin users of that school to delete their auth accounts
            const { data: members } = await supabaseAdmin
              .from("profiles").select("id").eq("school_id", schoolId);
            const memberIds = (members ?? []).map((m) => m.id);

            // Cascade: clear ALL per-school data then the school itself.
            // Order matters: delete children before parents to satisfy FKs.
            const tables = [
              // Grading / attendance / discipline
              "grades","attendance","discipline_records",
              // Announcements (reads reference announcements)
              "announcement_reads","announcements",
              // Notifications
              "notifications",
              // Finance — child rows first
              "payment_records","invoices","fee_types",
              "budget_lines","budgets",
              "transactions","transaction_categories","suppliers",
              "payment_subscriptions",
              // Payroll / staff
              "payroll_history","payroll","staff_leave","staff",
              // Transport — children first
              "student_transport","route_stops","transport_routes",
              "vehicle_documents","vehicles","drivers",
              // Timetable / class links
              "timetable","class_subjects","class_teachers",
              // Core entities
              "parent_students","students","parents","teachers","classes",
              // Calendar & academic
              "events","academic_years",
              // Audit last
              "audit_logs",
            ] as const;
            for (const t of tables) {
              await (supabaseAdmin.from(t) as any).delete().eq("school_id", schoolId);
            }
            // Delete profiles + roles + auth users
            for (const uid of memberIds) {
              await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
              await supabaseAdmin.from("profiles").delete().eq("id", uid);
              await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {});
            }
            await supabaseAdmin.from("schools").delete().eq("id", schoolId);
            await logAuditServer(supabaseAdmin, {
              schoolId, userId: ctx.userId, userName: "Super Admin",
              action: "data_reset", targetType: "school", targetId: schoolId,
              details: { operation: "delete-school" },
            });
            return Response.json({ ok: true });
          }


          if (action === "renew-subscription") {
            const { schoolId, plan, months, amount, paymentMethod, reference } = body;
            if (!schoolId || !plan || !months) {
              return Response.json({ error: "Paramètres invalides" }, { status: 400 });
            }
            const { data: cur } = await supabaseAdmin.from("schools")
              .select("subscription_end, subscription_start").eq("id", schoolId).maybeSingle();
            const today = new Date();
            const baseEnd = cur?.subscription_end ? new Date(cur.subscription_end as string) : today;
            const start = baseEnd > today ? baseEnd : today;
            const newEnd = new Date(start);
            newEnd.setMonth(newEnd.getMonth() + Number(months));
            const periodStart = (cur?.subscription_end as string | null) ?? today.toISOString().slice(0, 10);
            const periodEnd = newEnd.toISOString().slice(0, 10);

            const { error: uErr } = await (supabaseAdmin.from("schools") as any).update({
              subscription_plan: plan,
              status: "active",
              subscription_start: (cur?.subscription_start as string | null) ?? today.toISOString().slice(0, 10),
              subscription_end: periodEnd,
              trial_ends_at: null,
            }).eq("id", schoolId);
            if (uErr) return safeError("super-admin", 500, uErr);

            const { error: pErr } = await (supabaseAdmin.from("payment_subscriptions") as any).insert({
              school_id: schoolId, plan,
              amount: Number(amount ?? 0),
              payment_method: paymentMethod ?? null,
              status: "paid",
              period_start: periodStart, period_end: periodEnd,
              reference: reference ?? null,
              recorded_by: ctx.userId,
            });
            if (pErr) return safeError("super-admin", 500, pErr);
            return Response.json({ ok: true, newEnd: periodEnd });
          }

          if (action === "convert-trial") {
            const { schoolId, plan, months, amount, paymentMethod, reference } = body;
            if (!schoolId || !plan || !months) {
              return Response.json({ error: "Paramètres invalides" }, { status: 400 });
            }
            const today = new Date();
            const newEnd = new Date(today);
            newEnd.setMonth(newEnd.getMonth() + Number(months));
            const periodStart = today.toISOString().slice(0, 10);
            const periodEnd = newEnd.toISOString().slice(0, 10);

            const { error: uErr } = await (supabaseAdmin.from("schools") as any).update({
              subscription_plan: plan,
              status: "active",
              subscription_start: periodStart,
              subscription_end: periodEnd,
              trial_ends_at: null,
            }).eq("id", schoolId);
            if (uErr) return safeError("super-admin", 500, uErr);

            const { error: pErr } = await (supabaseAdmin.from("payment_subscriptions") as any).insert({
              school_id: schoolId, plan,
              amount: Number(amount ?? 0),
              payment_method: paymentMethod ?? null,
              status: "paid",
              period_start: periodStart, period_end: periodEnd,
              reference: reference ?? null,
              recorded_by: ctx.userId,
            });
            if (pErr) return safeError("super-admin", 500, pErr);
            return Response.json({ ok: true, newEnd: periodEnd });
          }

          if (action === "list-subscription-payments") {
            const { schoolId } = body;
            if (!schoolId) return Response.json({ error: "Paramètres invalides" }, { status: 400 });
            const { data, error } = await supabaseAdmin
              .from("payment_subscriptions")
              .select("id, plan, amount, payment_date, payment_method, status, period_start, period_end, reference")
              .eq("school_id", schoolId)
              .order("payment_date", { ascending: false });
            if (error) return safeError("super-admin", 500, error);
            return Response.json({ ok: true, payments: data ?? [] });
          }

          if (action === "broadcast-announcement") {
            const message = String(body?.message ?? "").trim();
            if (!message) return Response.json({ error: "Message requis" }, { status: 400 });
            // Fan-out an in-app notification to every profile (all schools, all roles).
            const { data: profiles, error: pErr } = await supabaseAdmin
              .from("profiles")
              .select("id, school_id")
              .not("school_id", "is", null);
            if (pErr) return safeError("super-admin", 500, pErr);
            const rows = (profiles ?? []).map((p: any) => ({
              school_id: p.school_id,
              recipient_id: p.id,
              type: "custom",
              title: "Maintenance programmée",
              message,
              link: null,
            }));
            if (rows.length) {
              // Insert in chunks to stay well under any payload limits.
              const chunkSize = 500;
              for (let i = 0; i < rows.length; i += chunkSize) {
                const { error: iErr } = await supabaseAdmin
                  .from("notifications")
                  .insert(rows.slice(i, i + chunkSize));
                if (iErr) return safeError("super-admin", 500, iErr);
              }
            }
            console.info("[super-admin] announcement broadcast", { by: ctx.userId, recipients: rows.length });
            return Response.json({ ok: true, recipients: rows.length });
          }

          return Response.json({ error: "Action inconnue" }, { status: 400 });
        } catch (e) {
          console.error("[super-admin]", e);
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
