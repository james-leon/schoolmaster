import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useDB, updateDB } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { usePlan } from "@/lib/usePlan";
import { requiredPlanFor } from "@/lib/plans";
import { LockedFeatureOverlay } from "@/components/UpgradePrompt";
import { visibleAnnouncements, formatDateFr, markAllSeen } from "@/lib/announcements";
import { markAnnouncementRead } from "@/lib/announcement-reads";
import { adminApi } from "@/lib/admin-api";
import type { Announcement } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Megaphone, Pin, PinOff, Plus, Pencil, Trash2, Eye, Phone, Mail, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/annonces")({
  component: AnnoncesPage,
});

type AudienceKind = "Tous" | "Parents" | "Enseignants" | "Classe";

interface FormState {
  id?: string;
  title: string;
  content: string;
  audience: AudienceKind;
  targetClassId: string | null;
  pinned: boolean;
}

const EMPTY: FormState = {
  title: "", content: "", audience: "Tous", targetClassId: null, pinned: false,
};

function AnnoncesPage() {
  const db = useDB();
  const { user } = useAuth();
  const { hasFeature, loading } = usePlan();

  const isAdmin = user?.role === "school_admin" || user?.role === "super_admin";

  // Build class context for parents (children's classes via local db)
  const parentClassIds = useMemo(() => {
    if (user?.role !== "parent") return [];
    const studentIds = new Set(user.studentIds ?? []);
    return db.students
      .filter((s) => studentIds.has(s.id))
      .map((s) => s.classId)
      .filter(Boolean);
  }, [user, db.students]);

  const items = visibleAnnouncements(db.announcements, user?.role, { classIds: parentClassIds });

  useEffect(() => { markAllSeen(); }, [items.length]);

  // Auto-mark as read for teacher/parent viewing the list (full content visible on the page).
  useEffect(() => {
    if (!user || !user.schoolId) return;
    if (user.role !== "teacher" && user.role !== "parent") return;
    items.forEach((a) => { markAnnouncementRead(a.id, user.schoolId, user.id); });
  }, [items, user]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirmDel, setConfirmDel] = useState<Announcement | null>(null);

  // Admin read stats
  const [stats, setStats] = useState<Record<string, { read: number; total: number }>>({});
  const isAdminView = user?.role === "school_admin";
  const loadStats = useCallback(async () => {
    if (!isAdminView) return;
    try {
      const r = await adminApi.announcementReadStats();
      setStats(r.stats);
    } catch { /* silent */ }
  }, [isAdminView]);
  useEffect(() => { loadStats(); }, [loadStats, db.announcements.length]);

  const [detailsFor, setDetailsFor] = useState<Announcement | null>(null);

  const locked = !loading && user?.role !== "super_admin" && !hasFeature("announcements");


  const openNew = () => { setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (a: Announcement) => {
    setForm({
      id: a.id,
      title: a.title,
      content: a.content,
      audience: (a.audience as AudienceKind) ?? "Tous",
      targetClassId: a.targetClassId ?? null,
      pinned: !!a.pinned,
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Titre et message requis");
      return;
    }
    if (form.audience === "Classe" && !form.targetClassId) {
      toast.error("Sélectionnez une classe");
      return;
    }
    updateDB((d) => {
      if (form.id) {
        const idx = d.announcements.findIndex((x) => x.id === form.id);
        if (idx >= 0) {
          d.announcements[idx] = {
            ...d.announcements[idx],
            title: form.title.trim(),
            content: form.content.trim(),
            audience: form.audience,
            targetClassId: form.audience === "Classe" ? form.targetClassId : null,
            pinned: form.pinned,
          };
        }
      } else {
        d.announcements.unshift({
          id: crypto.randomUUID(),
          title: form.title.trim(),
          content: form.content.trim(),
          audience: form.audience,
          targetClassId: form.audience === "Classe" ? form.targetClassId : null,
          pinned: form.pinned,
          authorId: user?.id,
          createdAt: new Date().toISOString(),
        });
      }
    });
    toast.success(form.id ? "Annonce mise à jour" : "Annonce publiée");
    setDialogOpen(false);
  };

  const togglePin = (a: Announcement) => {
    updateDB((d) => {
      const idx = d.announcements.findIndex((x) => x.id === a.id);
      if (idx >= 0) d.announcements[idx] = { ...d.announcements[idx], pinned: !d.announcements[idx].pinned };
    });
    toast.success(a.pinned ? "Désépinglée" : "Épinglée en haut");
  };

  const remove = () => {
    if (!confirmDel) return;
    const id = confirmDel.id;
    updateDB((d) => { d.announcements = d.announcements.filter((a) => a.id !== id); });
    toast.success("Annonce supprimée");
    setConfirmDel(null);
  };

  const className = (id?: string | null) => db.classes.find((c) => c.id === id)?.name ?? "Classe";

  if (locked) {
    return (
      <AppLayout title="Annonces">
        <LockedFeatureOverlay
          requiredPlan={requiredPlanFor("announcements")}
          featureLabel="Les annonces"
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Annonces">
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {items.length === 0 ? "Aucune annonce" : `${items.length} annonce${items.length > 1 ? "s" : ""}`}
        </p>
        {isAdmin && (
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Nouvelle annonce
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <Megaphone className="h-10 w-10 opacity-40" />
            <p>Aucune annonce pour le moment</p>
            {isAdmin && (
              <Button variant="outline" onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" /> Publier la première annonce
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id} className={a.pinned ? "border-accent/60 bg-accent/5" : undefined}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.pinned && (
                        <Badge variant="outline" className="border-accent/50 text-accent">
                          <Pin className="mr-1 h-3 w-3" /> Épinglée
                        </Badge>
                      )}
                      <h3 className="text-base font-bold text-primary">{a.title}</h3>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {a.audience === "Classe" ? `Classe — ${className(a.targetClassId)}` : a.audience}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDateFr(a.createdAt)}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" onClick={() => togglePin(a)} title={a.pinned ? "Désépingler" : "Épingler"}>
                        {a.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)} title="Modifier">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDel(a)} title="Supprimer">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{a.content}</p>
                {isAdminView && (
                  <ReadIndicator
                    stats={stats[a.id]}
                    onOpen={() => setDetailsFor(a)}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Modifier l'annonce" : "Nouvelle annonce"}</DialogTitle>
            <DialogDescription>
              Publiez un message à toute l'école, aux parents, aux enseignants, ou à une classe spécifique.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Titre</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Réunion parents-professeurs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                rows={5}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Détails de l'annonce…"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Destinataires</Label>
                <Select
                  value={form.audience}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      audience: v as AudienceKind,
                      targetClassId: v === "Classe" ? f.targetClassId : null,
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tous">Tous</SelectItem>
                    <SelectItem value="Parents">Tous les parents</SelectItem>
                    <SelectItem value="Enseignants">Tous les enseignants</SelectItem>
                    <SelectItem value="Classe">Une classe spécifique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.audience === "Classe" && (
                <div className="space-y-1.5">
                  <Label>Classe</Label>
                  <Select
                    value={form.targetClassId ?? ""}
                    onValueChange={(v) => setForm((f) => ({ ...f, targetClassId: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                    <SelectContent>
                      {db.classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.pinned}
                onCheckedChange={(v) => setForm((f) => ({ ...f, pinned: v === true }))}
              />
              <span>Épingler en haut de la liste</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={save}>{form.id ? "Enregistrer" : "Publier"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer cette annonce ?</DialogTitle>
            <DialogDescription>
              "{confirmDel?.title}" sera supprimée définitivement.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDel(null)}>Annuler</Button>
            <Button variant="destructive" onClick={remove}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Read details modal */}
      <ReadDetailsDialog
        announcement={detailsFor}
        onClose={() => setDetailsFor(null)}
        onChanged={loadStats}
      />
    </AppLayout>
  );
}

function readColor(read: number, total: number): { text: string; bar: string; pct: number } {
  const pct = total > 0 ? Math.round((read / total) * 100) : 0;
  if (pct >= 75) return { text: "text-emerald-600", bar: "bg-emerald-500", pct };
  if (pct >= 40) return { text: "text-orange-500", bar: "bg-orange-500", pct };
  return { text: "text-red-600", bar: "bg-red-500", pct };
}

function ReadIndicator({ stats, onOpen }: { stats?: { read: number; total: number }; onOpen: () => void }) {
  const read = stats?.read ?? 0;
  const total = stats?.total ?? 0;
  const c = readColor(read, total);
  return (
    <div className="mt-4 rounded-md border bg-muted/30 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className={`font-medium ${c.text}`}>
            Lu par {read} / {total} {total > 0 && `(${c.pct}%)`}
          </span>
        </div>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onOpen}>
          Voir les détails
        </Button>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${c.bar} transition-all`} style={{ width: `${c.pct}%` }} />
      </div>
    </div>
  );
}

function roleLabel(role: string): string {
  if (role === "parent") return "Parent";
  if (role === "teacher") return "Enseignant";
  if (role === "school_admin") return "Admin";
  return role;
}

function ReadDetailsDialog({
  announcement, onClose, onChanged,
}: {
  announcement: Announcement | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<{
    readers: { id: string; full_name: string; role: string; email: string | null; phone: string | null; read_at: string }[];
    nonReaders: { id: string; full_name: string; role: string; email: string | null; phone: string | null }[];
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!announcement) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    adminApi.announcementReadDetails(announcement.id)
      .then((r) => { if (!cancelled) setData({ readers: r.readers, nonReaders: r.nonReaders, total: r.total }); })
      .catch((e) => toast.error(e?.message ?? "Erreur de chargement"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; onChanged(); };
  }, [announcement, onChanged]);

  const readCount = data?.readers.length ?? 0;
  const nonCount = data?.nonReaders.length ?? 0;

  return (
    <Dialog open={!!announcement} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">Détails de lecture</DialogTitle>
          <DialogDescription className="truncate">{announcement?.title}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : !data ? null : (
          <Tabs defaultValue="read" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="read">
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Ont lu ({readCount})
              </TabsTrigger>
              <TabsTrigger value="unread">
                <Clock className="mr-1.5 h-4 w-4" /> N'ont pas lu ({nonCount})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="read" className="max-h-[60vh] overflow-y-auto">
              {data.readers.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Personne n'a encore lu cette annonce.</p>
              ) : (
                <ul className="divide-y">
                  {data.readers.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.full_name || r.email || "—"}</p>
                        <p className="text-xs text-muted-foreground">{roleLabel(r.role)}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        lu le {new Date(r.read_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} à {new Date(r.read_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="unread" className="max-h-[60vh] overflow-y-auto">
              {data.nonReaders.length === 0 ? (
                <p className="py-8 text-center text-sm text-emerald-600">Tout le monde a lu cette annonce. 🎉</p>
              ) : (
                <ul className="divide-y">
                  {data.nonReaders.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.full_name || r.email || "—"}</p>
                        <p className="text-xs text-muted-foreground">{roleLabel(r.role)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-xs">
                        {r.phone && (
                          <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-muted">
                            <Phone className="h-3 w-3" /> {r.phone}
                          </a>
                        )}
                        {r.email && (
                          <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-muted">
                            <Mail className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

