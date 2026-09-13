import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Bell, Share, X } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/lib/auth";
import { getStandaloneSignals, isIosWithoutStandalone, isPushSupported, usePushStatus } from "@/lib/push";

const DISMISS_KEY = "sm_push_prompt_dismissed";
const IOS_STANDALONE_DISMISS_KEY = "sm_push_prompt_ios_standalone_dismissed_v2";
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
  const [iosDismissed, setIosDismissed] = useState(true);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);
  const [iosStandalone, setIosStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const signals = getStandaloneSignals();
    setIosStandalone(signals.isIos && signals.standalone);
    setDismissed(
      window.localStorage.getItem(
        signals.isIos && signals.standalone ? IOS_STANDALONE_DISMISS_KEY : DISMISS_KEY,
      ) === "1",
    );
    setIosDismissed(window.localStorage.getItem(IOS_DISMISS_KEY) === "1");
    setIosNeedsInstall(isIosWithoutStandalone());
  }, []);

  // iPhone/iPad in Safari (not installed): purely instructional banner —
  // never request permission here, it does not work outside standalone mode.
  if (iosNeedsInstall) {
    if (!user || iosDismissed) return null;
    const dismissIos = () => {
      window.localStorage.setItem(IOS_DISMISS_KEY, "1");
      setIosDismissed(true);
    };
    return (
      <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-xl border border-border bg-card p-4 shadow-lg md:bottom-6 md:right-6 md:left-auto md:mx-0">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Share className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t("push.iosInstallTitle")}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("push.iosInstallBody")}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium">
              <Share className="h-3.5 w-3.5" />
              {t("push.iosInstallStep")}
            </p>
            <div className="mt-3">
              <Button size="sm" variant="ghost" onClick={dismissIos}>
                {t("push.gotIt")}
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissIos}
            aria-label={t("push.gotIt")}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const visible =
    !!user && !loading && !dismissed && !subscribed && isPushSupported() && state === "default";

  if (!visible) return null;

  const dismiss = () => {
    window.localStorage.setItem(iosStandalone ? IOS_STANDALONE_DISMISS_KEY : DISMISS_KEY, "1");
    setDismissed(true);
  };

  const accept = async () => {
    try {
      const next = await enable();
      if (next === "granted") toast.success(t("push.enabled"));
      window.localStorage.setItem(iosStandalone ? IOS_STANDALONE_DISMISS_KEY : DISMISS_KEY, "1");
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
