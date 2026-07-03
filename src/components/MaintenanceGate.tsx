import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Wrench, RefreshCw, Loader2 } from "lucide-react";

type Settings = {
  maintenance_active: boolean;
  maintenance_message: string | null;
  maintenance_expected_return: string | null;
};

const REFRESH_MS = 60_000;

function formatDateTime(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(d);
  } catch {
    return null;
  }
}

export function MaintenanceGate({ children }: { children: ReactNode }) {
  const { originalUser } = useAuth();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const [settings, setSettings] = useState<Settings | null>(null);
  const [checking, setChecking] = useState(false);

  const fetchSettings = useCallback(async () => {
    setChecking(true);
    try {
      const { data } = await supabase
        .from("platform_settings")
        .select("maintenance_active, maintenance_message, maintenance_expected_return")
        .eq("id", true)
        .maybeSingle();
      if (data) setSettings(data as Settings);
    } catch {
      // Silent — if the check itself fails, don't block the app.
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
    const iv = setInterval(fetchSettings, REFRESH_MS);
    const onFocus = () => fetchSettings();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchSettings]);

  const isSuperAdmin = originalUser?.role === "super_admin";
  // Always let super admins through so they can turn maintenance off.
  // Also always allow the super-admin route itself (so an unauthenticated
  // super_admin can still sign in via /login → /super-admin).
  const isSuperAdminRoute = pathname === "/super-admin" || pathname.startsWith("/super-admin/");
  const isBypassRoute = isSuperAdminRoute;

  if (settings?.maintenance_active && !isSuperAdmin && !isBypassRoute) {
    return (
      <MaintenanceScreen
        message={settings.maintenance_message}
        expectedReturn={settings.maintenance_expected_return}
        onRetry={fetchSettings}
        checking={checking}
      />
    );
  }

  return <>{children}</>;
}

function MaintenanceScreen({
  message,
  expectedReturn,
  onRetry,
  checking,
}: {
  message: string | null;
  expectedReturn: string | null;
  onRetry: () => void;
  checking: boolean;
}) {
  const returnLabel = formatDateTime(expectedReturn);
  const defaultMsg =
    "Nous effectuons une maintenance pour améliorer votre expérience. Merci de votre patience.";
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted/40 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Wrench className="h-7 w-7" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Maintenance en cours
        </h1>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {message?.trim() || defaultMsg}
        </p>
        {returnLabel && (
          <p className="mt-4 text-sm font-medium text-foreground">
            Retour prévu vers <span className="text-primary">{returnLabel}</span>
          </p>
        )}
        <div className="mt-6">
          <Button variant="outline" size="sm" onClick={onRetry} disabled={checking}>
            {checking ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Réessayer
          </Button>
        </div>
        <p className="mt-6 text-[11px] text-muted-foreground">
          Cette page se met à jour automatiquement dès la fin de la maintenance.
        </p>
      </div>
    </div>
  );
}
