import { type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sidebar, MobileNav } from "./Sidebar";
import { Header } from "./Header";
import { useAuth } from "@/lib/auth";
import { allowedRoutes, NAV_ITEMS } from "@/lib/nav";
import { ChevronRight, ShieldAlert } from "lucide-react";
import { Button } from "./ui/button";

export function AppLayout({ title, children }: { title: string; children: ReactNode }) {
  const { user, originalUser, isImpersonating, stopImpersonating, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    // Real super_admin without impersonation → platform console
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
    if (!allowed.includes(pathname)) {
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
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

export function pageTitle(pathname: string) {
  return NAV_ITEMS.find((i) => i.to === pathname)?.label ?? "SchoolMaster";
}
