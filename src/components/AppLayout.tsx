import { type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sidebar, MobileNav } from "./Sidebar";
import { Header } from "./Header";
import { useAuth } from "@/lib/auth";
import { allowedRoutes, NAV_ITEMS } from "@/lib/nav";
import { ChevronRight } from "lucide-react";

export function AppLayout({ title, children }: { title: string; children: ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    // Wait for auth to finish hydrating before deciding anything.
    if (loading) return;
    if (!isAuthenticated || !user) {
      navigate({ to: "/login", replace: true });
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
  }, [user, loading, isAuthenticated, navigate, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background">
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
