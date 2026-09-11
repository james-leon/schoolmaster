import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export type NotificationType = "absence" | "payment" | "announcement" | "meeting" | "custom";

export interface Notification {
  id: string;
  school_id: string;
  recipient_id: string;
  type: NotificationType | string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) { setNotifications([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) setNotifications(data as Notification[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime subscription — unique channel name per hook instance to avoid
  // "cannot add postgres_changes callbacks after subscribe()" when multiple
  // components mount the hook (e.g. Header + NotificationsPage).
  //
  // The socket must carry the user's JWT, otherwise Realtime evaluates RLS as
  // anon and silently delivers nothing (the badge then only refreshed on a
  // cold start, which is the bug this fixes). The filter + RLS together keep
  // events scoped to this recipient only.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const upsert = (payload: {
      eventType: string;
      new: unknown;
      old: unknown;
    }) => {
      if (payload.eventType === "INSERT") {
        const n = payload.new as Notification;
        setNotifications((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev]));
      } else if (payload.eventType === "UPDATE") {
        const n = payload.new as Notification;
        setNotifications((prev) => prev.map((p) => (p.id === n.id ? n : p)));
      } else if (payload.eventType === "DELETE") {
        const o = payload.old as Notification;
        setNotifications((prev) => prev.filter((p) => p.id !== o.id));
      }
    };

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const token = data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);

      const channelName = `notifications:${user.id}:${Math.random().toString(36).slice(2)}`;
      channel = supabase
        .channel(channelName, { config: { private: false } })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
          (payload) => upsert(payload as unknown as { eventType: string; new: unknown; old: unknown }),
        )
        .subscribe((status) => {
          // Any (re)connection may have missed events while offline — resync.
          if (status === "SUBSCRIBED") void fetchAll();
        });
    })();

    // Belt-and-braces: refresh when the tab regains focus / connectivity, and
    // poll slowly so the badge is never more than a minute stale even if the
    // websocket is blocked by a proxy or the device slept.
    const onWake = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void fetchAll();
    };
    const poll = setInterval(onWake, 60_000);
    if (typeof window !== "undefined") {
      document.addEventListener("visibilitychange", onWake);
      window.addEventListener("online", onWake);
      window.addEventListener("focus", onWake);
    }

    return () => {
      cancelled = true;
      clearInterval(poll);
      if (typeof window !== "undefined") {
        document.removeEventListener("visibilitychange", onWake);
        window.removeEventListener("online", onWake);
        window.removeEventListener("focus", onWake);
      }
      if (channel) supabase.removeChannel(channel);
    };
  }, [user, fetchAll]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // App icon badging (installed PWA). Single source of truth = unreadCount.
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    try {
      if (unreadCount > 0) {
        void nav.setAppBadge?.(unreadCount)?.catch(() => {});
      } else {
        void nav.clearAppBadge?.()?.catch(() => {});
      }
    } catch {
      /* unsupported — in-app bell badge remains the fallback */
    }
  }, [unreadCount]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).eq("recipient_id", user.id).eq("read", false);
  }, [user]);

  const remove = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
  }, []);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, remove, refresh: fetchAll };
}

export function timeAgoFr(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export const TYPE_LABEL: Record<string, string> = {
  absence: "Absence",
  payment: "Paiement",
  announcement: "Annonce",
  meeting: "Réunion",
  custom: "Notification",
};
