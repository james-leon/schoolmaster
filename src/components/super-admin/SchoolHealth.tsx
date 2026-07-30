import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Activity, AlertTriangle, HeartPulse, Eye, MessageSquarePlus, Users,
  CreditCard, ClipboardList, Mail,
} from "lucide-react";
import { toast } from "sonner";
import { superAdminApi, type PlatformSchool } from "@/lib/super-admin-api";

type Health = "active" | "watch" | "risk" | "inactive" | "unknown";

const HEALTH_META: Record<Health, { label: string; dot: string; cls: string; rank: number }> = {
  inactive: { label: "Inactive",      dot: "bg-destructive",                cls: "text-destructive",           rank: 0 },
  risk:     { label: "À risque",      dot: "bg-accent",                     cls: "text-accent",                rank: 1 },
  watch:    { label: "À surveiller",  dot: "bg-yellow-500",                 cls: "text-yellow-600 dark:text-yellow-400", rank: 2 },
  active:   { label: "Active",        dot: "bg-success",                    cls: "text-success",               rank: 3 },
  unknown:  { label: "Sans activité", dot: "bg-muted-foreground",           cls: "text-muted-foreground",      rank: -1 },
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function healthOf(s: PlatformSchool): Health {
  const d = daysSince(s.last_activity_at);
  if (d === null) return "unknown";
  if (d <= 7) return "active";
  if (d <= 14) return "watch";
  if (d <= 30) return "risk";
  return "inactive";
}

function daysToExpiry(s: PlatformSchool): number | null {
  const end = s.subscription_end ?? s.trial_ends_at;
  if (!end) return null;
  return Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
}

function isHighChurnRisk(s: PlatformSchool): boolean {
  if (s.status === "suspended") return false;
  const h = healthOf(s);
  const dx = daysToExpiry(s);
  const inactiveEnough = h === "risk" || h === "inactive" || h === "unknown";
  const closeToExpiry = dx !== null && dx <= 14;
  return inactiveEnough && closeToExpiry;
}

function timeAgoFr(iso: string | null): string {
  if (!iso) return "Jamais";
  const d = daysSince(iso) ?? 0;
  if (d <= 0) return "Aujourd'hui";
  if (d === 1) return "Hier";
  if (d < 30) return `Il y a ${d} jours`;
  const months = Math.floor(d / 30);
  if (months < 12) return `Il y a ${months} mois`;
  return `Il y a ${Math.floor(months / 12)} an${months >= 24 ? "s" : ""}`;
}

const PLAN_LABELS: Record<string, string> = {
  essentiel: "Essentiel", complet: "Complet",
  starter: "Essentiel", pro: "Complet", "school+": "Complet",
  free: "Gratuit", premium: "Premium", trial: "Essai",
};

export function SchoolHealth({
  schools, onChanged,
}: { schools: PlatformSchool[]; onChanged: () => void }) {
  const [notesSchool, setNotesSchool] = useState<PlatformSchool | null>(null);

  const summary = useMemo(() => {
    let active = 0, watch = 0, risk = 0, inactive = 0, unknown = 0, highRisk = 0;
    for (const s of schools) {
      const h = healthOf(s);
      if (h === "active") active++;
      else if (h === "watch") watch++;
      else if (h === "risk") risk++;
      else if (h === "inactive") inactive++;
      else unknown++;
      if (isHighChurnRisk(s)) highRisk++;
    }
    const total = schools.length;
    const engagement = total > 0 ? Math.round((active / total) * 100) : 0;
    return { active, watch, risk, inactive, unknown, highRisk, total, engagement };
  }, [schools]);

  const sorted = useMemo(() => {
    return [...schools].sort((a, b) => {
      const aHigh = isHighChurnRisk(a) ? 1 : 0;
      const bHigh = isHighChurnRisk(b) ? 1 : 0;
      if (aHigh !== bHigh) return bHigh - aHigh;
      const ra = HEALTH_META[healthOf(a)].rank;
      const rb = HEALTH_META[healthOf(b)].rank;
      return ra - rb; // lowest rank (worst) first
    });
  }, [schools]);

  return (
    <section className="mt-6 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HealthCard tone="green"  icon={HeartPulse}     label="Écoles actives"
          value={summary.active}  hint="Actives sur 7 derniers jours" />
        <HealthCard tone="yellow" icon={Activity}       label="À surveiller"
          value={summary.watch}   hint="7 à 14 jours sans activité" />
        <HealthCard tone="red"    icon={AlertTriangle}  label="À risque"
          value={summary.risk + summary.inactive}
          hint={`${summary.highRisk} risque(s) élevé(s) de départ`} />
        <HealthCard tone="blue"   icon={Users}          label="Taux d'engagement"
          value={`${summary.engagement}%`}
          hint="Écoles actives cette semaine" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Santé des écoles</CardTitle>
          <span className="text-xs text-muted-foreground">
            Triées par risque (plus à risque en premier)
          </span>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucune école.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>École</TableHead>
                    <TableHead>Santé</TableHead>
                    <TableHead>Dernière activité</TableHead>
                    <TableHead className="text-right">Élèves</TableHead>
                    <TableHead>Engagement 30j</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((s) => {
                    const h = healthOf(s);
                    const meta = HEALTH_META[h];
                    const dx = daysToExpiry(s);
                    const high = isHighChurnRisk(s);
                    const end = s.subscription_end ?? s.trial_ends_at;
                    return (
                      <TableRow key={s.id} className={high ? "bg-destructive/5" : undefined}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="font-medium">{s.name}</div>
                            <div className="text-xs text-muted-foreground">{s.city ?? "—"}</div>
                            {high && (
                              <Badge variant="destructive" className="mt-1 w-fit gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Risque élevé de départ
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`inline-block h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                            <span className={`text-sm font-medium ${meta.cls}`}>{meta.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {timeAgoFr(s.last_activity_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={s.student_count === 0 ? "text-destructive font-semibold" : ""}>
                            {s.student_count}
                          </span>
                          {s.student_count === 0 && (
                            <div className="text-[10px] text-destructive">Onboarding</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <EngagementSignals s={s} />
                        </TableCell>
                        <TableCell className="text-sm">
                          {PLAN_LABELS[s.subscription_plan ?? ""] ?? s.subscription_plan ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {end ? (
                            <span className={dx !== null && dx < 7 ? "text-destructive font-medium" : ""}>
                              {new Date(end).toLocaleDateString("fr-FR")}
                              {dx !== null && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({dx < 0 ? `expiré` : `${dx} j`})
                                </span>
                              )}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {s.email && (
                              <Button asChild variant="outline" size="sm">
                                <a href={`mailto:${s.email}`}>
                                  <Mail className="mr-1 h-3.5 w-3.5" /> Contacter
                                </a>
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setNotesSchool(s)}>
                              <MessageSquarePlus className="mr-1 h-3.5 w-3.5" />
                              Notes
                              {s.internal_notes && (
                                <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <NotesDialog
        school={notesSchool}
        onClose={() => setNotesSchool(null)}
        onSaved={() => { setNotesSchool(null); onChanged(); }}
      />
    </section>
  );
}

function EngagementSignals({ s }: { s: PlatformSchool }) {
  const items = [
    { ok: s.student_count > 0,      icon: Users,         label: "Élèves",    n: s.student_count },
    { ok: s.recent_payments > 0,    icon: CreditCard,    label: "Paiements", n: s.recent_payments },
    { ok: (s.recent_grades + s.recent_attendance) > 0,
                                    icon: ClipboardList, label: "Saisies",   n: s.recent_grades + s.recent_attendance },
  ];
  return (
    <div className="flex items-center gap-3 text-xs">
      {items.map(({ ok, icon: Icon, label, n }) => (
        <div key={label}
          className={`flex items-center gap-1 ${ok ? "text-success" : "text-muted-foreground/60"}`}
          title={`${label} : ${n}`}>
          <Icon className="h-3.5 w-3.5" />
          <span>{n}</span>
        </div>
      ))}
    </div>
  );
}

function HealthCard({
  tone, icon: Icon, label, value, hint,
}: {
  tone: "green" | "yellow" | "red" | "blue";
  icon: any; label: string; value: string | number; hint: string;
}) {
  const cls: Record<string, string> = {
    green:  "bg-success/10 text-success",
    yellow: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    red:    "bg-destructive/10 text-destructive",
    blue:   "bg-primary/10 text-primary",
  };
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${cls[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function NotesDialog({
  school, onClose, onSaved,
}: { school: PlatformSchool | null; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync when opened
  useMemo(() => { if (school) setValue(school.internal_notes ?? ""); }, [school?.id]);

  const save = async () => {
    if (!school) return;
    setSaving(true);
    try {
      await superAdminApi.updateNotes(school.id, value.trim() ? value : null);
      toast.success("Notes enregistrées");
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={!!school} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Notes internes — {school?.name}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Notes privées Wintek (jamais visibles par l'école). Ex : « Directeur hésite à renouveler »,
          « A demandé une formation »...
        </p>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={6}
          placeholder="Écrire une note interne…"
          maxLength={4000}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
