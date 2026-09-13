import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public: the VAPID application server key the browser needs to subscribe. */
export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env["VAPID_PUBLIC_KEY"] ?? "" };
});

export interface SavePushInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SavePushInput) => {
    if (!input?.endpoint || !input.p256dh || !input.auth) throw new Error("Invalid subscription");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
        enabled: true,
      },
      { onConflict: "endpoint" },
    );
    if (error) {
      console.error("[push] save subscription failed", error);
      throw new Error("Internal server error");
    }
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string }) => {
    if (!input?.endpoint) throw new Error("Invalid subscription");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    if (error) {
      console.error("[push] remove subscription failed", error);
      throw new Error("Internal server error");
    }
    return { ok: true };
  });

/** Current-user-only diagnostic status. Never returns endpoint keys or secrets. */
export const getPushSubscriptionDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint?: string }) => ({ endpoint: input?.endpoint ?? "" }))
  .handler(async ({ data, context }) => {
    const { data: subscriptions, error } = await context.supabase
      .from("push_subscriptions")
      .select("endpoint, enabled")
      .eq("user_id", context.userId);
    if (error) {
      console.error("[push] diagnostic subscription lookup failed", error);
      throw new Error("Internal server error");
    }
    const enabled = (subscriptions ?? []).filter((subscription) => subscription.enabled);
    return {
      savedCount: enabled.length,
      currentDeviceSaved: !!data.endpoint && enabled.some((subscription) => subscription.endpoint === data.endpoint),
    };
  });
