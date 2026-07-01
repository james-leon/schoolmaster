import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const GENERIC_INVALID = "Email ou mot de passe incorrect";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
          console.error("[login] missing Supabase env");
          return json(500, { error: "Service momentanément indisponible. Réessayez." });
        }

        let body: { email?: unknown; password?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json(400, { error: GENERIC_INVALID });
        }

        const email = typeof body.email === "string" ? body.email.trim() : "";
        const password = typeof body.password === "string" ? body.password : "";
        if (!email || !password || email.length > 320 || password.length > 200) {
          return json(400, { error: GENERIC_INVALID });
        }

        // Service-role client is used ONLY for the rate-limit RPCs
        // (record_login_attempt is not granted to anon).
        const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        // 1) Check lockout
        try {
          const { data, error } = await admin.rpc("check_login_lockout", { _email: email });
          if (error) throw error;
          const row = Array.isArray(data) ? data[0] : data;
          if (row?.locked) {
            const seconds = Math.max(1, Number(row.seconds_remaining ?? 900));
            return json(429, {
              error:
                "Trop de tentatives. Réessayez dans 15 minutes ou réinitialisez votre mot de passe.",
              locked: true,
              seconds_remaining: seconds,
            });
          }
        } catch (e) {
          console.error("[login] lockout check failed", e);
          // Fail closed on the rate limiter — do not attempt auth.
          return json(500, { error: "Service momentanément indisponible. Réessayez." });
        }

        // 2) Attempt sign-in with the publishable-key client (RLS + no session persistence).
        const authClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: signIn, error: signInError } = await authClient.auth.signInWithPassword({
          email,
          password,
        });

        const success = !signInError && !!signIn?.session;

        // 3) Record attempt (fire-and-forget-ish — awaited so the counter is accurate)
        try {
          await admin.rpc("record_login_attempt", { _email: email, _success: success });
        } catch (e) {
          console.error("[login] record attempt failed", e);
        }

        if (!success || !signIn?.session) {
          // Re-check lockout — this attempt may have been the 5th.
          try {
            const { data } = await admin.rpc("check_login_lockout", { _email: email });
            const row = Array.isArray(data) ? data[0] : data;
            if (row?.locked) {
              const seconds = Math.max(1, Number(row.seconds_remaining ?? 900));
              return json(429, {
                error:
                  "Trop de tentatives. Réessayez dans 15 minutes ou réinitialisez votre mot de passe.",
                locked: true,
                seconds_remaining: seconds,
              });
            }
          } catch {
            /* ignore */
          }
          return json(401, { error: GENERIC_INVALID });
        }

        return json(200, {
          access_token: signIn.session.access_token,
          refresh_token: signIn.session.refresh_token,
        });
      },
    },
  },
});
