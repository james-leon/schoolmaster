import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { NAV_ITEMS } from "@/lib/nav";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { usePlan } from "@/lib/usePlan";
import { requiredPlanFor, addonRequiredFor } from "@/lib/plans";
import { toast } from "sonner";
import { LogOut, Lock, LayoutGrid } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// Section grouping (mockup): Pilotage / Scolarité / Finances / Pédagogie /
// Communication / Ressources humaines / Logistique. Routes not listed render
// without a header (e.g. /parametres at the bottom).
const NAV_GROUPS: { label: string; routes: string[] }[] = [
  { label: "Pilotage", routes: ["/dashboard"] },
  { label: "Scolarité", routes: ["/eleves", "/parents", "/classes"] },
  { label: "Finances", routes: ["/scolarite", "/comptabilite", "/budget"] },
  { label: "Pédagogie", routes: ["/notes", "/presences", "/emploi-du-temps", "/calendrier"] },
  { label: "Communication", routes: ["/annonces"] },
  { label: "Ressources humaines", routes: ["/enseignants", "/personnel"] },
  { label: "Logistique", routes: ["/transport"] },
  { label: "Système", routes: ["/parametres"] },
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { logout, user } = useAuth();
  const { hasFeature } = usePlan();
  const navigate = useNavigate();
  const items = NAV_ITEMS.filter((i) => !user || !i.roles || i.roles.includes(user.role));
  const byPath = new Map(items.map((i) => [i.to, i]));

  const renderItem = (item: (typeof items)[number]) => {
    const active = pathname === item.to;
    const locked = !!(item.feature && user?.role !== "super_admin" && !hasFeature(item.feature));
    const base =
      "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors";
    const className = cn(
      base,
      active
        ? "bg-white/10 text-white"
        : "text-white/70 hover:bg-white/5 hover:text-white",
      locked && "opacity-70",
    );
    const inner = (
      <>
        {active && (
          <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-[#F58B1F]" />
        )}
        <item.icon className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 truncate">{item.label}</span>
        {locked && <Lock className="h-3.5 w-3.5 text-white/40" />}
      </>
    );
    if (locked && item.feature) {
      const addon = addonRequiredFor(item.feature);
      const req = requiredPlanFor(item.feature);
      const msg = addon
        ? `🔒 ${item.label} nécessite l'option ${addon.label}. Contactez Wintek pour l'activer.`
        : `🔒 ${item.label} est disponible avec le plan ${req.label}. Contactez Wintek pour mettre à niveau.`;
      return (
        <button
          key={item.to}
          type="button"
          onClick={() => {
            toast.info(msg);
            navigate({ to: "/mon-abonnement" });
          }}
          className={cn(className, "w-full text-left")}
        >
          {inner}
        </button>
      );
    }
    return (
      <Link key={item.to} to={item.to} className={className}>
        {inner}
      </Link>
    );
  };

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col text-white md:flex"
      style={{ background: "linear-gradient(180deg, #0D2C54 0%, #0A2447 100%)" }}
    >
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-3 pt-2">
        {NAV_GROUPS.map((group) => {
          const groupItems = group.routes.map((r) => byPath.get(r)).filter(Boolean) as typeof items;
          if (!groupItems.length) return null;
          return (
            <div key={group.label} className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                {group.label}
              </div>
              {groupItems.map(renderItem)}
            </div>
          );
        })}
      </nav>
      <div className="space-y-2 p-3">
        {user?.role === "school_admin" && (
          <Link
            to="/mon-abonnement"
            className="block rounded-xl bg-white/5 p-3 ring-1 ring-white/10 transition hover:bg-white/10"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F58B1F]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#F58B1F]">
              Plan School+
            </span>
            <p className="mt-2 text-[11px] leading-snug text-white/70">
              Toutes les fonctionnalités sont actives pour votre établissement.
            </p>
          </Link>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
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
      "flex flex-1 flex-col items-center gap-0.5 rounded-md py-1 text-[10px] font-medium text-white/70",
      active && "text-[#F58B1F]",
    );

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex justify-around px-1 py-1.5 md:hidden"
        style={{ background: "linear-gradient(180deg, #0D2C54 0%, #0A2447 100%)" }}
      >
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
