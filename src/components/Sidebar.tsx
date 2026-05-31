import { Link, useRouterState } from "@tanstack/react-router";
import { NAV_ITEMS } from "@/lib/nav";
import { Logo } from "./Logo";
import { PlanBadge } from "./PlanBadge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { LogOut } from "lucide-react";

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { logout, user } = useAuth();
  const items = NAV_ITEMS.filter((i) => !user || !i.roles || i.roles.includes(user.role));

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active && "border-accent bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
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

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const items = NAV_ITEMS.filter((i) => !user || !i.roles || i.roles.includes(user.role)).slice(0, 5);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-sidebar-border bg-sidebar px-1 py-1.5 md:hidden">
      {items.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 rounded-md py-1 text-[10px] font-medium text-sidebar-foreground/70",
              active && "text-accent",
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="truncate">{item.label.split(" ")[0]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
