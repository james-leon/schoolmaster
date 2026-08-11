import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Briefcase, Users, Wallet, CheckCircle2, Clock, Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TableEmpty } from "@/components/states";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/personnel/")({ component: PersonnelPage });

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
const PAYMENT_METHODS = ["Espèces","MTN Mobile Money","Orange Money","Virement bancaire","Chèque"];

function StatusBadge({ s }: { s: string }) {
  const { t } = useTranslation();
  const map: Record<string, string> = {
    actif: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
    suspendu: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    parti: "bg-muted text-muted-foreground border-border",
  };
  return <Badge variant="outline" className={map[s] ?? ""}>{t(`staff.statuses.${s}`, s)}</Badge>;
}

function PersonnelPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { hasFeature, loading: planLoading } = usePlan();
  const navigate = useNavigate();
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
  const [confirmDel, setConfirmDel] = useState<Staff | null>(null);
  const [payDialog, setPayDialog] = useState<Payroll | null>(null);
  const [payMethod, setPayMethod] = useState("Espèces");

  const fetchAll = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const [s, t, p] = await Promise.all([
      sb.from("staff").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }),
      sb.from("teachers").select("id,first_name,last_name").eq("school_id", schoolId),
      sb.from("payroll").select("id,staff_id,month,year,net_salary,status").eq("school_id", schoolId).order("year", { ascending: false }).order("month", { ascending: false }),
    ]);
    if (s.error) toast.error(t("staff.toasts.loadError"));
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
  const staffMap = useMemo(() => Object.fromEntries(staff.map(s => [s.id, s])), [staff]);

  const resetForm = () => setForm({
    first_name: "", last_name: "", role_title: "Enseignant", phone: "", email: "",
    address: "", gender: "", date_of_birth: "", hire_date: "",
    contract_type: "CDI", contract_start: "", contract_end: "",
    base_salary: "", status: "actif", diplomas: "", notes: "", linked_teacher_id: "",
  });

  const submit = async () => {
    if (!schoolId) return;
    if (!form.first_name.trim() || !form.last_name.trim() || !form.role_title) {
      toast.error(t("staff.toasts.requiredFields")); return;
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
    toast.success(t("staff.toasts.added"));
    setOpen(false); resetForm(); fetchAll();
  };

  const deleteStaff = async (id: string) => {
    const { error } = await sb.from("staff").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("staff.toasts.deleted"));
    setConfirmDel(null); fetchAll();
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
    if (toCreate.length === 0) { toast.info(t("payroll.toasts.alreadyGenerated")); return; }
    const { data: inserted, error } = await sb.from("payroll").insert(toCreate).select("id");
    if (error) { toast.error(error.message); return; }
    if (inserted?.length) {
      await sb.from("payroll_history").insert(
        inserted.map((r: any) => ({
          school_id: schoolId, payroll_id: r.id, action: "créé",
          old_status: null, new_status: "en attente", reason: "Génération groupée",
          changed_by: user?.id ?? null,
        }))
      );
    }
    toast.success(t("payroll.toasts.generated", { count: toCreate.length }));
    fetchAll();
  };


  const markPaid = async () => {
    if (!payDialog) return;
    const s = staffMap[payDialog.staff_id];
    if (!s) return;
    const today = new Date().toISOString().slice(0, 10);
    const prevStatus = payDialog.status;
    const { error } = await sb.from("payroll").update({
      status: "payé", payment_date: today, payment_method: payMethod,
    }).eq("id", payDialog.id);
    if (error) { toast.error(error.message); return; }
    const { data: tx } = await sb.from("transactions").insert({
      school_id: s.school_id, type: "depense", category: "Salaires",
      amount: Number(payDialog.net_salary || 0), date: today,
      payment_method: payMethod,
      description: `Salaire ${MONTHS_FR[payDialog.month - 1]} ${payDialog.year} — ${s.first_name} ${s.last_name}`,
      reference: `PAIE-${payDialog.year}-${String(payDialog.month).padStart(2, "0")}-${s.last_name.toUpperCase()}`,
    }).select("id").maybeSingle();
    if (tx?.id) await sb.from("payroll").update({ transaction_id: tx.id }).eq("id", payDialog.id);
    await sb.from("payroll_history").insert({
      school_id: s.school_id, payroll_id: payDialog.id, action: "payé",
      old_status: prevStatus, new_status: "payé",
      reason: `Méthode: ${payMethod}`, changed_by: user?.id ?? null,
    });
    toast.success(t("staff.payslips.toastsShared.paymentRecorded"));
    setPayDialog(null); fetchAll();
  };


  if (planLoading) return <AppLayout title="Personnel"><div className="p-8 text-muted-foreground">Chargement…</div></AppLayout>;
  if (!isAdmin) return <AppLayout title="Personnel"><div className="p-8 text-muted-foreground">Accès réservé à l'administration.</div></AppLayout>;
  if (user?.role !== "super_admin" && !hasFeature("personnel")) {
    return <AppLayout title="Personnel"><LockedFeatureOverlay requiredPlan={requiredPlanFor("personnel")} featureLabel="Personnel" /></AppLayout>;
  }

  return (
    <AppLayout title="Personnel">
      <div className="space-y-6">
        {/* Summary KPIs */}
        <div className="grid gap-3 md:grid-cols-4">
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-primary/10 p-2 text-primary"><Users className="h-5 w-5" /></div>
            <div><div className="text-xs text-muted-foreground">{t("staff.kpi.activeStaff")}</div>
              <div className="text-lg font-semibold">{staff.filter(s => s.status === "actif").length}</div></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-accent/10 p-2 text-accent"><Wallet className="h-5 w-5" /></div>
            <div><div className="text-xs text-muted-foreground">{t("staff.kpi.wageBillMonth")}</div>
              <div className="text-lg font-semibold">{fcfa(masseSalariale)}</div></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-green-500/10 p-2 text-green-600"><CheckCircle2 className="h-5 w-5" /></div>
            <div><div className="text-xs text-muted-foreground">{t("staff.kpi.paidMonth", { month: MONTHS_FR[month - 1] })}</div>
              <div className="text-lg font-semibold">{paidCount} · {fcfa(totalPaid)}</div></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-amber-500/10 p-2 text-amber-600"><Clock className="h-5 w-5" /></div>
            <div><div className="text-xs text-muted-foreground">{t("staff.kpi.pending")}</div>
              <div className="text-lg font-semibold">{pendingCount}</div></div>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">{t("staff.tabs.list")}</TabsTrigger>
            <TabsTrigger value="payroll">{t("staff.tabs.payroll")}</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            {/* Filters & Add */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">{t("staff.search")}</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("staff.searchPlaceholder")} />
                </div>
              </div>
              <div><Label className="text-xs">{t("staff.role")}</Label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">{t("staff.allRoles")}</SelectItem>
                    {ROLE_TITLES.map(r => <SelectItem key={r} value={r}>{t(`staff.roles.${r}`, r)}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label className="text-xs">{t("common.status")}</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">{t("staff.allStatuses")}</SelectItem>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{t(`staff.statuses.${s}`, s)}</SelectItem>)}</SelectContent>
                </Select></div>
              <Button onClick={() => { resetForm(); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />{t("staff.newStaffMember")}</Button>
            </div>

            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t("staff.table.name")}</TableHead><TableHead>{t("staff.table.role")}</TableHead>
                  <TableHead>{t("staff.table.contract")}</TableHead><TableHead>{t("staff.table.salary")}</TableHead>
                  <TableHead>{t("staff.table.phone")}</TableHead><TableHead>{t("staff.table.status")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {loading ? <TableRow><TableCell colSpan={7} className="p-3"><Skeleton className="h-24 w-full" /></TableCell></TableRow>
                  : filtered.length === 0 ? (
                    <TableEmpty
                      colSpan={7}
                      icon={Briefcase}
                      titleKey="emptyStaff"
                      filtered={staff.length > 0}
                      onClearFilters={() => { setSearch(""); setRoleFilter("all"); setStatusFilter("all"); }}
                      actionLabel={t("staff.newStaffMember")}
                      onAction={() => { resetForm(); setOpen(true); }}
                    />
                  )
                  : filtered.map(s => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link to="/personnel/$staffId" params={{ staffId: s.id }} className="font-medium text-primary hover:underline">
                          {s.first_name} {s.last_name}
                        </Link>
                      </TableCell>
                      <TableCell>{t(`staff.roles.${s.role_title}`, s.role_title)}</TableCell>
                      <TableCell>{s.contract_type ? t(`staff.contractTypes.${s.contract_type}`, s.contract_type) : "—"}</TableCell>
                      <TableCell>{fcfa(Number(s.base_salary || 0))}</TableCell>
                      <TableCell>{s.phone ?? "—"}</TableCell>
                      <TableCell><StatusBadge s={s.status} /></TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="icon" variant="ghost" title={t("staff.viewTooltip")}
                          onClick={() => navigate({ to: "/personnel/$staffId", params: { staffId: s.id } })}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title={t("staff.editTooltip")}
                          onClick={() => navigate({ to: "/personnel/$staffId", params: { staffId: s.id } })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title={t("staff.deleteTooltip")} onClick={() => setConfirmDel(s)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="payroll" className="space-y-4">
            <Card><CardContent className="flex flex-wrap items-end gap-3 p-4">
              <div><Label className="text-xs">{t("payroll.monthLabel")}</Label>
                <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS_FR.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label className="text-xs">{t("payroll.yearLabel")}</Label>
                <Input type="number" className="w-[100px]" value={year} onChange={e => setYear(Number(e.target.value))} /></div>
              <Button onClick={bulkGenerate}>{t("payroll.generateAllButton")}</Button>
            </CardContent></Card>

            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t("payroll.table.employee")}</TableHead><TableHead>{t("payroll.table.period")}</TableHead>
                  <TableHead>{t("payroll.table.net")}</TableHead><TableHead>{t("payroll.table.status")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {monthPayroll.length === 0 ? (
                    <TableEmpty colSpan={5} titleKey="emptyPayroll" actionLabel={t("payroll.generateAllButton")} onAction={bulkGenerate} />
                  )
                  : monthPayroll.map(p => {
                    const s = staffMap[p.staff_id];
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{s ? (
                          <Link to="/personnel/$staffId" params={{ staffId: s.id }} className="font-medium text-primary hover:underline">
                            {s.first_name} {s.last_name}
                          </Link>
                        ) : "—"}</TableCell>
                        <TableCell>{MONTHS_FR[p.month - 1]} {p.year}</TableCell>
                        <TableCell className="font-semibold">{fcfa(Number(p.net_salary))}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={p.status === "payé" ? "border-green-500/30 bg-green-500/10 text-green-700" : ""}>
                            {t(`staff.leave.statuses.${p.status}`, p.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {p.status !== "payé" ? (
                            <Button size="sm" variant="outline" onClick={() => { setPayDialog(p); setPayMethod("Espèces"); }}>
                              {t("payroll.markPaidButton")}
                            </Button>
                          ) : <span className="text-xs text-muted-foreground">{t("payroll.paid")}</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("staff.newStaffMember")}</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>{t("staff.form.firstName")}</Label><Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
            <div><Label>{t("staff.form.lastName")}</Label><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
            <div><Label>{t("staff.form.role")}</Label>
              <Select value={form.role_title} onValueChange={v => setForm({ ...form, role_title: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLE_TITLES.map(r => <SelectItem key={r} value={r}>{t(`staff.roles.${r}`, r)}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label>{t("staff.form.linkTeacher")}</Label>
              <Select value={form.linked_teacher_id || "none"} onValueChange={v => setForm({ ...form, linked_teacher_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder={t("staff.form.none")} /></SelectTrigger>
                <SelectContent><SelectItem value="none">{t("staff.form.none")}</SelectItem>
                  {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label>{t("staff.form.phone")}</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>{t("staff.form.email")}</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>{t("staff.form.address")}</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>{t("staff.form.gender")}</Label>
              <Select value={form.gender || "none"} onValueChange={v => setForm({ ...form, gender: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value="none">—</SelectItem><SelectItem value="M">{t("staff.form.male")}</SelectItem><SelectItem value="F">{t("staff.form.female")}</SelectItem></SelectContent>
              </Select></div>
            <div><Label>{t("staff.form.dob")}</Label><Input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} /></div>
            <div><Label>{t("staff.form.hireDate")}</Label><Input type="date" value={form.hire_date} onChange={e => setForm({ ...form, hire_date: e.target.value })} /></div>
            <div><Label>{t("staff.form.contractType")}</Label>
              <Select value={form.contract_type} onValueChange={v => setForm({ ...form, contract_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTRACT_TYPES.map(c => <SelectItem key={c} value={c}>{t(`staff.contractTypes.${c}`, c)}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label>{t("staff.form.contractStart")}</Label><Input type="date" value={form.contract_start} onChange={e => setForm({ ...form, contract_start: e.target.value })} /></div>
            <div><Label>{t("staff.form.contractEnd")}</Label><Input type="date" value={form.contract_end} onChange={e => setForm({ ...form, contract_end: e.target.value })} /></div>
            <div><Label>{t("staff.form.baseSalary")}</Label><Input type="number" value={form.base_salary} onChange={e => setForm({ ...form, base_salary: e.target.value })} /></div>
            <div><Label>{t("staff.form.status")}</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{t(`staff.statuses.${s}`, s)}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="md:col-span-2"><Label>{t("staff.form.diplomas")}</Label><Textarea rows={2} value={form.diplomas} onChange={e => setForm({ ...form, diplomas: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>{t("staff.form.notes")}</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={submit}>{t("common.add")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("staff.confirmDelete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDel && <>{t("staff.confirmDelete.description", { name: `${confirmDel.first_name} ${confirmDel.last_name}` }).split("<strong>")[0]}<strong>{confirmDel.first_name} {confirmDel.last_name}</strong>{t("staff.confirmDelete.description", { name: "" }).split("</strong>")[1]}</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && deleteStaff(confirmDel.id)}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark paid dialog */}
      <Dialog open={!!payDialog} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("staff.payslips.markPaidDialog.title")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {t("staff.payslips.markPaidDialog.netToPay")} <span className="font-semibold text-foreground">{fcfa(Number(payDialog?.net_salary ?? 0))}</span>
            </div>
            <div><Label>{t("staff.payslips.markPaidDialog.paymentMethod")}</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="text-xs text-muted-foreground">
              {t("staff.payslips.markPaidDialog.expenseNote")}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>{t("common.cancel")}</Button>
            <Button onClick={markPaid}>{t("staff.payslips.markPaidDialog.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
