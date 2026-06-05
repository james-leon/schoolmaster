import { type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sidebar, MobileNav } from "./Sidebar";
import { Header } from "./Header";
import { AppFooter } from "./AppFooter";
import { PrivacyConsentGate } from "./PrivacyConsentGate";
import { useAuth } from "@/lib/auth";
import { allowedRoutes, NAV_ITEMS } from "@/lib/nav";
import { usePlan } from "@/lib/usePlan";
import { ChevronRight, ShieldAlert, AlertOctagon, Clock } from "lucide-react";
import { Button } from "./ui/button";
import { WINTEK_CONTACT } from "@/lib/plans";

export function AppLayout({ title, children }: { title: string; children: ReactNode }) {
  const { user, originalUser, isImpersonating, stopImpersonating, logout, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isBlocked, isTrial, daysLeftInTrial, daysUntilExpiry, effectiveStatus, plan, subscriptionEnd } = usePlan();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (originalUser?.role === "super_admin" && !isImpersonating) {
      navigate({ to: "/super-admin", replace: true });
      return;
    }
    if (user.mustChangePassword && pathname !== "/changer-mot-de-passe") {
      navigate({ to: "/changer-mot-de-passe", replace: true });
      return;
    }
    if (user.role === "parent") {
      navigate({ to: "/parent", replace: true });
      return;
    }
    const allowed = allowedRoutes(user.role);
    const isAllowed = allowed.some((r) => pathname === r || pathname.startsWith(r + "/"));
    if (!isAllowed) {
      navigate({ to: "/unauthorized", replace: true });
    }
  }, [user, originalUser, isImpersonating, loading, isAuthenticated, navigate, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  // Subscription block — only applies to school members, not super admin viewing their console
  if (isBlocked && user.role !== "super_admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md rounded-lg border border-destructive/30 bg-card p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertOctagon className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold">
            {effectiveStatus === "suspended" ? "Compte suspendu" : "Abonnement expiré"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {effectiveStatus === "suspended"
              ? "Votre abonnement a été suspendu. Contactez Wintek pour réactiver votre école."
              : "Votre abonnement a expiré. Contactez Wintek pour réactiver l'accès à votre école."}
          </p>
          <div className="mt-4 rounded-md bg-muted p-3 text-sm">
            <div>{WINTEK_CONTACT.phone}</div>
            <div>{WINTEK_CONTACT.email}</div>
          </div>
          <Button variant="outline" className="mt-6" onClick={logout}>Déconnexion</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {isImpersonating && originalUser && (
        <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-accent px-4 py-2 text-accent-foreground">
          <div className="flex items-center gap-2 text-sm">
            <ShieldAlert className="h-4 w-4" />
            <span>
              Mode support — connecté en tant que <strong>{user.schoolId ? "cette école" : ""}</strong>{" "}
              (super admin: {originalUser.name})
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => { stopImpersonating(); navigate({ to: "/super-admin" }); }}
          >
            Retour Super Admin
          </Button>
        </div>
      )}
      {isTrial && daysLeftInTrial != null && user.role !== "super_admin" && (
        <div className="flex items-center justify-center gap-2 bg-accent/15 px-4 py-1.5 text-xs text-accent">
          <Clock className="h-3.5 w-3.5" />
          Période d'essai (plan {plan.label}) — {daysLeftInTrial} jour{daysLeftInTrial > 1 ? "s" : ""} restant{daysLeftInTrial > 1 ? "s" : ""}
        </div>
      )}
      {!isTrial && !isBlocked && user.role !== "super_admin" && daysUntilExpiry != null && daysUntilExpiry <= 7 && subscriptionEnd && (
        <div className="flex items-center justify-center gap-2 bg-destructive/10 px-4 py-1.5 text-xs font-medium text-destructive">
          <Clock className="h-3.5 w-3.5" />
          ⚠️ Votre abonnement expire {daysUntilExpiry <= 0 ? "aujourd'hui" : `dans ${daysUntilExpiry} jour${daysUntilExpiry > 1 ? "s" : ""}`}. Contactez Wintek pour renouveler.
        </div>
      )}
      <Sidebar />
      <div className="md:pl-[260px]">
        <Header title={title} />
        <main className="px-4 pb-24 pt-5 md:px-6 md:pb-8">
          <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Accueil</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{title}</span>
          </nav>
          {children}
          <AppFooter className="mt-8 border-t border-border" />
        </main>
      </div>
      <MobileNav />
      <PrivacyConsentGate />
    </div>
  );
}

export function pageTitle(pathname: string) {
  return NAV_ITEMS.find((i) => i.to === pathname)?.label ?? "SchoolMaster";
}
