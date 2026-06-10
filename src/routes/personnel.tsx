import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Briefcase, Users, Wallet, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/personnel")({ component: PersonnelPage });

const sb = supabase as any;

interface Staff {
  id: string; school_id: string; first_name: string; last_name: string;
  role_title: string; phone: string | null; email: string | null;
  contract_type: string | null; status: string; base_salary: number;
  linked_teacher_id: string | null;
}
interface Teacher { id: string; first_name: string; last_name: string; }
interface Payroll { id: string; staff_id: string; month: number; year: number; net_salary: number; status: string; }

const ROLE_TITLES = ["Enseignant","Directeur adjoint","Secrétaire","Comptable","Surveillant","Gardien","Agent d'entretien","Chauffeur","Cuisinier","Infirmier","Autre"];
const CONTRACT_TYPES = ["CDI","CDD","Stage","Vacataire"];
const STATUSES = ["actif","suspendu","parti"];
const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function statusBadge(s: string) {
  const map: Record<string, string> = {
    actif: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
    suspendu: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    parti: "bg-muted text-muted-foreground border-border",
  };
  return <Badge variant="outline" className={map[s] ?? ""}>{s}</Badge>;
}

function PersonnelPage() {
  const { user } = useAuth();
  const { hasFeature, loading: planLoading } = usePlan();
  const schoolId = user?.schoolId;
  const isAdmin = user?.role === "school_admin" || user?.role === "super_admin";

  const now = new Date();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    first_name: "", last_name: "", role_title: "Enseignant", phone: "", email: "",
    address: "", gender: "", date_of_birth: "", hire_date: "",
    contract_type: "CDI", contract_start: "", contract_end: "",
    base_salary: "", status: "actif", diplomas: "", notes: "", linked_teacher_id: "",
  });

  const fetchAll = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const [s, t, p] = await Promise.all([
      sb.from("staff").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }),
      sb.from("teachers").select("id,first_name,last_name").eq("school_id", schoolId),
      sb.from("payroll").select("id,staff_id,month,year,net_salary,status").eq("school_id", schoolId),
    ]);
    if (s.error) toast.error("Erreur chargement personnel");
    setStaff((s.data ?? []) as Staff[]);
    setTeachers((t.data ?? []) as Teacher[]);
    setPayroll((p.data ?? []) as Payroll[]);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter(s =>
      (roleFilter === "all" || s.role_title === roleFilter) &&
      (statusFilter === "all" || s.status === statusFilter) &&
      (!q || `${s.first_name} ${s.last_name} ${s.role_title}`.toLowerCase().includes(q))
    );
  }, [staff, search, roleFilter, statusFilter]);

  const monthPayroll = useMemo(() => payroll.filter(p => p.month === month && p.year === year), [payroll, month, year]);
  const masseSalariale = useMemo(() => staff.filter(s => s.status === "actif").reduce((a, s) => a + Number(s.base_salary || 0), 0), [staff]);
  const paidCount = monthPayroll.filter(p => p.status === "payé").length;
  const pendingCount = monthPayroll.filter(p => p.status !== "payé").length;
  const totalPaid = monthPayroll.filter(p => p.status === "payé").reduce((a, p) => a + Number(p.net_salary || 0), 0);

  const resetForm = () => setForm({
    first_name: "", last_name: "", role_title: "Enseignant", phone: "", email: "",
    address: "", gender: "", date_of_birth: "", hire_date: "",
    contract_type: "CDI", contract_start: "", contract_end: "",
    base_salary: "", status: "actif", diplomas: "", notes: "", linked_teacher_id: "",
  });

  const submit = async () => {
    if (!schoolId) return;
    if (!form.first_name.trim() || !form.last_name.trim() || !form.role_title) {
      toast.error("Nom, prénom et fonction sont requis"); return;
    }
    const payload: any = {
      school_id: schoolId,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      role_title: form.role_title,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      hire_date: form.hire_date || null,
      contract_type: form.contract_type || null,
      contract_start: form.contract_start || null,
      contract_end: form.contract_end || null,
      base_salary: Number(form.base_salary) || 0,
      status: form.status,
      diplomas: form.diplomas || null,
      notes: form.notes || null,
      linked_teacher_id: form.linked_teacher_id || null,
    };
    const { error } = await sb.from("staff").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Membre du personnel ajouté");
    setOpen(false); resetForm(); fetchAll();
  };

  const bulkGenerate = async () => {
    if (!schoolId) return;
    const active = staff.filter(s => s.status === "actif");
    const existing = new Set(monthPayroll.map(p => p.staff_id));
    const toCreate = active.filter(s => !existing.has(s.id)).map(s => ({
      school_id: schoolId, staff_id: s.id, month, year,
      base_salary: Number(s.base_salary || 0),
      bonuses: 0, deductions: 0, net_salary: Number(s.base_salary || 0),
      status: "en attente",
    }));
    if (toCreate.length === 0) { toast.info("Toutes les fiches du mois sont déjà créées"); return; }
    const { error } = await sb.from("payroll").insert(toCreate);
    if (error) { toast.error(error.message); return; }
    toast.success(`${toCreate.length} fiche(s) générée(s)`);
    fetchAll();
  };

  if (planLoading) return <AppLayout title="Personnel"><div className="p-8" /></AppLayout>;
  if (!isAdmin) return <AppLayout title="Personnel"><div className="p-8 text-muted-foreground">Accès réservé à l'administration.</div></AppLayout>;
  if (user?.role !== "super_admin" && !hasFeature("accounting")) {
    return <AppLayout title="Personnel"><LockedFeatureOverlay feature="accounting" plan={requiredPlanFor("accounting")} /></AppLayout>;
  }

  return (
    <AppLayout title="Personnel">
      <div className="space-y-6">
        {/* Payroll Overview */}
        <div className="grid gap-3 md:grid-cols-4">
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-primary/10 p-2 text-primary"><Users className="h-5 w-5" /></div>
            <div><div className="text-xs text-muted-foreground">Personnel actif</div>
              <div className="text-lg font-semibold">{staff.filter(s => s.status === "actif").length}</div></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-accent/10 p-2 text-accent"><Wallet className="h-5 w-5" /></div>
            <div><div className="text-xs text-muted-foreground">Masse salariale / mois</div>
              <div className="text-lg font-semibold">{fcfa(masseSalariale)}</div></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-green-500/10 p-2 text-green-600"><CheckCircle2 className="h-5 w-5" /></div>
            <div><div className="text-xs text-muted-foreground">Payés ({MONTHS_FR[month-1]})</div>
              <div className="text-lg font-semibold">{paidCount} · {fcfa(totalPaid)}</div></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-amber-500/10 p-2 text-amber-600"><Clock className="h-5 w-5" /></div>
            <div><div className="text-xs text-muted-foreground">En attente</div>
              <div className="text-lg font-semibold">{pendingCount}</div></div>
          </CardContent></Card>
        </div>

        {/* Bulk action */}
        <Card><CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div><Label className="text-xs">Mois</Label>
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS_FR.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label className="text-xs">Année</Label>
            <Input type="number" className="w-[100px]" value={year} onChange={e => setYear(Number(e.target.value))} /></div>
          <Button onClick={bulkGenerate}>Générer toutes les fiches du mois</Button>
        </CardContent></Card>

        {/* Filters & Add */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Recherche</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, fonction…" />
            </div>
          </div>
          <div><Label className="text-xs">Fonction</Label>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Toutes</SelectItem>
                {ROLE_TITLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label className="text-xs">Statut</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tous</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select></div>
          <Button onClick={() => { resetForm(); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />Nouveau</Button>
        </div>

        {/* List */}
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nom</TableHead><TableHead>Fonction</TableHead>
              <TableHead>Contrat</TableHead><TableHead>Salaire</TableHead>
              <TableHead>Téléphone</TableHead><TableHead>Statut</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Chargement…</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                <Briefcase className="mx-auto mb-2 h-8 w-8 opacity-40" />Aucun membre du personnel
              </TableCell></TableRow>
              : filtered.map(s => (
                <TableRow key={s.id} className="cursor-pointer hover:bg-muted/40">
                  <TableCell><Link to="/personnel/$staffId" params={{ staffId: s.id }} className="font-medium hover:underline">
                    {s.first_name} {s.last_name}</Link></TableCell>
                  <TableCell>{s.role_title}</TableCell>
                  <TableCell>{s.contract_type ?? "—"}</TableCell>
                  <TableCell>{fcfa(Number(s.base_salary || 0))}</TableCell>
                  <TableCell>{s.phone ?? "—"}</TableCell>
                  <TableCell>{statusBadge(s.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>

      {/* Add dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nouveau membre du personnel</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>Prénom *</Label><Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
            <div><Label>Nom *</Label><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
            <div><Label>Fonction *</Label>
              <Select value={form.role_title} onValueChange={v => setForm({ ...form, role_title: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLE_TITLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label>Lier à un enseignant</Label>
              <Select value={form.linked_teacher_id || "none"} onValueChange={v => setForm({ ...form, linked_teacher_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent><SelectItem value="none">Aucun</SelectItem>
                  {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label>Téléphone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Adresse</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Genre</Label>
              <Select value={form.gender || "none"} onValueChange={v => setForm({ ...form, gender: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value="none">—</SelectItem><SelectItem value="M">Masculin</SelectItem><SelectItem value="F">Féminin</SelectItem></SelectContent>
              </Select></div>
            <div><Label>Date de naissance</Label><Input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} /></div>
            <div><Label>Date d'embauche</Label><Input type="date" value={form.hire_date} onChange={e => setForm({ ...form, hire_date: e.target.value })} /></div>
            <div><Label>Type de contrat</Label>
              <Select value={form.contract_type} onValueChange={v => setForm({ ...form, contract_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTRACT_TYPES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label>Début de contrat</Label><Input type="date" value={form.contract_start} onChange={e => setForm({ ...form, contract_start: e.target.value })} /></div>
            <div><Label>Fin de contrat</Label><Input type="date" value={form.contract_end} onChange={e => setForm({ ...form, contract_end: e.target.value })} /></div>
            <div><Label>Salaire de base (FCFA)</Label><Input type="number" value={form.base_salary} onChange={e => setForm({ ...form, base_salary: e.target.value })} /></div>
            <div><Label>Statut</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="md:col-span-2"><Label>Diplômes</Label><Textarea rows={2} value={form.diplomas} onChange={e => setForm({ ...form, diplomas: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
