import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { useDB } from "@/lib/store";
import { useNotifications, timeAgoFr, TYPE_LABEL, type Notification } from "@/lib/notifications";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Bell, AlertCircle, CreditCard, Megaphone, Calendar, Check, Trash2, Send, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, remove } = useNotifications();
  const [typeFilter, setTypeFilter] = useState<string>("all");
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
    if (n.link) navigate({ to: n.link });
  };

  const isAdmin = user?.role === "school_admin" || user?.role === "super_admin";

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
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              <Check className="mr-2 h-4 w-4" /> Tout marquer comme lu
            </Button>
          )}
          {isAdmin && <SendNotificationDialog />}
        </div>
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
              {items.map((n, i) => {
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

// -------- Admin: send manual notification --------

type Audience = "all_parents" | "class_parents" | "all_teachers" | "person";

function SendNotificationDialog() {
  const { user } = useAuth();
  const db = useDB();
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<Audience>("all_parents");
  const [classId, setClassId] = useState<string>("");
  const [personId, setPersonId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [people, setPeople] = useState<{ id: string; full_name: string; role: string }[]>([]);

  useEffect(() => {
    if (!open || !user?.schoolId) return;
    supabase.from("profiles")
      .select("id, full_name, role")
      .eq("school_id", user.schoolId)
      .in("role", ["parent", "teacher", "school_admin"])
      .order("full_name")
      .then(({ data }) => setPeople((data ?? []) as any));
  }, [open, user?.schoolId]);

  const reset = () => { setAudience("all_parents"); setClassId(""); setPersonId(""); setTitle(""); setMessage(""); };

  const send = async () => {
    if (!user?.schoolId) return;
    if (!title.trim() || !message.trim()) { toast.error("Titre et message requis"); return; }
    setSending(true);
    try {
      // Resolve recipients
      let recipientIds: string[] = [];
      if (audience === "all_parents") {
        recipientIds = people.filter((p) => p.role === "parent").map((p) => p.id);
      } else if (audience === "all_teachers") {
        recipientIds = people.filter((p) => p.role === "teacher").map((p) => p.id);
      } else if (audience === "person") {
        if (!personId) { toast.error("Choisissez un destinataire"); setSending(false); return; }
        recipientIds = [personId];
      } else if (audience === "class_parents") {
        if (!classId) { toast.error("Choisissez une classe"); setSending(false); return; }
        const studentIds = db.students.filter((s) => s.classId === classId).map((s) => s.id);
        if (studentIds.length === 0) { toast.error("Aucun élève dans cette classe"); setSending(false); return; }
        const { data } = await supabase
          .from("parent_students")
          .select("parent_profile_id")
          .in("student_id", studentIds);
        recipientIds = Array.from(new Set((data ?? []).map((r: any) => r.parent_profile_id)));
      }

      if (recipientIds.length === 0) { toast.error("Aucun destinataire"); setSending(false); return; }

      const rows = recipientIds.map((rid) => ({
        school_id: user.schoolId!,
        recipient_id: rid,
        type: "custom",
        title: title.trim(),
        message: message.trim(),
        link: "/notifications",
      }));
      const { error } = await supabase.from("notifications").insert(rows);
      if (error) throw error;
      toast.success(`Notification envoyée à ${recipientIds.length} destinataire${recipientIds.length > 1 ? "s" : ""}`);
      reset(); setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Échec de l'envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Envoyer une notification</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle notification</DialogTitle>
          <DialogDescription>
            Envoyez une notification in-app à vos parents ou enseignants.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Destinataires</Label>
            <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_parents">Tous les parents</SelectItem>
                <SelectItem value="class_parents">Parents d'une classe</SelectItem>
                <SelectItem value="all_teachers">Tous les enseignants</SelectItem>
                <SelectItem value="person">Une personne précise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {audience === "class_parents" && (
            <div className="space-y-1.5">
              <Label>Classe</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
                <SelectContent>
                  {db.classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {audience === "person" && (
            <div className="space-y-1.5">
              <Label>Personne</Label>
              <Select value={personId} onValueChange={setPersonId}>
                <SelectTrigger><SelectValue placeholder="Choisir une personne" /></SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Titre</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Réunion parents-professeurs" />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Votre message..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>Annuler</Button>
          <Button onClick={send} disabled={sending}>
            <Send className="mr-2 h-4 w-4" /> {sending ? "Envoi..." : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
