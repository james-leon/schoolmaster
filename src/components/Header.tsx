import { Bell, Moon, Sun, User as UserIcon, LogOut } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/format";
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
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" />
        </Button>
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
