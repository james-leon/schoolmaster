import { Bell, Moon, Sun, User as UserIcon, LogOut, Megaphone } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useDB } from "@/lib/store";
import { ROLE_LABELS } from "@/lib/format";
import { visibleAnnouncements, formatDateFr, useUnreadCount, markAllSeen } from "@/lib/announcements";
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

const ROLE_BADGE: Record<string, string> = {
  school_admin: "bg-primary text-primary-foreground",
  super_admin: "bg-primary text-primary-foreground",
  teacher: "bg-secondary text-secondary-foreground",
  parent: "bg-success text-success-foreground",
};

export function Header({ title }: { title: string }) {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const db = useDB();
  const announcements = visibleAnnouncements(db.announcements, user?.role);
  const unread = useUnreadCount(announcements);
  const recent = announcements.slice(0, 5);

  const annoncesHref = user?.role === "parent" ? "/parent" : "/annonces";

  const initials = user?.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight md:text-xl">{title}</h1>
        {user && (
          <Badge className={`hidden sm:inline-flex ${ROLE_BADGE[user.role] ?? ""}`}>
            {ROLE_LABELS[user.role]}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {user && (
          <span className="mr-2 hidden text-sm font-medium md:inline">
            {user.role === "teacher" ? `Prof. ${user.name}` : user.name}
          </span>
        )}
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Basculer le thème">
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <DropdownMenu onOpenChange={(open) => { if (open) markAllSeen(); }}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center gap-2">
              <Megaphone className="h-4 w-4" /> Annonces récentes
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {recent.length === 0 && (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                Aucune annonce pour le moment
              </div>
            )}
            {recent.map((a) => (
              <DropdownMenuItem key={a.id} asChild className="flex flex-col items-start gap-0.5 whitespace-normal">
                <Link to={annoncesHref}>
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="line-clamp-1 font-medium">{a.title}</span>
                    <Badge variant="outline" className="text-[10px]">{a.audience}</Badge>
                  </div>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{a.content}</span>
                  <span className="text-[10px] text-muted-foreground">{formatDateFr(a.createdAt)}</span>
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to={annoncesHref} className="justify-center text-sm font-medium text-primary">
                Voir toutes les annonces
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 rounded-full outline-none">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
                  {initials || <UserIcon className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="font-medium">{user?.name}</div>
              <div className="text-xs font-normal text-muted-foreground">{user ? ROLE_LABELS[user.role] : ""}</div>
            </DropdownMenuLabel>
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
