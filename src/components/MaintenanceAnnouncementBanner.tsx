import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, X } from "lucide-react";
import { useTranslation } from "react-i18next";

type Row = {
  maintenance_active: boolean;
  announcement_active: boolean;
  announcement_message: string | null;
  announcement_starts_at: string | null;
  announcement_ends_at: string | null;
  announcement_updated_at: string | null;
};

const REFRESH_MS = 60_000;
const DISMISS_KEY = "wintek_announcement_dismissed_at";

export function MaintenanceAnnouncementBanner() {
  const { t } = useTranslation();
  const [row, setRow] = useState<Row | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [dismissedFor, setDismissedFor] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(DISMISS_KEY);
  });

  const fetchIt = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("platform_settings")
        .select(
          "maintenance_active, announcement_active, announcement_message, announcement_starts_at, announcement_ends_at, announcement_updated_at",
        )
        .eq("id", true)
        .maybeSingle();
      if (data) setRow(data as Row);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void fetchIt();
    const iv = setInterval(fetchIt, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    const onFocus = () => {
      setNow(Date.now());
      fetchIt();
    };
    window.addEventListener("focus", onFocus);
    // Realtime: react instantly when the super admin toggles the banner
    const channel = supabase
      .channel("platform-settings-banner")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_settings" },
        () => fetchIt(),
      )
      .subscribe();
    return () => {
      clearInterval(iv);
      clearInterval(tick);
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
  }, [fetchIt]);

  if (!row) return null;
  if (row.maintenance_active) return null; // real maintenance takes over
  if (!row.announcement_active) return null;

  const starts = row.announcement_starts_at ? new Date(row.announcement_starts_at).getTime() : null;
  const ends = row.announcement_ends_at ? new Date(row.announcement_ends_at).getTime() : null;
  if (starts && now < starts) return null;
  if (ends && now > ends) return null;

  const version = row.announcement_updated_at ?? "v0";
  if (dismissedFor === version) return null;

  const msg =
    row.announcement_message?.trim() ||
    t("maintenance.banner.defaultMessage");

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, version);
    setDismissedFor(version);
  };

  return (
    <div className="sticky top-0 z-40 border-b border-amber-300/60 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-2 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
        <p className="flex-1 leading-snug">{msg}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("maintenance.banner.dismiss")}
          className="rounded p-1 text-amber-700 transition hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-500/20"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
