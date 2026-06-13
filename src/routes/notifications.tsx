import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";
import { useNotifications, timeAgoFr, TYPE_LABEL, type Notification } from "@/lib/notifications";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertCircle, CreditCard, Megaphone, Calendar, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({ component: NotificationsPage });

function typeIcon(type: string) {
  if (type === "absence") return AlertCircle;
  if (type === "payment") return CreditCard;
  if (type === "announcement") return Megaphone;
  if (type === "meeting") return Calendar;
  return Bell;
}
function typeColor(type: string) {
  if (type === "absence") return "text-destructive bg-destructive/10";
  if (type === "payment") return "text-success bg-success/10";
  if (type === "announcement") return "text-primary bg-primary/10";
  if (type === "meeting") return "text-accent bg-accent/10";
  return "text-muted-foreground bg-muted";
}

function groupByDate(list: Notification[]) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const groups = new Map<string, Notification[]>();
  for (const n of list) {
    const d = new Date(n.created_at); d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime()) label = "Aujourd'hui";
    else if (d.getTime() === yesterday.getTime()) label = "Hier";
    else label = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(n);
  }
  return Array.from(groups.entries());
}

function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, remove } = useNotifications();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [readFilter, setReadFilter] = useState<string>("all");

  // Parents must stay inside the parent portal layout (bottom nav). The bell
  // there opens an in-portal sheet; if a parent reaches /notifications directly
  // (old link, deep link, etc.) send them back to /parent so they don't get
  // trapped in the admin sidebar layout.
  useEffect(() => {
    if (user?.role === "parent") navigate({ to: "/parent", replace: true });
  }, [user, navigate]);
  const [readFilter, setReadFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (readFilter === "unread" && n.read) return false;
      if (readFilter === "read" && !n.read) return false;
      return true;
    });
  }, [notifications, typeFilter, readFilter]);

  const groups = groupByDate(filtered);

  const handleClick = async (n: Notification) => {
    if (!n.read) await markAsRead(n.id);
    if (n.link && typeof n.link === "string" && n.link.startsWith("/")) {
      try { await navigate({ to: n.link }); } catch { /* invalid link — stay */ }
    }
  };

  return (
    <AppLayout title="Notifications">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="absence">Absences</SelectItem>
                <SelectItem value="payment">Paiements</SelectItem>
                <SelectItem value="announcement">Annonces</SelectItem>
                <SelectItem value="meeting">Réunions</SelectItem>
                <SelectItem value="custom">Autres</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>État</Label>
            <Select value={readFilter} onValueChange={setReadFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="unread">Non lues</SelectItem>
                <SelectItem value="read">Lues</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllAsRead}>
            <Check className="mr-2 h-4 w-4" /> Tout marquer comme lu
          </Button>
        )}
      </div>

      {filtered.length === 0 && (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <Bell className="mx-auto mb-3 h-10 w-10 opacity-40" />
          Aucune notification
        </CardContent></Card>
      )}

      <div className="space-y-6">
        {groups.map(([label, items]) => (
          <div key={label}>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{label}</h2>
            <Card><CardContent className="p-0">
              {items.map((n) => {
                const Icon = typeIcon(n.type);
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 border-b border-border p-4 last:border-b-0 cursor-pointer hover:bg-muted/40",
                      !n.read && "bg-primary/5",
                    )}
                    onClick={() => handleClick(n)}
                  >
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", typeColor(n.type))}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</span>
                        <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[n.type] ?? n.type}</Badge>
                        {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                      <span className="text-xs text-muted-foreground">{timeAgoFr(n.created_at)}</span>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </CardContent></Card>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
