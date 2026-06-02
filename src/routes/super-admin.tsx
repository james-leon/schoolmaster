import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { superAdminApi, type PlatformSchool, type PlatformKpis } from "@/lib/super-admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { CredentialsModal, type CredentialsInfo } from "@/components/CredentialsModal";
import {
  Building2, Users, TrendingUp, AlertOctagon, Plus, MoreVertical, Eye, Ban,
  Play, LogIn, Trash2, CalendarPlus, CreditCard, LogOut, AlertTriangle, Clock, History, RefreshCw, Rocket,
} from "lucide-react";
import { fcfa } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { PLAN_CONFIG, type PlanId } from "@/lib/plans";

export const Route = createFileRoute("/super-admin")({
  component: SuperAdminPage,
});

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter", pro: "Pro", "school+": "School+", free: "Gratuit", premium: "Premium", trial: "Essai",
};
const PLAN_OPTIONS = ["starter", "pro", "school+"];
const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  active:    { label: "Actif",     cls: "bg-success/15 text-success" },
  trial:     { label: "Essai",     cls: "bg-primary/15 text-primary" },
  suspended: { label: "Suspendu",  cls: "bg-muted text-muted-foreground" },
  expired:   { label: "Expiré",    cls: "bg-destructive/15 text-destructive" },
};
const PLAN_MRR: Record<string, number> = {
  starter: PLAN_CONFIG.starter.priceFcfa,
  pro: PLAN_CONFIG.pro.priceFcfa,
  "school+": PLAN_CONFIG["school+"].priceFcfa,
};

type SubFilter = "all" | "soon" | "expired" | "trial" | "active";

function SuperAdminPage() {
  const { originalUser, loading, logout, startImpersonating } = useAuth();
  const navigate = useNavigate();
  const [schools, setSchools] = useState<PlatformSchool[]>([]);
  const [kpis, setKpis] = useState<PlatformKpis | null>(null);
  const [busy, setBusy] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creds, setCreds] = useState<CredentialsInfo | null>(null);
  const [extendingSchoolId, setExtendingSchoolId] = useState<string | null>(null);
  const [newTrialDate, setNewTrialDate] = useState("");
  const [subSchool, setSubSchool] = useState<PlatformSchool | null>(null);
  const [renewSchool, setRenewSchool] = useState<PlatformSchool | null>(null);
  const [convertSchool, setConvertSchool] = useState<PlatformSchool | null>(null);
  const [historySchool, setHistorySchool] = useState<PlatformSchool | null>(null);
  const [subFilter, setSubFilter] = useState<SubFilter>("all");

  useEffect(() => {
    if (loading) return;
    if (!originalUser || originalUser.role !== "super_admin") {
      navigate({ to: "/login", replace: true });
    }
  }, [originalUser, loading, navigate]);

  const refresh = async () => {
    setBusy(true);
    try {
      const r = await superAdminApi.listSchools();
      setSchools(r.schools);
      setKpis(r.kpis);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (originalUser?.role === "super_admin") refresh();
  }, [originalUser?.role]);

  if (loading || !originalUser || originalUser.role !== "super_admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  const mrr = schools.reduce((sum, s) => {
    if (s.status !== "active") return sum;
    return sum + (PLAN_MRR[s.subscription_plan ?? ""] ?? 0);
  }, 0);

  const todayMs = Date.now();
  const daysLeft = (s: PlatformSchool): number | null => {
    const end = s.subscription_end ?? s.trial_ends_at;
    if (!end) return null;
    return Math.ceil((new Date(end).getTime() - todayMs) / 86400000);
  };
  const expiringSoon = schools.filter((s) => {
    const d = daysLeft(s); return d !== null && d >= 0 && d <= 7 && s.status !== "expired" && s.status !== "suspended";
  });
  const expired = schools.filter((s) => s.status === "expired");
  const trialing = schools.filter((s) => s.status === "trial");

  const filteredSchools = [...schools]
    .filter((s) => {
      if (subFilter === "all") return true;
      if (subFilter === "expired") return s.status === "expired";
      if (subFilter === "trial") return s.status === "trial";
      if (subFilter === "active") return s.status === "active";
      if (subFilter === "soon") {
        const d = daysLeft(s); return d !== null && d >= 0 && d <= 7 && s.status !== "expired" && s.status !== "suspended";
      }
      return true;
    })
    .sort((a, b) => {
      const da = daysLeft(a); const db = daysLeft(b);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });

  const handleSuspend = async (s: PlatformSchool) => {
    try { await superAdminApi.updateStatus(s.id, "suspended"); toast.success("École suspendue"); refresh(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const handleActivate = async (s: PlatformSchool) => {
    try { await superAdminApi.updateStatus(s.id, "active"); toast.success("École réactivée"); refresh(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const handleChangePlan = async (s: PlatformSchool, plan: string) => {
    try { await superAdminApi.updatePlan(s.id, plan); toast.success("Plan mis à jour"); refresh(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const handleExtendTrial = async () => {
    if (!extendingSchoolId || !newTrialDate) return;
    try {
      await superAdminApi.extendTrial(extendingSchoolId, newTrialDate);
      toast.success("Essai prolongé"); setExtendingSchoolId(null); setNewTrialDate(""); refresh();
    } catch (e) { toast.error((e as Error).message); }
  };
  const handleDelete = async (s: PlatformSchool) => {
    try { await superAdminApi.deleteSchool(s.id); toast.success("École supprimée"); refresh(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const handleImpersonate = async (s: PlatformSchool) => {
    try {
      await startImpersonating(s.id);
      toast.success(`Connecté en tant que ${s.name}`);
      navigate({ to: "/dashboard" });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Logo compact />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight md:text-xl">Wintek — Console Platforme</h1>
            <p className="text-xs text-muted-foreground">Gestion de toutes les écoles SchoolMaster</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary text-primary-foreground">Super Admin</Badge>
          <span className="hidden text-sm font-medium md:inline">{originalUser.name}</span>
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Déconnexion">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="px-4 py-6 md:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Écoles actives" value={String(kpis?.activeSchools ?? 0)} icon={Building2} tone="blue" />
          <KpiCard label="Total élèves" value={String(kpis?.totalStudents ?? 0)} icon={Users} tone="green" />
          <KpiCard label="MRR estimé" value={fcfa(mrr)} icon={TrendingUp} tone="orange" />
          <KpiCard
            label="Essai / Payantes"
            value={`${kpis?.trialSchools ?? 0} / ${kpis?.paidSchools ?? 0}`}
            icon={CreditCard} tone="purple"
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <AlertCard
            tone="orange" icon={Clock} label="Expirent bientôt"
            value={expiringSoon.length} hint="dans les 7 prochains jours"
            active={subFilter === "soon"}
            onClick={() => setSubFilter("soon")}
          />
          <AlertCard
            tone="red" icon={AlertOctagon} label="Abonnements expirés"
            value={expired.length} hint="action urgente requise"
            active={subFilter === "expired"}
            onClick={() => setSubFilter("expired")}
          />
          <AlertCard
            tone="blue" icon={Rocket} label="En période d'essai"
            value={trialing.length} hint="écoles en test"
            active={subFilter === "trial"}
            onClick={() => setSubFilter("trial")}
          />
        </div>

        <Card className="mt-6">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Suivi des abonnements</CardTitle>
              <div className="flex flex-wrap gap-2">
                {([
                  { id: "all", label: "Tous" },
                  { id: "soon", label: "Expirent bientôt" },
                  { id: "expired", label: "Expirés" },
                  { id: "trial", label: "En essai" },
                  { id: "active", label: "Actifs" },
                ] as { id: SubFilter; label: string }[]).map((f) => (
                  <Button
                    key={f.id}
                    size="sm"
                    variant={subFilter === f.id ? "default" : "outline"}
                    onClick={() => setSubFilter(f.id)}
                  >{f.label}</Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredSchools.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Aucune école pour ce filtre.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>École</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Début</TableHead>
                      <TableHead>Fin</TableHead>
                      <TableHead>Jours restants</TableHead>
                      <TableHead>Montant / mois</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSchools.map((s) => {
                      const st = STATUS_LABELS[s.status] ?? { label: s.status, cls: "" };
                      const end = s.subscription_end ?? s.trial_ends_at;
                      const d = daysLeft(s);
                      let daysCls = "text-muted-foreground";
                      let daysLabel = "—";
                      if (d !== null) {
                        if (d < 0) { daysCls = "text-destructive font-semibold"; daysLabel = `Expiré (${Math.abs(d)} j)`; }
                        else if (d < 7) { daysCls = "text-destructive font-semibold"; daysLabel = `${d} j`; }
                        else if (d <= 15) { daysCls = "text-warning font-semibold"; daysLabel = `${d} j`; }
                        else { daysCls = "text-success font-medium"; daysLabel = `${d} j`; }
                      }
                      return (
                        <TableRow key={s.id}>
                          <TableCell>
                            <div className="font-medium">{s.name}</div>
                            <div className="text-xs text-muted-foreground">{s.city ?? "—"}</div>
                          </TableCell>
                          <TableCell className="text-sm">{PLAN_LABELS[s.subscription_plan ?? "starter"] ?? s.subscription_plan}</TableCell>
                          <TableCell><Badge className={st.cls}>{st.label}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {s.subscription_start ? new Date(s.subscription_start).toLocaleDateString("fr-FR") : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {end ? new Date(end).toLocaleDateString("fr-FR") : "—"}
                          </TableCell>
                          <TableCell className={`text-xs ${daysCls}`}>{daysLabel}</TableCell>
                          <TableCell className="text-sm font-medium">{fcfa(PLAN_MRR[s.subscription_plan ?? ""] ?? 0)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {s.status === "trial" ? (
                                <Button size="sm" variant="default" onClick={() => setConvertSchool(s)}>
                                  <Rocket className="mr-1 h-3.5 w-3.5" /> Convertir
                                </Button>
                              ) : (
                                <Button size="sm" variant="default" onClick={() => setRenewSchool(s)}>
                                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Renouveler
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => setHistorySchool(s)}>
                                <History className="h-3.5 w-3.5" />
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

        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Écoles clientes</CardTitle>
            <Button onClick={() => setShowCreate(true)} size="sm">
              <Plus className="mr-1.5 h-4 w-4" /> Nouvelle école
            </Button>
          </CardHeader>
          <CardContent>
            {busy ? (
              <div className="flex justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
              </div>
            ) : schools.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aucune école pour le moment. Cliquez sur "Nouvelle école" pour en créer une.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>École</TableHead>
                      <TableHead>Ville</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Élèves</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Expire le</TableHead>
                      <TableHead>Créée</TableHead>
                      <TableHead className="w-12 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schools.map((s) => {
                      const st = STATUS_LABELS[s.status] ?? { label: s.status, cls: "" };
                      return (
                        <TableRow key={s.id}>
                          <TableCell>
                            <div className="font-medium">{s.name}</div>
                            <div className="text-xs text-muted-foreground">{s.director_name ?? "—"}</div>
                          </TableCell>
                          <TableCell className="text-sm">{s.city ?? "—"}</TableCell>
                          <TableCell>
                            <Select value={s.subscription_plan ?? "starter"} onValueChange={(v) => handleChangePlan(s, v)}>
                              <SelectTrigger className="h-8 w-[130px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PLAN_OPTIONS.map((p) => (
                                  <SelectItem key={p} value={p}>{PLAN_LABELS[p] ?? p}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{s.student_count}</TableCell>
                          <TableCell>
                            <Badge className={st.cls}>{st.label}</Badge>
                            {s.status === "trial" && s.trial_ends_at && (
                              <div className="mt-0.5 text-[10px] text-muted-foreground">jusqu'au {s.trial_ends_at}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {(() => {
                              const end = s.subscription_end ?? s.trial_ends_at;
                              if (!end) return <span className="text-muted-foreground">—</span>;
                              const days = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
                              const cls = days < 0 ? "text-destructive font-semibold" : days < 7 ? "text-accent font-semibold" : "text-muted-foreground";
                              return <span className={cls}>{new Date(end).toLocaleDateString("fr-FR")}</span>;
                            })()}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(s.created_at).toLocaleDateString("fr-FR")}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleImpersonate(s)}>
                                  <LogIn className="mr-2 h-4 w-4" /> Se connecter en tant que
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleImpersonate(s)}>
                                  <Eye className="mr-2 h-4 w-4" /> Voir
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSubSchool(s)}>
                                  <CreditCard className="mr-2 h-4 w-4" /> Gérer l'abonnement
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setExtendingSchoolId(s.id); setNewTrialDate(s.trial_ends_at ?? ""); }}>
                                  <CalendarPlus className="mr-2 h-4 w-4" /> Prolonger l'essai
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {s.status === "suspended" ? (
                                  <DropdownMenuItem onClick={() => handleActivate(s)}>
                                    <Play className="mr-2 h-4 w-4" /> Réactiver
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => handleSuspend(s)}>
                                    <Ban className="mr-2 h-4 w-4" /> Suspendre
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                      <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Supprimer l'école « {s.name} » ?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Cette action est irréversible. Toutes les données (élèves, classes,
                                        notes, paiements) seront définitivement effacées, et les comptes
                                        utilisateurs liés à cette école seront supprimés.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDelete(s)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Supprimer définitivement
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
      </main>

      {showCreate && (
        <CreateSchoolDialog
          onClose={() => setShowCreate(false)}
          onCreated={(info) => { setCreds(info); refresh(); }}
        />
      )}
      <CredentialsModal info={creds} onClose={() => setCreds(null)} />

      <Dialog open={!!extendingSchoolId} onOpenChange={(o) => !o && setExtendingSchoolId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Prolonger la période d'essai</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-trial-date">Nouvelle date de fin d'essai</Label>
            <Input id="new-trial-date" type="date" value={newTrialDate} onChange={(e) => setNewTrialDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendingSchoolId(null)}>Annuler</Button>
            <Button onClick={handleExtendTrial}>Prolonger</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {subSchool && (
        <ManageSubscriptionDialog
          school={subSchool}
          onClose={() => setSubSchool(null)}
          onSaved={() => { setSubSchool(null); refresh(); }}
        />
      )}

      {renewSchool && (
        <RenewSubscriptionDialog
          school={renewSchool}
          onClose={() => setRenewSchool(null)}
          onSaved={() => { setRenewSchool(null); refresh(); }}
        />
      )}
      {convertSchool && (
        <ConvertTrialDialog
          school={convertSchool}
          onClose={() => setConvertSchool(null)}
          onSaved={() => { setConvertSchool(null); refresh(); }}
        />
      )}
      {historySchool && (
        <SubscriptionHistoryDialog
          school={historySchool}
          onClose={() => setHistorySchool(null)}
        />
      )}
    </div>
  );
}

function AlertCard({
  tone, icon: Icon, label, value, hint, active, onClick,
}: {
  tone: "orange" | "red" | "blue"; icon: any; label: string; value: number;
  hint: string; active?: boolean; onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    orange: "border-warning/40 bg-warning/5 text-warning",
    red: "border-destructive/40 bg-destructive/5 text-destructive",
    blue: "border-primary/40 bg-primary/5 text-primary",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg border p-4 text-left transition hover:shadow-sm ${tones[tone]} ${active ? "ring-2 ring-offset-1 ring-current" : ""}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-background/60">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="text-xs font-medium">{label}</div>
        <div className="text-2xl font-bold leading-none mt-1 text-foreground">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
      </div>
    </button>
  );
}


function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: "blue" | "green" | "orange" | "purple" }) {
  const tones: Record<string, string> = {
    blue: "bg-primary/10 text-primary",
    green: "bg-success/10 text-success",
    orange: "bg-accent/10 text-accent",
    purple: "bg-secondary/10 text-secondary",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateSchoolDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (c: CredentialsInfo) => void }) {
  const [form, setForm] = useState({
    schoolName: "", city: "", country: "Cameroun", phone: "", schoolEmail: "",
    plan: "starter", status: "trial" as "trial" | "active", trialEndsAt: "",
    directorName: "", directorEmail: "",
  });
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.schoolName || !form.directorName || !form.directorEmail) {
      toast.error("Nom de l'école, nom et email du directeur sont requis");
      return;
    }
    setLoading(true);
    try {
      const r = await superAdminApi.createSchool({
        schoolName: form.schoolName,
        city: form.city || undefined,
        country: form.country || undefined,
        phone: form.phone || undefined,
        schoolEmail: form.schoolEmail || undefined,
        plan: form.plan,
        status: form.status,
        trialEndsAt: form.status === "trial" ? form.trialEndsAt || undefined : undefined,
        directorName: form.directorName,
        directorEmail: form.directorEmail,
      });
      onClose();
      onCreated({
        name: r.schoolName,
        email: r.directorEmail,
        tempPassword: r.tempPassword,
        role: "teacher",
        schoolName: r.schoolName,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle école</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">École</h4>
            <div className="space-y-1.5">
              <Label htmlFor="schoolName">Nom de l'école *</Label>
              <Input id="schoolName" value={form.schoolName} onChange={(e) => set("schoolName", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city">Ville</Label>
                <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="country">Pays</Label>
                <Input id="country" value={form.country} onChange={(e) => set("country", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="schoolEmail">Email de l'école</Label>
                <Input id="schoolEmail" type="email" value={form.schoolEmail} onChange={(e) => set("schoolEmail", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Plan d'abonnement</Label>
                <Select value={form.plan} onValueChange={(v) => set("plan", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLAN_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>{PLAN_LABELS[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v as "trial" | "active")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Essai gratuit</SelectItem>
                    <SelectItem value="active">Actif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.status === "trial" && (
              <div className="space-y-1.5">
                <Label htmlFor="trialEndsAt">Date de fin d'essai</Label>
                <Input id="trialEndsAt" type="date" value={form.trialEndsAt} onChange={(e) => set("trialEndsAt", e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compte directeur</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="directorName">Nom du directeur *</Label>
                <Input id="directorName" value={form.directorName} onChange={(e) => set("directorName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="directorEmail">Email du directeur *</Label>
                <Input id="directorEmail" type="email" value={form.directorEmail} onChange={(e) => set("directorEmail", e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Un mot de passe temporaire sera généré et affiché après la création.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading}>{loading ? "Création..." : "Créer l'école"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

void AlertOctagon;

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function ManageSubscriptionDialog({
  school, onClose, onSaved,
}: { school: PlatformSchool; onClose: () => void; onSaved: () => void }) {
  const today = toISODate(new Date());
  const [plan, setPlan] = useState<string>(school.subscription_plan ?? "starter");
  const [status, setStatus] = useState<"active" | "trial" | "suspended" | "expired">(
    (school.status as "active" | "trial" | "suspended" | "expired") ?? "active",
  );
  const [start, setStart] = useState<string>(school.subscription_start ?? today);
  const [end, setEnd] = useState<string>(
    school.subscription_end ?? toISODate(addMonths(new Date(school.subscription_start ?? today), 1)),
  );
  const [trialEnd, setTrialEnd] = useState<string>(school.trial_ends_at ?? "");
  const [saving, setSaving] = useState(false);

  // Auto-suggest end = start + 1 month when start changes
  const handleStartChange = (v: string) => {
    setStart(v);
    if (v) setEnd(toISODate(addMonths(new Date(v), 1)));
  };

  const submit = async () => {
    setSaving(true);
    try {
      await superAdminApi.updateSubscription({
        schoolId: school.id,
        plan,
        status,
        subscriptionStart: start || undefined,
        subscriptionEnd: end || undefined,
        trialEnd: status === "trial" ? (trialEnd || end || undefined) : undefined,
      });
      toast.success("Abonnement mis à jour");
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gérer l'abonnement — {school.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>{PLAN_LABELS[p] ?? p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="trial">Essai</SelectItem>
                  <SelectItem value="suspended">Suspendu</SelectItem>
                  <SelectItem value="expired">Expiré</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sub-start">Début</Label>
              <Input id="sub-start" type="date" value={start} onChange={(e) => handleStartChange(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-end">Fin</Label>
              <Input id="sub-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          {status === "trial" && (
            <div className="space-y-1.5">
              <Label htmlFor="sub-trial">Fin de l'essai (optionnel)</Label>
              <Input id="sub-trial" type="date" value={trialEnd} onChange={(e) => setTrialEnd(e.target.value)} />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            La date de fin est automatiquement suggérée à 1 mois après la date de début.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

