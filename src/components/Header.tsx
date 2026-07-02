import { Bell, Moon, Sun, User as UserIcon, LogOut, Settings, CreditCard, Shield, Megaphone, AlertCircle, Calendar, Check, Trash2, Search, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/format";
import { useNotifications, timeAgoFr, type Notification } from "@/lib/notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const ROLE_BADGE: Record<string, string> = {
  school_admin: "bg-primary text-primary-foreground",
  super_admin: "bg-primary text-primary-foreground",
  teacher: "bg-secondary text-secondary-foreground",
  parent: "bg-success text-success-foreground",
};

function typeIcon(type: string) {
  if (type === "absence") return AlertCircle;
  if (type === "payment") return CreditCard;
  if (type === "announcement") return Megaphone;
  if (type === "meeting") return Calendar;
  return Bell;
}

function typeIconColor(type: string) {
  if (type === "absence") return "text-destructive";
  if (type === "payment") return "text-success";
  if (type === "announcement") return "text-primary";
  if (type === "meeting") return "text-accent";
  return "text-muted-foreground";
}

export function Header({ title }: { title: string }) {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const recent = notifications.slice(0, 6);

  const initials = user?.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleClick = async (n: Notification) => {
    if (!n.read) await markAsRead(n.id);
    if (n.link && typeof n.link === "string" && n.link.startsWith("/")) {
      try { await navigate({ to: n.link }); } catch { /* invalid link — stay */ }
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-[#E8EDF4] bg-card px-4 md:px-6">
      <nav className="flex min-w-0 items-center gap-1.5 text-sm text-[#64748B]">
        <span className="hidden sm:inline">Accueil</span>
        <ChevronRight className="hidden h-3.5 w-3.5 sm:inline" />
        <span className="truncate font-medium text-[#0F172A]">{title}</span>
      </nav>
      <div className="flex flex-1 items-center justify-end gap-2 md:gap-3">
        <GlobalSearch />
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Basculer le thème" className="hidden md:inline-flex">
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>


        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96">
            <DropdownMenuLabel className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</span>
              {unreadCount > 0 && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.preventDefault(); markAllAsRead(); }}>
                  <Check className="mr-1 h-3 w-3" /> Tout marquer
                </Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {recent.length === 0 && (
              <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                Aucune notification
              </div>
            )}
            {recent.map((n) => {
              const Icon = typeIcon(n.type);
              return (
                <DropdownMenuItem
                  key={n.id}
                  onSelect={(e) => { e.preventDefault(); handleClick(n); }}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 whitespace-normal py-2.5",
                    !n.read && "bg-primary/5",
                  )}
                >
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", typeIconColor(n.type))} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("line-clamp-1 text-sm", !n.read && "font-semibold")}>{n.title}</span>
                      {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                    <span className="text-[10px] text-muted-foreground">{timeAgoFr(n.created_at)}</span>
                  </div>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/notifications" className="justify-center text-sm font-medium text-primary">
                Voir toutes les notifications
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 rounded-full outline-none focus:ring-2 focus:ring-ring" aria-label="Menu profil">
              <Avatar className="h-9 w-9 cursor-pointer">
                <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
                  {initials || <UserIcon className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
                  {initials || <UserIcon className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{user?.name}</div>
                {user?.email && (
                  <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
                )}
                <div className="text-xs font-normal text-muted-foreground">{user ? ROLE_LABELS[user.role] : ""}</div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/mon-profil">
                <UserIcon className="mr-2 h-4 w-4" /> Mon profil
              </Link>
            </DropdownMenuItem>
            {user?.role === "school_admin" && (
              <>
                <DropdownMenuItem asChild>
                  <Link to="/parametres">
                    <Settings className="mr-2 h-4 w-4" /> Paramètres
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/mon-abonnement">
                    <CreditCard className="mr-2 h-4 w-4" /> Mon abonnement
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            {user?.role === "super_admin" && (
              <DropdownMenuItem asChild>
                <Link to="/super-admin">
                  <Shield className="mr-2 h-4 w-4" /> Console plateforme
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={(e) => { e.preventDefault(); toggle(); }}
              className="flex items-center justify-between"
            >
              <span className="flex items-center">
                {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                Mode sombre
              </span>
              <Switch checked={theme === "dark"} onCheckedChange={toggle} />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
