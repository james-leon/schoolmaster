import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Bell, Share, X } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/lib/auth";
import { isIosWithoutStandalone, isPushSupported, usePushStatus } from "@/lib/push";

const DISMISS_KEY = "sm_push_prompt_dismissed";
const IOS_DISMISS_KEY = "sm_push_ios_install_dismissed";

/**
 * Friendly first-visit prompt inviting the user to enable push notifications.
 * Never blocks the UI — dismissing it hides it for good (they can still enable
 * push later from Paramètres › Mon compte).
 */
export function PushPermissionPrompt() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { state, subscribed, loading, busy, enable } = usePushStatus();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const iosHint = isIosWithoutStandalone();
  const visible =
    !!user && !loading && !dismissed && !subscribed && isPushSupported() && state === "default" && !iosHint;

  if (!visible) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const accept = async () => {
    try {
      const next = await enable();
      if (next === "granted") toast.success(t("push.enabled"));
      window.localStorage.setItem(DISMISS_KEY, "1");
      setDismissed(true);
    } catch {
      toast.error(t("push.error"));
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-xl border border-border bg-card p-4 shadow-lg md:bottom-6 md:right-6 md:left-auto md:mx-0">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bell className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t("push.promptTitle")}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("push.promptBody")}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={accept} disabled={busy}>
              {t("push.enable")}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {t("push.later")}
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("push.later")}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
