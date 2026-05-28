import { type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sidebar, MobileNav } from "./Sidebar";
import { Header } from "./Header";
import { useAuth } from "@/lib/auth";
import { NAV_ITEMS } from "@/lib/nav";
import { ChevronRight } from "lucide-react";

export function AppLayout({ title, children }: { title: string; children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (user === null) {
      const stored = localStorage.getItem("schoolmaster_session");
      if (!stored) navigate({ to: "/login" });
    }
  }, [user, navigate]);

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
