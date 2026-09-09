import { createFileRoute } from "@tanstack/react-router";
import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";

/**
 * Internal endpoint called by the database trigger when an in-app notification
 * is created. Delivers the same content as a Web Push message to every device
 * the recipient has registered. Callers must present the shared dispatch secret.
 */
export const Route = createFileRoute("/api/public/push-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["PUSH_DISPATCH_SECRET"];
        const provided = request.headers.get("x-push-secret");
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const body = (await request.json()) as { notification_id?: string };
          if (!body?.notification_id) return new Response("Bad request", { status: 400 });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: notification, error: nErr } = await supabaseAdmin
            .from("notifications")
            .select("id, recipient_id, title, message, link, type")
            .eq("id", body.notification_id)
            .maybeSingle();
          if (nErr || !notification) return new Response("ok");

          const { data: subs } = await supabaseAdmin
            .from("push_subscriptions")
            .select("id, endpoint, p256dh, auth")
            .eq("user_id", notification.recipient_id)
            .eq("enabled", true);

          if (!subs || subs.length === 0) return new Response("ok");

          const vapid = {
            subject: process.env["VAPID_SUBJECT"] ?? "mailto:support@schoolmaster.app",
            publicKey: process.env["VAPID_PUBLIC_KEY"] ?? "",
            privateKey: process.env["VAPID_PRIVATE_KEY"] ?? "",
          };
          if (!vapid.publicKey || !vapid.privateKey) return new Response("ok");

          const data = JSON.stringify({
            title: notification.title,
            body: notification.message,
            url: notification.link || "/notifications",
            tag: `notif-${notification.id}`,
          });

          const stale: string[] = [];
          await Promise.all(
            subs.map(async (sub) => {
              const subscription: PushSubscription = {
                endpoint: sub.endpoint,
                expirationTime: null,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              };
              try {
                const payload = await buildPushPayload({ data, options: { ttl: 3600 } }, subscription, vapid);
                const res = await fetch(sub.endpoint, payload);
                if (res.status === 404 || res.status === 410) stale.push(sub.id);
              } catch (err) {
                console.error("[push] delivery failed", err);
              }
            }),
          );

          if (stale.length > 0) {
            await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
          }

          return new Response("ok");
        } catch (err) {
          console.error("[push-dispatch]", err);
          return new Response("Internal server error", { status: 500 });
        }
      },
    },
  },
});
