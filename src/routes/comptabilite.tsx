import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { usePlan } from "@/lib/usePlan";
import { LockedFeatureOverlay } from "@/components/UpgradePrompt";
import { requiredPlanFor } from "@/lib/plans";
import { supabase } from "@/integrations/supabase/client";
import { fcfa } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet, Scale, Download } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip as RTooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/comptabilite")({ component: ComptabilitePage });

type TxType = "recette" | "depense";
const PAYMENT_METHODS = ["Espèces", "MTN Mobile Money", "Orange Money", "Virement bancaire", "Chèque"] as const;
const FALLBACK_RECETTE = "Autres recettes";
const FALLBACK_DEPENSE = "Divers";

interface CategoryRow {
  id: string;
  school_id: string;
  name: string;
  type: TxType;
  color: string | null;
}

interface SupplierRow {
  id: string;
  school_id: string;
  name: string;
  type: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

interface TxRow {
  id: string;
  school_id: string;
  type: TxType;
  category: string;
  amount: number;
  description: string | null;
  date: string;
  payment_method: string | null;
  reference: string | null;
  recorded_by: string | null;
  supplier_id: string | null;
  created_at: string;
  _auto?: boolean;
}

const SUPPLIER_TYPES = ["Fournisseur", "Partenaire", "Prestataire"] as const;

const MONTHS_FR = ["Janv","Févr","Mars","Avr","Mai","Juin","Juil","Août","Sept","Oct","Nov","Déc"];

function firstOfMonthISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
}
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

const COLORS = ["#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316","#6366f1","#84cc16"];

function ComptabilitePage() {
  const { user } = useAuth();
  const { hasFeature, loading: planLoading } = usePlan();
  const schoolId = user?.schoolId;
  const isAdmin = user?.role === "school_admin" || user?.role === "super_admin";

  const [txs, setTxs] = useState<TxRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [supplierManagerOpen, setSupplierManagerOpen] = useState(false);
  const [supplierDetail, setSupplierDetail] = useState<SupplierRow | null>(null);
  const [feeIncome, setFeeIncome] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth()-2); return firstOfMonthISO(d); });
  const [to, setTo] = useState(todayISO());
  const [filterType, setFilterType] = useState<"all"|TxType>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TxRow | null>(null);
  const [form, setForm] = useState<{ type: TxType; category: string; amount: string; date: string; payment_method: string; description: string; reference: string; supplier_id: string }>({
    type: "depense", category: "", amount: "", date: todayISO(), payment_method: "Espèces", description: "", reference: "", supplier_id: "",
  });
  const [deleting, setDeleting] = useState<TxRow | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const [{ data: tdata, error: terr }, { data: pdata, error: perr }, { data: cdata, error: cerr }, { data: sdata, error: serr }] = await Promise.all([
      supabase.from("transactions").select("*").eq("school_id", schoolId).order("date", { ascending: false }),
      supabase.from("payment_records").select("id,school_id,amount,date,mode,reference,receipt_number,notes").eq("school_id", schoolId),
      supabase.from("transaction_categories").select("*").eq("school_id", schoolId).order("name"),
      supabase.from("suppliers").select("*").eq("school_id", schoolId).order("name"),
    ]);
    if (cerr) toast.error("Impossible de charger les catégories");
    if (serr) toast.error("Impossible de charger les fournisseurs");
    setCategories(((cdata ?? []) as unknown) as CategoryRow[]);
    setSuppliers(((sdata ?? []) as unknown) as SupplierRow[]);
    if (terr) toast.error("Impossible de charger les transactions");
    if (perr) toast.error("Impossible de charger les paiements");
    setTxs(((tdata ?? []) as unknown) as TxRow[]);
    const auto: TxRow[] = (pdata ?? []).map((p: any) => ({
      id: `auto-${p.id}`,
      school_id: p.school_id,
      type: "recette" as TxType,
      category: "Scolarité",
      amount: Number(p.amount),
      description: `Reçu n°${p.receipt_number}${p.notes ? " — " + p.notes : ""}`,
      date: p.date,
      payment_method: p.mode,
      reference: p.reference,
      recorded_by: null,
      created_at: p.date,
      supplier_id: null,
      _auto: true,
    }));
    setFeeIncome(auto);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const allItems = useMemo<TxRow[]>(() => [...txs, ...feeIncome], [txs, feeIncome]);

  const inPeriod = useCallback((iso: string) => iso >= from && iso <= to, [from, to]);

  const periodItems = useMemo(() => allItems.filter(t => inPeriod(t.date)), [allItems, inPeriod]);

  const totals = useMemo(() => {
    let rec = 0, dep = 0;
    periodItems.forEach(t => { if (t.type === "recette") rec += Number(t.amount); else dep += Number(t.amount); });
    return { recettes: rec, depenses: dep, solde: rec - dep };
  }, [periodItems]);

  const cashBalance = useMemo(() => {
    let rec = 0, dep = 0;
    allItems.forEach(t => { if (t.type === "recette") rec += Number(t.amount); else dep += Number(t.amount); });
    return rec - dep;
  }, [allItems]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; recettes: number; depenses: number }>();
    const start = new Date(from), end = new Date(to);
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}`;
      map.set(key, { month: `${MONTHS_FR[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`, recettes: 0, depenses: 0 });
      cur.setMonth(cur.getMonth()+1);
    }
    periodItems.forEach(t => {
      const key = t.date.slice(0,7);
      const row = map.get(key);
      if (row) {
        if (t.type === "recette") row.recettes += Number(t.amount);
        else row.depenses += Number(t.amount);
      }
    });
    return Array.from(map.values());
  }, [periodItems, from, to]);

  const byCategory = useCallback((type: TxType) => {
    const map = new Map<string, number>();
    periodItems.filter(t => t.type === type).forEach(t => {
      map.set(t.category, (map.get(t.category) ?? 0) + Number(t.amount));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [periodItems]);

  const depCats = useMemo(() => byCategory("depense"), [byCategory]);
  const recCats = useMemo(() => byCategory("recette"), [byCategory]);

  const filteredList = useMemo(() => {
    return periodItems.filter(t => {
      if (filterType !== "all" && t.type !== filterType) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      return true;
    }).sort((a,b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  }, [periodItems, filterType, filterCategory]);

  const recetteCats = useMemo(() => categories.filter(c => c.type === "recette").map(c => c.name), [categories]);
  const depenseCats = useMemo(() => categories.filter(c => c.type === "depense").map(c => c.name), [categories]);
  const allCategories = useMemo(() => Array.from(new Set([...recetteCats, ...depenseCats, ...allItems.map(t => t.category)])).sort(), [recetteCats, depenseCats, allItems]);

  function openCreate() {
    setEditing(null);
    setForm({ type: "depense", category: "", amount: "", date: todayISO(), payment_method: "Espèces", description: "", reference: "", supplier_id: "" });
    setOpen(true);
  }
  function openEdit(t: TxRow) {
    if (t._auto) { toast.info("Les paiements de scolarité se modifient dans le module Scolarité."); return; }
    setEditing(t);
    setForm({
      type: t.type, category: t.category, amount: String(t.amount), date: t.date,
      payment_method: t.payment_method ?? "Espèces", description: t.description ?? "", reference: t.reference ?? "",
      supplier_id: t.supplier_id ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!schoolId) return;
    if (saving) return;
    const amount = Number(form.amount);
    if (!form.category) return toast.error("Catégorie requise");
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Montant invalide");
    if (!form.date) return toast.error("Date requise");
    const payload = {
      school_id: schoolId,
      type: form.type,
      category: form.category,
      amount,
      date: form.date,
      payment_method: form.payment_method || null,
      description: form.description || null,
      reference: form.reference || null,
      recorded_by: user?.id ?? null,
      supplier_id: form.type === "depense" ? (form.supplier_id || null) : null,
    };
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from("transactions").update(payload).eq("id", editing.id);
        if (error) return toast.error("Échec de la mise à jour");
        toast.success("Transaction mise à jour");
      } else {
        const { error } = await supabase.from("transactions").insert(payload);
        if (error) return toast.error("Échec de l'enregistrement");
        toast.success("Transaction enregistrée");
      }
      setOpen(false);
      await fetchAll();
    } finally {
      setSaving(false);
    }
  }


  async function confirmDelete() {
    if (!deleting) return;
    const { error } = await supabase.from("transactions").delete().eq("id", deleting.id);
    if (error) { toast.error("Échec de la suppression"); return; }
    toast.success("Transaction supprimée");
    setDeleting(null);
    fetchAll();
  }

  const supplierName = useCallback((id: string | null | undefined) => {
    if (!id) return "";
    return suppliers.find(s => s.id === id)?.name ?? "";
  }, [suppliers]);

  function exportCSV() {
    const rows = [["Date","Type","Catégorie","Description","Bénéficiaire","Montant","Méthode","Référence"]];
    filteredList.forEach(t => rows.push([
      t.date, t.type, t.category, (t.description ?? "").replace(/[\r\n,;]/g, " "),
      supplierName(t.supplier_id),
      String(t.amount), t.payment_method ?? "", t.reference ?? "",
    ]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `comptabilite_${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // Plan gate
  if (!planLoading && !hasFeature("accounting") && user?.role !== "super_admin") {
    return (
      <AppLayout title="Comptabilité">
        <LockedFeatureOverlay requiredPlan={requiredPlanFor("accounting")} featureLabel="Comptabilité" />
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout title="Comptabilité">
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Accès réservé à l'administration.</CardContent></Card>
      </AppLayout>
    );
  }

  const catOptions = form.type === "recette" ? recetteCats : depenseCats;

  return (
    <AppLayout title="Comptabilité">
      <div className="space-y-6">
        {/* Period filters */}
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div>
              <Label className="text-xs">Du</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
            </div>
            <div>
              <Label className="text-xs">Au</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setCatManagerOpen(true)}>Gérer les catégories</Button>
              <Button variant="outline" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />Exporter CSV</Button>
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nouvelle transaction</Button>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard label="Total recettes" value={fcfa(totals.recettes)} icon={<TrendingUp className="h-5 w-5" />} tone="success" />
          <KpiCard label="Total dépenses" value={fcfa(totals.depenses)} icon={<TrendingDown className="h-5 w-5" />} tone="destructive" />
          <KpiCard label="Solde de la période" value={fcfa(totals.solde)} icon={<Scale className="h-5 w-5" />} tone={totals.solde >= 0 ? "success" : "destructive"} />
          <KpiCard label="Solde de caisse actuel" value={fcfa(cashBalance)} icon={<Wallet className="h-5 w-5" />} tone={cashBalance >= 0 ? "primary" : "destructive"} />
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList>
            <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="report">Rapport</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4 pt-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-medium">Recettes vs Dépenses par mois</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <RTooltip formatter={(v: number) => fcfa(Number(v))} />
                      <Legend />
                      <Bar dataKey="recettes" name="Recettes" fill="#10b981" />
                      <Bar dataKey="depenses" name="Dépenses" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <DonutCard title="Dépenses par catégorie" data={depCats} />
              <DonutCard title="Recettes par catégorie" data={recCats} />
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4 pt-4">
            <Card>
              <CardContent className="flex flex-wrap items-end gap-3 p-4">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="recette">Recettes</SelectItem>
                      <SelectItem value="depense">Dépenses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Catégorie</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 text-sm text-muted-foreground">Chargement…</div>
                ) : filteredList.length === 0 ? (
                  <div className="p-10 text-center text-sm text-muted-foreground">Aucune transaction sur cette période.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Catégorie</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Méthode</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredList.map(t => (
                        <TableRow key={t.id}>
                          <TableCell className="whitespace-nowrap">{t.date}</TableCell>
                          <TableCell>
                            {t.type === "recette" ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400">Recette</Badge>
                            ) : (
                              <Badge className="bg-red-500/15 text-red-700 hover:bg-red-500/15 dark:text-red-400">Dépense</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {t.category}
                            {t._auto && <Badge variant="outline" className="ml-2 text-[10px]">Auto · Scolarité</Badge>}
                          </TableCell>
                          <TableCell className="max-w-[280px] truncate text-muted-foreground">{t.description}</TableCell>
                          <TableCell className="text-muted-foreground">{t.payment_method}</TableCell>
                          <TableCell className={`text-right font-medium ${t.type === "recette" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                            {t.type === "recette" ? "+" : "−"} {fcfa(Number(t.amount))}
                          </TableCell>
                          <TableCell>
                            {!t._auto && (
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => setDeleting(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="report" className="pt-4">
            <Card>
              <CardContent className="space-y-4 p-6">
                <div>
                  <h2 className="text-lg font-semibold">Rapport financier</h2>
                  <p className="text-sm text-muted-foreground">Période : {from} → {to}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <ReportLine label="Total recettes" value={fcfa(totals.recettes)} className="text-emerald-600 dark:text-emerald-400" />
                  <ReportLine label="Total dépenses" value={fcfa(totals.depenses)} className="text-red-600 dark:text-red-400" />
                  <ReportLine label="Solde net" value={fcfa(totals.solde)} className={totals.solde >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <CategoryTable title="Recettes par catégorie" data={recCats} total={totals.recettes} />
                  <CategoryTable title="Dépenses par catégorie" data={depCats} total={totals.depenses} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => window.print()}>Imprimer</Button>
                  <Button variant="outline" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />Exporter CSV</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la transaction" : "Nouvelle transaction"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v as TxType, category: "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recette">Recette</SelectItem>
                    <SelectItem value="depense">Dépense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Catégorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {catOptions.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Montant (FCFA)</Label>
                <Input type="number" min="0" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Méthode de paiement</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm(f => ({ ...f, payment_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label>Référence (optionnel)</Label>
              <Input value={form.reference} onChange={(e) => setForm(f => ({ ...f, reference: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : (editing ? "Enregistrer" : "Créer")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette transaction ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CategoryManagerDialog
        open={catManagerOpen}
        onOpenChange={setCatManagerOpen}
        schoolId={schoolId ?? ""}
        categories={categories}
        usageCount={(name, type) => allItems.filter(t => t.category === name && t.type === type).length}
        onChanged={fetchAll}
      />
    </AppLayout>
  );
}

function KpiCard({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "success"|"destructive"|"primary" }) {
  const toneCls =
    tone === "success" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
    tone === "destructive" ? "bg-red-500/10 text-red-600 dark:text-red-400" :
    "bg-primary/10 text-primary";
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-xl font-semibold">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneCls}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}

function DonutCard({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="mb-3 text-sm font-medium">{title}</h3>
        {data.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Aucune donnée</div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <RTooltip formatter={(v: number) => fcfa(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportLine({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${className ?? ""}`}>{value}</div>
    </div>
  );
}

function CategoryTable({ title, data, total }: { title: string; data: { name: string; value: number }[]; total: number }) {
  return (
    <div className="rounded-lg border border-border">
      <div className="border-b border-border p-3 text-sm font-medium">{title}</div>
      {data.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">Aucune donnée</div>
      ) : (
        <Table>
          <TableBody>
            {data.map(d => (
              <TableRow key={d.name}>
                <TableCell>{d.name}</TableCell>
                <TableCell className="text-right">{fcfa(d.value)}</TableCell>
                <TableCell className="w-16 text-right text-xs text-muted-foreground">{total > 0 ? `${Math.round((d.value/total)*100)}%` : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function CategoryManagerDialog({
  open, onOpenChange, schoolId, categories, usageCount, onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  schoolId: string;
  categories: CategoryRow[];
  usageCount: (name: string, type: TxType) => number;
  onChanged: () => void | Promise<void>;
}) {
  const [newName, setNewName] = useState<{ recette: string; depense: string }>({ recette: "", depense: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);

  const recettes = useMemo(() => categories.filter(c => c.type === "recette"), [categories]);
  const depenses = useMemo(() => categories.filter(c => c.type === "depense"), [categories]);

  async function addCategory(type: TxType) {
    const name = newName[type].trim();
    if (!schoolId || !name) return;
    if (categories.some(c => c.type === type && c.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Cette catégorie existe déjà");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("transaction_categories").insert({ school_id: schoolId, type, name });
      if (error) return toast.error("Échec de la création");
      setNewName(n => ({ ...n, [type]: "" }));
      toast.success("Catégorie ajoutée");
      await onChanged();
    } finally { setBusy(false); }
  }

  async function saveEdit() {
    if (!editingId || !editingName.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("transaction_categories").update({ name: editingName.trim() }).eq("id", editingId);
      if (error) return toast.error("Échec de la mise à jour");
      setEditingId(null); setEditingName("");
      toast.success("Catégorie renommée");
      await onChanged();
    } finally { setBusy(false); }
  }

  async function removeCategory(cat: CategoryRow) {
    const fallback = cat.type === "recette" ? FALLBACK_RECETTE : FALLBACK_DEPENSE;
    if (cat.name === fallback) { toast.error(`"${fallback}" ne peut pas être supprimée.`); return; }
    const used = usageCount(cat.name, cat.type);
    if (used > 0) {
      const ok = window.confirm(`${used} transaction(s) utilisent "${cat.name}". Elles seront réassignées à "${fallback}". Continuer ?`);
      if (!ok) return;
    } else {
      const ok = window.confirm(`Supprimer la catégorie "${cat.name}" ?`);
      if (!ok) return;
    }
    setBusy(true);
    try {
      if (used > 0) {
        const { error: uerr } = await supabase.from("transactions")
          .update({ category: fallback })
          .eq("school_id", schoolId).eq("type", cat.type).eq("category", cat.name);
        if (uerr) return toast.error("Échec de la réassignation");
      }
      const { error } = await supabase.from("transaction_categories").delete().eq("id", cat.id);
      if (error) return toast.error("Échec de la suppression");
      toast.success("Catégorie supprimée");
      await onChanged();
    } finally { setBusy(false); }
  }

  function renderList(type: TxType, list: CategoryRow[]) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Nouvelle catégorie"
            value={newName[type]}
            onChange={(e) => setNewName(n => ({ ...n, [type]: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(type); } }}
          />
          <Button onClick={() => addCategory(type)} disabled={busy || !newName[type].trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-64 overflow-auto rounded-md border border-border">
          {list.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">Aucune catégorie</div>
          ) : list.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 last:border-0">
              {editingId === c.id ? (
                <>
                  <Input value={editingName} onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }} className="h-8" />
                  <div className="flex gap-1">
                    <Button size="sm" onClick={saveEdit} disabled={busy}>OK</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditingName(""); }}>Annuler</Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-sm">{c.name}
                    <span className="ml-2 text-xs text-muted-foreground">({usageCount(c.name, type)})</span>
                  </span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditingId(c.id); setEditingName(c.name); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => removeCategory(c)} disabled={busy}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gérer les catégories</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">Catégories de recettes</h3>
            {renderList("recette", recettes)}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">Catégories de dépenses</h3>
            {renderList("depense", depenses)}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
