import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { fcfa } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, AlertTriangle, PiggyBank, Download, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { csvRow } from "@/lib/csv";
import { usePlan } from "@/lib/usePlan";
import { LockedFeatureOverlay } from "@/components/UpgradePrompt";
import { requiredPlanFor } from "@/lib/plans";

export const Route = createFileRoute("/budget")({ component: BudgetPage });

type BStatus = "brouillon" | "actif" | "cloture";
interface Budget {
  id: string; school_id: string; name: string;
  period_start: string; period_end: string;
  status: BStatus; notes: string | null;
}
interface BudgetLine {
  id: string; school_id: string; budget_id: string;
  category_id: string; type: "recette" | "depense";
  planned_amount: number; notes: string | null;
}
interface Category { id: string; school_id: string; name: string; type: "recette" | "depense"; }
interface Tx { id: string; school_id: string; type: "recette" | "depense"; category: string; amount: number; date: string; }

const STATUS_LABEL: Record<BStatus, string> = { brouillon: "Brouillon", actif: "Actif", cloture: "Clôturé" };
const STATUS_BADGE: Record<BStatus, string> = {
  brouillon: "bg-muted text-muted-foreground",
  actif: "bg-success/15 text-success",
  cloture: "bg-secondary/15 text-secondary",
};

const todayISO = () => new Date().toISOString().slice(0, 10);

function BudgetPage() {
  const { user } = useAuth();
  const schoolId = user?.schoolId;
  const isAdmin = user?.role === "school_admin" || user?.role === "super_admin";
  const { hasFeature, loading: planLoading } = usePlan();

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const [b, l, c, t] = await Promise.all([
      supabase.from("budgets").select("*").eq("school_id", schoolId).order("period_start", { ascending: false }),
      supabase.from("budget_lines").select("*").eq("school_id", schoolId),
      supabase.from("transaction_categories").select("id,school_id,name,type").eq("school_id", schoolId).order("name"),
      supabase.from("transactions").select("id,school_id,type,category,amount,date").eq("school_id", schoolId),
    ]);
    if (b.error || l.error || c.error || t.error) toast.error("Erreur de chargement Budget");
    setBudgets(((b.data ?? []) as unknown) as Budget[]);
    setLines(((l.data ?? []) as unknown) as BudgetLine[]);
    setCategories(((c.data ?? []) as unknown) as Category[]);
    setTxs(((t.data ?? []) as unknown) as Tx[]);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const active = useMemo(() => budgets.find((b) => b.status === "actif") || null, [budgets]);
  const selected = useMemo(
    () => budgets.find((b) => b.id === selectedId) || active || budgets[0] || null,
    [budgets, selectedId, active],
  );

  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/dashboard" />;

  return (
    <AppLayout title="Budget">
      <div className="space-y-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="budgets">Budgets</TabsTrigger>
            <TabsTrigger value="comparison">Prévu vs Réel</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab loading={loading} active={active} lines={lines} categories={categories} txs={txs} />
          </TabsContent>

          <TabsContent value="budgets" className="mt-6">
            <BudgetsTab
              schoolId={schoolId!} budgets={budgets} lines={lines} categories={categories}
              onChange={fetchAll} selectedId={selected?.id ?? null} onSelect={setSelectedId}
            />
          </TabsContent>

          <TabsContent value="comparison" className="mt-6">
            <ComparisonTab budget={selected} lines={lines} categories={categories} txs={txs} budgets={budgets} onSelect={setSelectedId} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

/* ------------------ helpers ------------------ */
function inPeriod(date: string, start: string, end: string) { return date >= start && date <= end; }
function actualByCategory(txs: Tx[], catName: string, type: "recette" | "depense", start: string, end: string) {
  return txs
    .filter((t) => t.type === type && t.category === catName && inPeriod(t.date, start, end))
    .reduce((s, t) => s + Number(t.amount || 0), 0);
}

interface Row { lineId: string; categoryId: string; categoryName: string; type: "recette" | "depense"; planned: number; actual: number; }
function buildRows(budget: Budget | null, lines: BudgetLine[], cats: Category[], txs: Tx[]): Row[] {
  if (!budget) return [];
  const byId = new Map(cats.map((c) => [c.id, c]));
  return lines.filter((l) => l.budget_id === budget.id).map((l) => {
    const cat = byId.get(l.category_id);
    const name = cat?.name ?? "—";
    return {
      lineId: l.id, categoryId: l.category_id, categoryName: name, type: l.type,
      planned: Number(l.planned_amount || 0),
      actual: cat ? actualByCategory(txs, name, l.type, budget.period_start, budget.period_end) : 0,
    };
  });
}

/* ------------------ Overview ------------------ */
function OverviewTab({ loading, active, lines, categories, txs }: {
  loading: boolean; active: Budget | null; lines: BudgetLine[]; categories: Category[]; txs: Tx[];
}) {
  const rows = useMemo(() => buildRows(active, lines, categories, txs), [active, lines, categories, txs]);
  const plannedRec = rows.filter((r) => r.type === "recette").reduce((s, r) => s + r.planned, 0);
  const plannedDep = rows.filter((r) => r.type === "depense").reduce((s, r) => s + r.planned, 0);
  const actualRec = rows.filter((r) => r.type === "recette").reduce((s, r) => s + r.actual, 0);
  const actualDep = rows.filter((r) => r.type === "depense").reduce((s, r) => s + r.actual, 0);
  const overruns = rows.filter((r) => r.type === "depense" && r.planned > 0 && r.actual > r.planned);

  if (loading) return <Card><CardContent className="py-12 text-center text-muted-foreground">Chargement…</CardContent></Card>;

  if (!active) {
    return (
      <Card><CardContent className="py-12 text-center space-y-2">
        <PiggyBank className="mx-auto h-10 w-10 text-muted-foreground" />
        <div className="text-muted-foreground">Aucun budget actif. Créez un budget et marquez-le comme actif.</div>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Recettes prévues" value={fcfa(plannedRec)} />
        <StatCard label="Recettes réelles" value={fcfa(actualRec)} sub={`${pct(actualRec, plannedRec)}% réalisé`} />
        <StatCard label="Dépenses prévues" value={fcfa(plannedDep)} />
        <StatCard label="Dépenses réelles" value={fcfa(actualDep)} sub={`${pct(actualDep, plannedDep)}% réalisé`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardContent className="p-5">
          <div className="text-sm text-muted-foreground">Résultat prévisionnel</div>
          <div className={`text-2xl font-bold ${plannedRec - plannedDep >= 0 ? "text-success" : "text-destructive"}`}>
            {fcfa(plannedRec - plannedDep)}
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-sm text-muted-foreground">Résultat réel (à ce jour)</div>
          <div className={`text-2xl font-bold ${actualRec - actualDep >= 0 ? "text-success" : "text-destructive"}`}>
            {fcfa(actualRec - actualDep)}
          </div>
        </CardContent></Card>
      </div>

      {overruns.length > 0 && (
        <Card className="border-destructive/40">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Dépassements budgétaires
            </div>
            <div className="space-y-2">
              {overruns.map((r) => {
                const over = r.actual - r.planned;
                const overPct = Math.round((over / r.planned) * 100);
                return (
                  <div key={r.lineId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{r.categoryName}</span>
                    <Badge variant="destructive">+{overPct}% ({fcfa(over)})</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-5 space-y-3">
        <div className="font-semibold">Aperçu par catégorie — {active.name}</div>
        <div className="space-y-3">
          {rows.length === 0 && <div className="text-sm text-muted-foreground">Aucune ligne dans ce budget.</div>}
          {rows.map((r) => (
            <div key={r.lineId} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span><Badge variant="outline" className="mr-2">{r.type === "recette" ? "Recette" : "Dépense"}</Badge>{r.categoryName}</span>
                <span className="text-muted-foreground">{fcfa(r.actual)} / {fcfa(r.planned)}</span>
              </div>
              <Progress value={Math.min(100, pct(r.actual, r.planned))} className={r.type === "depense" && r.actual > r.planned ? "[&>div]:bg-destructive" : ""} />
            </div>
          ))}
        </div>
      </CardContent></Card>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <Card><CardContent className="p-5">
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className="text-2xl font-bold">{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
  </CardContent></Card>;
}

function pct(actual: number, planned: number): number {
  if (!planned) return 0;
  return Math.round((actual / planned) * 100);
}

/* ------------------ Budgets management ------------------ */
function BudgetsTab({ schoolId, budgets, lines, categories, onChange, selectedId, onSelect }: {
  schoolId: string; budgets: Budget[]; lines: BudgetLine[]; categories: Category[];
  onChange: () => void; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const [openBudget, setOpenBudget] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [confirmDel, setConfirmDel] = useState<Budget | null>(null);

  const linesByBudget = useMemo(() => {
    const m = new Map<string, BudgetLine[]>();
    lines.forEach((l) => { const a = m.get(l.budget_id) || []; a.push(l); m.set(l.budget_id, a); });
    return m;
  }, [lines]);

  async function setActive(b: Budget) {
    // mark others inactive in this school
    const others = budgets.filter((x) => x.status === "actif" && x.id !== b.id);
    for (const o of others) {
      await supabase.from("budgets").update({ status: "brouillon" }).eq("id", o.id);
    }
    const { error } = await supabase.from("budgets").update({ status: "actif" }).eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success("Budget actif");
    onChange();
  }
  async function close(b: Budget) {
    const { error } = await supabase.from("budgets").update({ status: "cloture" }).eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success("Budget clôturé");
    onChange();
  }
  async function remove(b: Budget) {
    const { error } = await supabase.from("budgets").delete().eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success("Budget supprimé");
    setConfirmDel(null);
    onChange();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">Plans financiers par période</div>
        <Button onClick={() => { setEditing(null); setOpenBudget(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nouveau budget
        </Button>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Période</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Lignes</TableHead>
            <TableHead className="text-right">Prévu Recettes</TableHead>
            <TableHead className="text-right">Prévu Dépenses</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {budgets.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun budget</TableCell></TableRow>
            )}
            {budgets.map((b) => {
              const ls = linesByBudget.get(b.id) || [];
              const rec = ls.filter((l) => l.type === "recette").reduce((s, l) => s + Number(l.planned_amount || 0), 0);
              const dep = ls.filter((l) => l.type === "depense").reduce((s, l) => s + Number(l.planned_amount || 0), 0);
              return (
                <TableRow key={b.id} className={selectedId === b.id ? "bg-muted/30" : ""}>
                  <TableCell className="font-medium">
                    <button onClick={() => onSelect(b.id)} className="hover:underline text-left">{b.name}</button>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.period_start} → {b.period_end}</TableCell>
                  <TableCell><Badge className={STATUS_BADGE[b.status]}>{STATUS_LABEL[b.status]}</Badge></TableCell>
                  <TableCell className="text-right">{ls.length}</TableCell>
                  <TableCell className="text-right">{fcfa(rec)}</TableCell>
                  <TableCell className="text-right">{fcfa(dep)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {b.status !== "actif" && b.status !== "cloture" && (
                      <Button size="sm" variant="ghost" onClick={() => setActive(b)} title="Marquer actif">
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                    {b.status === "actif" && (
                      <Button size="sm" variant="ghost" onClick={() => close(b)} title="Clôturer">Clôturer</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(b); setOpenBudget(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDel(b)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>

      {selectedId && (
        <LinesEditor
          schoolId={schoolId}
          budget={budgets.find((b) => b.id === selectedId) || null}
          lines={lines.filter((l) => l.budget_id === selectedId)}
          categories={categories}
          onChange={onChange}
        />
      )}

      <BudgetDialog open={openBudget} onOpenChange={setOpenBudget} schoolId={schoolId} editing={editing} onSaved={onChange} />

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le budget ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera également toutes les lignes prévisionnelles. Les transactions réelles ne sont pas affectées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && remove(confirmDel)}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BudgetDialog({ open, onOpenChange, schoolId, editing, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; schoolId: string; editing: Budget | null; onSaved: () => void;
}) {
  const [form, setForm] = useState({ name: "", period_start: todayISO(), period_end: todayISO(), status: "brouillon" as BStatus, notes: "" });

  useEffect(() => {
    if (open) {
      if (editing) setForm({ name: editing.name, period_start: editing.period_start, period_end: editing.period_end, status: editing.status, notes: editing.notes || "" });
      else {
        const y = new Date().getFullYear();
        setForm({ name: `Budget ${y}-${y + 1}`, period_start: `${y}-09-01`, period_end: `${y + 1}-08-31`, status: "brouillon", notes: "" });
      }
    }
  }, [open, editing]);

  async function save() {
    if (!form.name.trim()) return toast.error("Nom requis");
    if (form.period_end < form.period_start) return toast.error("Période invalide");
    const payload = {
      school_id: schoolId, name: form.name.trim(),
      period_start: form.period_start, period_end: form.period_end,
      status: form.status, notes: form.notes || null,
    };
    if (editing) {
      const { error } = await supabase.from("budgets").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("budgets").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success(editing ? "Budget modifié" : "Budget créé");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Modifier le budget" : "Nouveau budget"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nom</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Début</Label><Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></div>
            <div><Label>Fin</Label><Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></div>
          </div>
          <div><Label>Statut</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as BStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="brouillon">Brouillon</SelectItem>
                <SelectItem value="actif">Actif</SelectItem>
                <SelectItem value="cloture">Clôturé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={save}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------ Lines editor ------------------ */
function LinesEditor({ schoolId, budget, lines, categories, onChange }: {
  schoolId: string; budget: Budget | null; lines: BudgetLine[]; categories: Category[]; onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetLine | null>(null);
  const [form, setForm] = useState<{ category_id: string; type: "recette" | "depense"; planned_amount: string; notes: string }>({
    category_id: "", type: "depense", planned_amount: "0", notes: "",
  });

  if (!budget) return null;
  const usedCatIds = new Set(lines.map((l) => l.category_id));

  function openNew() {
    setEditing(null);
    setForm({ category_id: "", type: "depense", planned_amount: "0", notes: "" });
    setOpen(true);
  }
  function openEdit(l: BudgetLine) {
    setEditing(l);
    setForm({ category_id: l.category_id, type: l.type, planned_amount: String(l.planned_amount), notes: l.notes || "" });
    setOpen(true);
  }

  async function save() {
    if (!form.category_id) return toast.error("Catégorie requise");
    const amt = Number(form.planned_amount);
    if (!isFinite(amt) || amt < 0) return toast.error("Montant invalide");
    const cat = categories.find((c) => c.id === form.category_id);
    if (!cat) return toast.error("Catégorie introuvable");
    const payload = {
      school_id: schoolId, budget_id: budget!.id,
      category_id: form.category_id, type: cat.type,
      planned_amount: amt, notes: form.notes || null,
    };
    if (editing) {
      const { error } = await supabase.from("budget_lines").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("budget_lines").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success(editing ? "Ligne modifiée" : "Ligne ajoutée");
    setOpen(false);
    onChange();
  }
  async function remove(l: BudgetLine) {
    const { error } = await supabase.from("budget_lines").delete().eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success("Ligne supprimée");
    onChange();
  }

  const catById = new Map(categories.map((c) => [c.id, c]));
  const availableCats = categories.filter((c) => !usedCatIds.has(c.id) || (editing && editing.category_id === c.id));

  return (
    <Card><CardContent className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">Lignes de {budget.name}</div>
          <div className="text-xs text-muted-foreground">{budget.period_start} → {budget.period_end}</div>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Catégorie</TableHead><TableHead>Type</TableHead>
          <TableHead className="text-right">Prévu</TableHead><TableHead>Notes</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {lines.length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Aucune ligne</TableCell></TableRow>
          )}
          {lines.map((l) => {
            const c = catById.get(l.category_id);
            return (
              <TableRow key={l.id}>
                <TableCell>{c?.name ?? "—"}</TableCell>
                <TableCell><Badge variant="outline">{l.type === "recette" ? "Recette" : "Dépense"}</Badge></TableCell>
                <TableCell className="text-right">{fcfa(Number(l.planned_amount))}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.notes}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(l)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(l)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Modifier la ligne" : "Nouvelle ligne"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Catégorie</Label>
              <Select value={form.category_id} onValueChange={(v) => {
                const c = categories.find((x) => x.id === v);
                setForm({ ...form, category_id: v, type: c?.type ?? form.type });
              }}>
                <SelectTrigger><SelectValue placeholder="Choisir une catégorie" /></SelectTrigger>
                <SelectContent>
                  {availableCats.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">Aucune catégorie disponible</div>}
                  {availableCats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.type === "recette" ? "Recette" : "Dépense"})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Montant prévu (FCFA)</Label>
              <Input type="number" min={0} value={form.planned_amount} onChange={(e) => setForm({ ...form, planned_amount: e.target.value })} />
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CardContent></Card>
  );
}

/* ------------------ Comparison ------------------ */
function ComparisonTab({ budget, lines, categories, txs, budgets, onSelect }: {
  budget: Budget | null; lines: BudgetLine[]; categories: Category[]; txs: Tx[];
  budgets: Budget[]; onSelect: (id: string) => void;
}) {
  const rows = useMemo(() => buildRows(budget, lines, categories, txs), [budget, lines, categories, txs]);
  const rec = rows.filter((r) => r.type === "recette");
  const dep = rows.filter((r) => r.type === "depense");
  const plannedRec = rec.reduce((s, r) => s + r.planned, 0);
  const actualRec = rec.reduce((s, r) => s + r.actual, 0);
  const plannedDep = dep.reduce((s, r) => s + r.planned, 0);
  const actualDep = dep.reduce((s, r) => s + r.actual, 0);

  function exportCSV() {
    if (!budget) return;
    const header = ["Catégorie", "Type", "Prévu", "Réel", "Écart", "% réalisé"];
    const lines = rows.map((r) => [
      r.categoryName, r.type, r.planned, r.actual, r.actual - r.planned, pct(r.actual, r.planned),
    ]);
    const totals = [
      ["TOTAL RECETTES", "recette", plannedRec, actualRec, actualRec - plannedRec, pct(actualRec, plannedRec)],
      ["TOTAL DÉPENSES", "depense", plannedDep, actualDep, actualDep - plannedDep, pct(actualDep, plannedDep)],
      ["RÉSULTAT", "", plannedRec - plannedDep, actualRec - actualDep, (actualRec - actualDep) - (plannedRec - plannedDep), ""],
    ];
    const csv = [header, ...lines, ...totals].map(csvRow).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${budget.name.replace(/\s+/g, "_")}_comparison.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label>Budget</Label>
          <Select value={budget?.id ?? ""} onValueChange={onSelect}>
            <SelectTrigger className="w-[280px]"><SelectValue placeholder="Choisir un budget" /></SelectTrigger>
            <SelectContent>
              {budgets.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} ({STATUS_LABEL[b.status]})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {budget && <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> Exporter CSV</Button>}
      </div>

      {!budget ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Sélectionnez un budget</CardContent></Card>
      ) : (
        <>
          <ComparisonSection title="Recettes" rows={rec} planned={plannedRec} actual={actualRec} />
          <ComparisonSection title="Dépenses" rows={dep} planned={plannedDep} actual={actualDep} expense />
          <Card><CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryStat label="Résultat prévisionnel" value={plannedRec - plannedDep} />
            <SummaryStat label="Résultat réel" value={actualRec - actualDep} />
            <SummaryStat label="Écart résultat" value={(actualRec - actualDep) - (plannedRec - plannedDep)} />
          </CardContent></Card>
        </>
      )}
    </div>
  );
}

function ComparisonSection({ title, rows, planned, actual, expense }: { title: string; rows: Row[]; planned: number; actual: number; expense?: boolean }) {
  return (
    <Card><CardContent className="p-0">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">Prévu {fcfa(planned)} · Réel {fcfa(actual)}</div>
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Catégorie</TableHead>
          <TableHead className="text-right">Prévu</TableHead>
          <TableHead className="text-right">Réel</TableHead>
          <TableHead className="text-right">Écart</TableHead>
          <TableHead className="text-right">% réalisé</TableHead>
          <TableHead className="w-[200px]">Progression</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Aucune ligne</TableCell></TableRow>
          )}
          {rows.map((r) => {
            const ecart = r.actual - r.planned;
            const over = expense ? r.actual > r.planned : r.actual < r.planned;
            return (
              <TableRow key={r.lineId}>
                <TableCell className="font-medium">{r.categoryName}</TableCell>
                <TableCell className="text-right">{fcfa(r.planned)}</TableCell>
                <TableCell className="text-right">{fcfa(r.actual)}</TableCell>
                <TableCell className={`text-right font-medium ${over ? "text-destructive" : "text-success"}`}>
                  {ecart >= 0 ? "+" : ""}{fcfa(ecart)}
                </TableCell>
                <TableCell className="text-right">{pct(r.actual, r.planned)}%</TableCell>
                <TableCell>
                  <Progress value={Math.min(100, pct(r.actual, r.planned))} className={over && expense ? "[&>div]:bg-destructive" : ""} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${value >= 0 ? "text-success" : "text-destructive"}`}>{fcfa(value)}</div>
    </div>
  );
}
