import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Public server route used by the school-signup flow. Verifies the caller's
 * Supabase access token, then uses the admin client to create the school,
 * the user_role row, and patch the new user's profile. This bypasses the
 * chicken-and-egg RLS problem (insert into `schools` requires `school_admin`
 * role, but the role can't be self-granted from the client).
 */
export const Route = createFileRoute("/api/public/register-school")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }
          const token = auth.slice(7);

          // Verify the token with the Auth server
          const url = process.env.SUPABASE_URL!;
          const anon = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const verifier = createClient(url, anon);
          const { data: userRes, error: userErr } = await verifier.auth.getUser(token);
          if (userErr || !userRes.user) {
            return Response.json({ error: "Invalid token" }, { status: 401 });
          }
          const userId = userRes.user.id;

          // Guard: reject if user already has any role or is already linked to a school.
          // Prevents role escalation by re-registering.
          const [{ data: existingRoles }, { data: existingProfile }] = await Promise.all([
            supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).limit(1),
            supabaseAdmin.from("profiles").select("school_id, role").eq("id", userId).maybeSingle(),
          ]);
          if ((existingRoles && existingRoles.length > 0) || existingProfile?.school_id || existingProfile?.role) {
            return Response.json({ error: "Compte déjà associé à une école" }, { status: 409 });
          }

          const body = await request.json();
          const { schoolName, director, email, phone, city, country } = body ?? {};
          if (!schoolName || !director || !email) {
            return Response.json({ error: "Champs requis manquants" }, { status: 400 });
          }

          // 1) Create the school
          const { data: school, error: sErr } = await supabaseAdmin
            .from("schools")
            .insert({
              name: String(schoolName).slice(0, 200),
              director_name: String(director).slice(0, 200),
              email: String(email).slice(0, 200),
              phone: phone ? String(phone).slice(0, 50) : null,
              city: city ? String(city).slice(0, 100) : null,
              country: country ? String(country).slice(0, 100) : null,
              subscription_plan: "free",
            })
            .select()
            .single();
          if (sErr) return Response.json({ error: sErr.message }, { status: 500 });

          // 2) Grant school_admin role
          await supabaseAdmin
            .from("user_roles")
            .upsert({ user_id: userId, role: "school_admin" }, { onConflict: "user_id,role" });

          // 3) Patch profile
          const { error: pErr } = await supabaseAdmin
            .from("profiles")
            .upsert(
              {
                id: userId,
                school_id: school.id,
                full_name: String(director).slice(0, 200),
                email: String(email).slice(0, 200),
                role: "school_admin",
              },
              { onConflict: "id" },
            );
          if (pErr) return Response.json({ error: pErr.message }, { status: 500 });

          return Response.json({ ok: true, schoolId: school.id });
        } catch (e) {
          console.error("[register-school]", e);
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
