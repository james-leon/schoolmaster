import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
              .select("id, name, city, country, email, phone, subscription_plan, status, trial_ends_at, subscription_start, subscription_end, created_at, director_name")
              .order("created_at", { ascending: false });
            if (error) return Response.json({ error: error.message }, { status: 500 });

            // Student counts per school
            const { data: students } = await supabaseAdmin.from("students").select("school_id");
            const countsBySchool: Record<string, number> = {};
            for (const s of students ?? []) {
              countsBySchool[s.school_id] = (countsBySchool[s.school_id] ?? 0) + 1;
            }
            const enriched = (schools ?? []).map((s) => ({
              ...s,
              student_count: countsBySchool[s.id] ?? 0,
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
            if (sErr) return Response.json({ error: sErr.message }, { status: 500 });

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
              return Response.json({ error: cErr?.message ?? "Création du compte échouée" }, { status: 400 });
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
            if (error) return Response.json({ error: error.message }, { status: 500 });
            return Response.json({ ok: true });
          }

          if (action === "update-subscription") {
            const { schoolId, plan, status, subscriptionStart, subscriptionEnd, trialEnd } = body;
            if (!schoolId || !plan || !["active", "trial", "suspended", "expired"].includes(status)) {
              return Response.json({ error: "Paramètres invalides" }, { status: 400 });
            }
            const patch = {
              subscription_plan: plan,
              status,
              subscription_start: subscriptionStart || null,
              subscription_end: subscriptionEnd || null,
              trial_ends_at: trialEnd || null,
            };
            const { error } = await (supabaseAdmin.from("schools") as any).update(patch).eq("id", schoolId);
            if (error) return Response.json({ error: error.message }, { status: 500 });
            console.log("[super-admin] subscription updated", { schoolId, plan, status, by: ctx.userId });
            return Response.json({ ok: true });
          }

          if (action === "update-plan") {
            const { schoolId, plan } = body;
            if (!schoolId || !plan) return Response.json({ error: "Paramètres invalides" }, { status: 400 });
            const { error } = await supabaseAdmin.from("schools").update({ subscription_plan: plan }).eq("id", schoolId);
            if (error) return Response.json({ error: error.message }, { status: 500 });
            return Response.json({ ok: true });
          }

          if (action === "extend-trial") {
            const { schoolId, trialEndsAt } = body;
            if (!schoolId || !trialEndsAt) return Response.json({ error: "Paramètres invalides" }, { status: 400 });
            const { error } = await supabaseAdmin
              .from("schools").update({ trial_ends_at: trialEndsAt, status: "trial" }).eq("id", schoolId);
            if (error) return Response.json({ error: error.message }, { status: 500 });
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

            // Cascade: clear per-school data then the school itself
            const tables = [
              "grades","attendance","payment_records","invoices","fee_types",
              "class_subjects","students","teachers","classes","parents",
              "announcements","academic_years",
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
            return Response.json({ ok: true });
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
