import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { NAV_ITEMS } from "@/lib/nav";
import { Logo } from "./Logo";
import { PlanBadge } from "./PlanBadge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { usePlan } from "@/lib/usePlan";
import { requiredPlanFor } from "@/lib/plans";
import { toast } from "sonner";
import { LogOut, Lock, LayoutGrid } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";


export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { logout, user } = useAuth();
  const { hasFeature, daysUntilExpiry, subscriptionEnd } = usePlan();
  const navigate = useNavigate();
  const items = NAV_ITEMS.filter((i) => !user || !i.roles || i.roles.includes(user.role));

  const expiryTone =
    daysUntilExpiry == null ? "" :
    daysUntilExpiry < 7 ? "text-destructive" :
    daysUntilExpiry <= 15 ? "text-accent" : "text-success";

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active = pathname === item.to;
          const locked = !!(item.feature && user?.role !== "super_admin" && !hasFeature(item.feature));
          const className = cn(
            "flex items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            active && "border-accent bg-sidebar-accent text-sidebar-accent-foreground",
            locked && "opacity-70",
          );
          if (locked && item.feature) {
            const req = requiredPlanFor(item.feature);
            return (
              <button
                key={item.to}
                type="button"
                onClick={() => {
                  toast.info(`🔒 ${item.label} est disponible avec le plan ${req.label}. Contactez Wintek pour mettre à niveau.`);
                  navigate({ to: "/mon-abonnement" });
                }}
                className={cn(className, "w-full text-left")}
              >
                <item.icon className="h-[18px] w-[18px]" />
                <span className="flex-1">{item.label}</span>
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            );
          }
          return (
            <Link key={item.to} to={item.to} className={className}>
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 border-t border-sidebar-border p-3">
        {user?.role === "school_admin" && (
          <Link
            to="/mon-abonnement"
            className="flex flex-col items-center gap-1 rounded-md bg-sidebar-accent/40 px-3 py-2 hover:bg-sidebar-accent"
          >
            <PlanBadge />
            {daysUntilExpiry != null && subscriptionEnd && (
              <span className={cn("text-[10px] font-medium", expiryTone)}>
                {daysUntilExpiry < 0
                  ? "Expiré"
                  : daysUntilExpiry === 0
                  ? "Expire aujourd'hui"
                  : `Expire dans ${daysUntilExpiry} j`}
              </span>
            )}
          </Link>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}

const PRIMARY_BY_ROLE: Record<string, string[]> = {
  school_admin: ["/dashboard", "/eleves", "/scolarite", "/notes"],
  super_admin: ["/dashboard", "/eleves", "/scolarite", "/notes"],
  teacher: ["/dashboard", "/eleves", "/notes", "/presences"],
};

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const allItems = NAV_ITEMS.filter((i) => !user || !i.roles || i.roles.includes(user.role));
  const primaryPaths = (user && PRIMARY_BY_ROLE[user.role]) ?? allItems.slice(0, 4).map((i) => i.to);
  const primary = primaryPaths
    .map((p) => allItems.find((i) => i.to === p))
    .filter((i): i is (typeof allItems)[number] => !!i)
    .slice(0, 4);
  const primarySet = new Set(primary.map((i) => i.to));
  const overflow = allItems.filter((i) => !primarySet.has(i.to));
  const plusActive = overflow.some((i) => i.to === pathname);

  const tabClass = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center gap-0.5 rounded-md py-1 text-[10px] font-medium text-sidebar-foreground/70",
      active && "text-accent",
    );

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-sidebar-border bg-sidebar px-1 py-1.5 md:hidden">
        {primary.map((item) => {
          const active = pathname === item.to;
          return (
            <Link key={item.to} to={item.to} className={tabClass(active)}>
              <item.icon className="h-5 w-5" />
              <span className="truncate">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
        {overflow.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={tabClass(plusActive)}
            aria-label="Plus de modules"
          >
            <LayoutGrid className="h-5 w-5" />
            <span className="truncate">Plus</span>
          </button>
        )}
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0">
          <SheetHeader className="border-b px-4 py-3 text-left">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="grid max-h-[70vh] grid-cols-1 gap-1 overflow-y-auto p-3">
            {overflow.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium hover:bg-accent/10",
                    active && "bg-accent/10 text-accent",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

