import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Printer, Check, X, Trash2, Lock, History, Ban, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/personnel/$staffId")({ component: StaffDetailPage });

const sb = supabase as any;

const LEAVE_TYPES = ["congé","maladie","absence","permission"];
const LEAVE_STATUSES = ["en attente","approuvé","refusé"];
const PAYMENT_METHODS = ["Espèces","MTN Mobile Money","Orange Money","Virement bancaire","Chèque"];
const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

interface Staff { id: string; school_id: string; first_name: string; last_name: string;
  role_title: string; phone: string | null; email: string | null; address: string | null;
  gender: string | null; date_of_birth: string | null; hire_date: string | null;
  contract_type: string | null; contract_start: string | null; contract_end: string | null;
  base_salary: number; status: string; diplomas: string | null; notes: string | null;
  linked_teacher_id: string | null; }
interface Leave { id: string; type: string; start_date: string; end_date: string; reason: string | null; status: string; }
interface Payslip { id: string; staff_id: string; month: number; year: number;
  base_salary: number; bonuses: number; deductions: number; net_salary: number;
  payment_date: string | null; payment_method: string | null; status: string;
  transaction_id: string | null; }
interface School { name: string; logo_url: string | null; }
interface HistoryEntry { id: string; payroll_id: string; action: string; old_status: string | null;
  new_status: string | null; reason: string | null; changed_by: string | null; changed_at: string;
  profile?: { full_name: string | null; email: string | null } | null; }

function StaffDetailPage() {
  const { staffId } = useParams({ from: "/personnel/$staffId" });
  const { user } = useAuth();
  const { hasFeature, loading: planLoading } = usePlan();
  const isAdmin = user?.role === "school_admin" || user?.role === "super_admin";

  const [staff, setStaff] = useState<Staff | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [s, l, p] = await Promise.all([
      sb.from("staff").select("*").eq("id", staffId).maybeSingle(),
      sb.from("staff_leave").select("*").eq("staff_id", staffId).order("start_date", { ascending: false }),
      sb.from("payroll").select("*").eq("staff_id", staffId).order("year", { ascending: false }).order("month", { ascending: false }),
    ]);
    setStaff((s.data as Staff) ?? null);
    setLeaves((l.data ?? []) as Leave[]);
    const slips = (p.data ?? []) as Payslip[];
    setPayslips(slips);
    if (slips.length) {
      const ids = slips.map(x => x.id);
      const { data: h } = await sb.from("payroll_history")
        .select("*, profile:profiles!payroll_history_changed_by_fkey(full_name,email)")
        .in("payroll_id", ids).order("changed_at", { ascending: false });
      setHistory((h ?? []) as HistoryEntry[]);
    } else setHistory([]);
    if (s.data?.school_id) {
      const { data: sch } = await sb.from("schools").select("name,logo_url").eq("id", s.data.school_id).maybeSingle();
      setSchool(sch ?? null);
    }
    setLoading(false);
  }, [staffId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const historyByPayslip = useMemo(() => {
    const m: Record<string, HistoryEntry[]> = {};
    history.forEach(h => { (m[h.payroll_id] ||= []).push(h); });
    return m;
  }, [history]);

  const logHistory = async (payroll_id: string, action: string, old_status: string | null, new_status: string | null, reason: string | null) => {
    if (!staff) return;
    await sb.from("payroll_history").insert({
      school_id: staff.school_id, payroll_id, action, old_status, new_status, reason,
      changed_by: user?.id ?? null,
    });
  };

  // Edit staff
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const openEdit = () => {
    if (!staff) return;
    setEditForm({ ...staff,
      date_of_birth: staff.date_of_birth ?? "", hire_date: staff.hire_date ?? "",
      contract_start: staff.contract_start ?? "", contract_end: staff.contract_end ?? "",
      base_salary: String(staff.base_salary ?? ""),
    });
    setEditOpen(true);
  };
  const saveEdit = async () => {
    const patch: any = { ...editForm, base_salary: Number(editForm.base_salary) || 0 };
    delete patch.id; delete patch.school_id;
    ["date_of_birth","hire_date","contract_start","contract_end"].forEach(k => { if (!patch[k]) patch[k] = null; });
    const { error } = await sb.from("staff").update(patch).eq("id", staffId);
    if (error) { toast.error(error.message); return; }
    toast.success("Mis à jour"); setEditOpen(false); fetchAll();
  };

  // Leave
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: "congé", start_date: "", end_date: "", reason: "", status: "en attente" });
  const addLeave = async () => {
    if (!staff) return;
    if (!leaveForm.start_date || !leaveForm.end_date) { toast.error("Dates requises"); return; }
    const { error } = await sb.from("staff_leave").insert({ ...leaveForm, school_id: staff.school_id, staff_id: staff.id, reason: leaveForm.reason || null });
    if (error) { toast.error(error.message); return; }
    toast.success("Congé enregistré"); setLeaveOpen(false);
    setLeaveForm({ type: "congé", start_date: "", end_date: "", reason: "", status: "en attente" });
    fetchAll();
  };
  const setLeaveStatus = async (id: string, status: string) => {
    const { error } = await sb.from("staff_leave").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else fetchAll();
  };
  const deleteLeave = async (id: string) => {
    const { error } = await sb.from("staff_leave").delete().eq("id", id);
    if (error) toast.error(error.message); else fetchAll();
  };

  // Payroll
  const now = new Date();
  type Line = { label: string; amount: string };
  type PayForm = { month: number; year: number; base_salary: string; primes: Line[]; retenues: Line[] };
  const emptyPay: PayForm = { month: now.getMonth() + 1, year: now.getFullYear(), base_salary: "", primes: [], retenues: [] };

  const [paySlipOpen, setPaySlipOpen] = useState(false);
  const [payForm, setPayForm] = useState<PayForm>(emptyPay);
  const [editPayslipId, setEditPayslipId] = useState<string | null>(null);

  const openCreatePayslip = () => {
    setEditPayslipId(null);
    setPayForm({ ...emptyPay, base_salary: String(staff?.base_salary ?? "") });
    setPaySlipOpen(true);
  };
  const openEditPayslip = (p: Payslip) => {
    if (p.status === "payé") { toast.error("Annulez d'abord le paiement pour modifier"); return; }
    setEditPayslipId(p.id);
    setPayForm({
      month: p.month, year: p.year, base_salary: String(p.base_salary),
      primes: Number(p.bonuses) > 0 ? [{ label: "Primes", amount: String(p.bonuses) }] : [],
      retenues: Number(p.deductions) > 0 ? [{ label: "Retenues", amount: String(p.deductions) }] : [],
    });
    setPaySlipOpen(true);
  };

  const totalPrimes = useMemo(() => payForm.primes.reduce((a, l) => a + (Number(l.amount) || 0), 0), [payForm.primes]);
  const totalRetenues = useMemo(() => payForm.retenues.reduce((a, l) => a + (Number(l.amount) || 0), 0), [payForm.retenues]);
  const computedNet = useMemo(() => (Number(payForm.base_salary) || 0) + totalPrimes - totalRetenues, [payForm.base_salary, totalPrimes, totalRetenues]);
  const addLine = (kind: "primes" | "retenues") =>
    setPayForm(f => ({ ...f, [kind]: [...f[kind], { label: "", amount: "" }] }));
  const updateLine = (kind: "primes" | "retenues", i: number, patch: Partial<Line>) =>
    setPayForm(f => ({ ...f, [kind]: f[kind].map((l, idx) => idx === i ? { ...l, ...patch } : l) }));
  const removeLine = (kind: "primes" | "retenues", i: number) =>
    setPayForm(f => ({ ...f, [kind]: f[kind].filter((_, idx) => idx !== i) }));

  const savePayslip = async () => {
    if (!staff) return;
    const payload: any = {
      school_id: staff.school_id, staff_id: staff.id,
      month: Number(payForm.month), year: Number(payForm.year),
      base_salary: Number(payForm.base_salary) || 0,
      bonuses: totalPrimes,
      deductions: totalRetenues,
      net_salary: computedNet,
    };
    if (editPayslipId) {
      const prev = payslips.find(p => p.id === editPayslipId);
      if (prev?.status === "payé") { toast.error("Fiche verrouillée"); return; }
      const { error } = await sb.from("payroll").update(payload).eq("id", editPayslipId);
      if (error) { toast.error(error.message); return; }
      await logHistory(editPayslipId, "modifié", prev?.status ?? null, prev?.status ?? null, null);
      toast.success("Fiche modifiée");
    } else {
      payload.status = "en attente";
      const { data, error } = await sb.from("payroll").insert(payload).select("id").maybeSingle();
      if (error) { toast.error(error.message.includes("duplicate") ? "Fiche déjà existante pour ce mois" : error.message); return; }
      if (data?.id) await logHistory(data.id, "créé", null, "en attente", null);
      toast.success("Fiche de paie créée");
    }
    setPaySlipOpen(false); fetchAll();
  };

  const [payDialog, setPayDialog] = useState<Payslip | null>(null);
  const [payMethod, setPayMethod] = useState("Espèces");
  const markPaid = async () => {
    if (!payDialog || !staff) return;
    const today = new Date().toISOString().slice(0,10);
    const { error } = await sb.from("payroll").update({
      status: "payé", payment_date: today, payment_method: payMethod,
    }).eq("id", payDialog.id);
    if (error) { toast.error(error.message); return; }
    const { data: tx } = await sb.from("transactions").insert({
      school_id: staff.school_id, type: "depense", category: "Salaires",
      amount: Number(payDialog.net_salary || 0), date: today,
      payment_method: payMethod,
      description: `Salaire ${MONTHS_FR[payDialog.month-1]} ${payDialog.year} — ${staff.first_name} ${staff.last_name}`,
      reference: `PAIE-${payDialog.year}-${String(payDialog.month).padStart(2,"0")}-${staff.last_name.toUpperCase()}`,
    }).select("id").maybeSingle();
    if (tx?.id) await sb.from("payroll").update({ transaction_id: tx.id }).eq("id", payDialog.id);
    await logHistory(payDialog.id, "payé", payDialog.status, "payé", `Méthode: ${payMethod}`);
    toast.success("Paiement enregistré (dépense ajoutée en comptabilité)");
    setPayDialog(null); fetchAll();
  };

  // Cancel payment
  const [cancelDialog, setCancelDialog] = useState<Payslip | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const openCancel = (p: Payslip) => { setCancelDialog(p); setCancelReason(""); };
  const confirmCancel = async () => {
    if (!cancelDialog) return;
    if (cancelDialog.transaction_id) {
      const { error: txErr } = await sb.from("transactions").delete().eq("id", cancelDialog.transaction_id);
      if (txErr) { toast.error("Erreur suppression dépense : " + txErr.message); return; }
    }
    const { error } = await sb.from("payroll").update({
      status: "en attente", payment_date: null, payment_method: null, transaction_id: null,
    }).eq("id", cancelDialog.id);
    if (error) { toast.error(error.message); return; }
    await logHistory(cancelDialog.id, "annulé", "payé", "en attente", cancelReason || null);
    toast.success("Paiement annulé — dépense retirée de la comptabilité");
    setCancelDialog(null); setCancelReason(""); fetchAll();
  };

  const deletePayslip = async (p: Payslip) => {
    if (p.status === "payé") { toast.error("Annulez d'abord le paiement"); return; }
    const { error } = await sb.from("payroll").delete().eq("id", p.id);
    if (error) toast.error(error.message); else { toast.success("Fiche supprimée"); fetchAll(); }
  };

  // History view
  const [historyFor, setHistoryFor] = useState<Payslip | null>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const [printSlip, setPrintSlip] = useState<Payslip | null>(null);
  const triggerPrint = (slip: Payslip) => {
    setPrintSlip(slip);
    setTimeout(() => window.print(), 100);
  };
  useEffect(() => {
    const onAfter = () => setPrintSlip(null);
    window.addEventListener("afterprint", onAfter);
    return () => window.removeEventListener("afterprint", onAfter);
  }, []);

  if (planLoading || loading) return <AppLayout title="Personnel"><div className="p-8" /></AppLayout>;
  if (!isAdmin) return <AppLayout title="Personnel"><div className="p-8 text-muted-foreground">Accès réservé.</div></AppLayout>;
  if (!staff) return <AppLayout title="Personnel"><div className="p-8 text-muted-foreground">Membre introuvable.</div></AppLayout>;

  const actorName = (h: HistoryEntry) => h.profile?.full_name || h.profile?.email || "—";

  return (
    <AppLayout title={`${staff.first_name} ${staff.last_name}`}>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" asChild><Link to="/personnel"><ArrowLeft className="mr-1 h-4 w-4" />Retour</Link></Button>
        <Button variant="outline" size="sm" onClick={openEdit}>Modifier</Button>
      </div>

      <Card className="mb-4 print:hidden"><CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {staff.first_name[0]}{staff.last_name[0]}
        </div>
        <div className="flex-1">
          <div className="text-lg font-semibold">{staff.first_name} {staff.last_name}</div>
          <div className="text-sm text-muted-foreground">{staff.role_title} · {staff.contract_type ?? "—"}</div>
        </div>
        <Badge variant="outline">{staff.status}</Badge>
      </CardContent></Card>

      <Tabs defaultValue="info" className="print:hidden">
        <TabsList><TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="leave">Congés & Absences</TabsTrigger>
          <TabsTrigger value="pay">Fiches de paie</TabsTrigger></TabsList>

        <TabsContent value="info">
          <Card><CardContent className="grid gap-3 p-4 md:grid-cols-2">
            <Field label="Téléphone" value={staff.phone} />
            <Field label="Email" value={staff.email} />
            <Field label="Adresse" value={staff.address} />
            <Field label="Genre" value={staff.gender} />
            <Field label="Date de naissance" value={staff.date_of_birth} />
            <Field label="Date d'embauche" value={staff.hire_date} />
            <Field label="Type de contrat" value={staff.contract_type} />
            <Field label="Période de contrat" value={staff.contract_start ? `${staff.contract_start} → ${staff.contract_end ?? "—"}` : "—"} />
            <Field label="Salaire de base" value={fcfa(Number(staff.base_salary || 0))} />
            <Field label="Diplômes" value={staff.diplomas} />
            <div className="md:col-span-2"><Field label="Notes" value={staff.notes} /></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="leave">
          <div className="mb-3 flex justify-end"><Button onClick={() => setLeaveOpen(true)}><Plus className="mr-1 h-4 w-4" />Ajouter</Button></div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Type</TableHead><TableHead>Période</TableHead>
                <TableHead>Motif</TableHead><TableHead>Statut</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {leaves.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Aucun congé enregistré</TableCell></TableRow>
                : leaves.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="capitalize">{l.type}</TableCell>
                    <TableCell>{l.start_date} → {l.end_date}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{l.reason ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {l.status === "en attente" && <>
                        <Button size="icon" variant="ghost" onClick={() => setLeaveStatus(l.id, "approuvé")} title="Approuver"><Check className="h-4 w-4 text-green-600" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setLeaveStatus(l.id, "refusé")} title="Refuser"><X className="h-4 w-4 text-red-600" /></Button>
                      </>}
                      <Button size="icon" variant="ghost" onClick={() => deleteLeave(l.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="pay">
          <div className="mb-3 flex justify-end"><Button onClick={openCreatePayslip}><Plus className="mr-1 h-4 w-4" />Générer une fiche</Button></div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Période</TableHead><TableHead>Base</TableHead>
                <TableHead>Primes</TableHead><TableHead>Retenues</TableHead>
                <TableHead>Net</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {payslips.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Aucune fiche de paie</TableCell></TableRow>
                : payslips.map(p => {
                  const paid = p.status === "payé";
                  const lastPaid = historyByPayslip[p.id]?.find(h => h.action === "payé");
                  return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div>{MONTHS_FR[p.month-1]} {p.year}</div>
                      {paid && lastPaid && <div className="text-[10px] text-muted-foreground">Payé le {p.payment_date} par {actorName(lastPaid)}</div>}
                    </TableCell>
                    <TableCell>{fcfa(Number(p.base_salary))}</TableCell>
                    <TableCell>{fcfa(Number(p.bonuses))}</TableCell>
                    <TableCell>{fcfa(Number(p.deductions))}</TableCell>
                    <TableCell className="font-semibold">{fcfa(Number(p.net_salary))}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={paid ? "border-green-500/30 bg-green-500/10 text-green-700" : ""}>
                        {paid && <Lock className="mr-1 inline h-3 w-3" />}{p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => setHistoryFor(p)} title="Historique"><History className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => triggerPrint(p)} title="Imprimer"><Printer className="h-4 w-4" /></Button>
                      {!paid && <>
                        <Button size="icon" variant="ghost" onClick={() => openEditPayslip(p)} title="Modifier"><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="outline" onClick={() => { setPayDialog(p); setPayMethod("Espèces"); }}>Marquer payé</Button>
                        <Button size="icon" variant="ghost" onClick={() => deletePayslip(p)} title="Supprimer"><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                      </>}
                      {paid && (
                        <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10" onClick={() => openCancel(p)}>
                          <Ban className="mr-1 h-3 w-3" />Annuler le paiement
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );})}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Edit staff dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifier le membre</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>Prénom</Label><Input value={editForm.first_name ?? ""} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} /></div>
            <div><Label>Nom</Label><Input value={editForm.last_name ?? ""} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} /></div>
            <div><Label>Fonction</Label><Input value={editForm.role_title ?? ""} onChange={e => setEditForm({ ...editForm, role_title: e.target.value })} /></div>
            <div><Label>Statut</Label>
              <Select value={editForm.status ?? "actif"} onValueChange={v => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["actif","suspendu","parti"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label>Téléphone</Label><Input value={editForm.phone ?? ""} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={editForm.email ?? ""} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
            <div><Label>Type de contrat</Label>
              <Select value={editForm.contract_type ?? "CDI"} onValueChange={v => setEditForm({ ...editForm, contract_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["CDI","CDD","Stage","Vacataire"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label>Salaire de base</Label><Input type="number" value={editForm.base_salary ?? ""} onChange={e => setEditForm({ ...editForm, base_salary: e.target.value })} /></div>
            <div><Label>Début de contrat</Label><Input type="date" value={editForm.contract_start ?? ""} onChange={e => setEditForm({ ...editForm, contract_start: e.target.value })} /></div>
            <div><Label>Fin de contrat</Label><Input type="date" value={editForm.contract_end ?? ""} onChange={e => setEditForm({ ...editForm, contract_end: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Diplômes</Label><Textarea rows={2} value={editForm.diplomas ?? ""} onChange={e => setEditForm({ ...editForm, diplomas: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Notes</Label><Textarea rows={2} value={editForm.notes ?? ""} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button><Button onClick={saveEdit}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave dialog */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un congé/absence</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Type</Label>
              <Select value={leaveForm.type} onValueChange={v => setLeaveForm({ ...leaveForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEAVE_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Du</Label><Input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value })} /></div>
              <div><Label>Au</Label><Input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })} /></div>
            </div>
            <div><Label>Motif</Label><Textarea rows={2} value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} /></div>
            <div><Label>Statut</Label>
              <Select value={leaveForm.status} onValueChange={v => setLeaveForm({ ...leaveForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEAVE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setLeaveOpen(false)}>Annuler</Button><Button onClick={addLeave}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit payslip dialog */}
      <Dialog open={paySlipOpen} onOpenChange={setPaySlipOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editPayslipId ? "Modifier la fiche de paie" : "Générer une fiche de paie"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Mois</Label>
                <Select value={String(payForm.month)} onValueChange={v => setPayForm({ ...payForm, month: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS_FR.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label>Année</Label><Input type="number" value={payForm.year} onChange={e => setPayForm({ ...payForm, year: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Salaire de base</Label><Input type="number" value={payForm.base_salary} onChange={e => setPayForm({ ...payForm, base_salary: e.target.value })} /></div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Primes (bonuses)</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => addLine("primes")}><Plus className="mr-1 h-3 w-3" />Ajouter</Button>
              </div>
              {payForm.primes.length === 0 && <div className="text-xs text-muted-foreground">Aucune prime</div>}
              {payForm.primes.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder="Libellé (ex: Transport)" value={l.label} onChange={e => updateLine("primes", i, { label: e.target.value })} />
                  <Input type="number" placeholder="Montant" className="w-32" value={l.amount} onChange={e => updateLine("primes", i, { amount: e.target.value })} />
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeLine("primes", i)}><X className="h-4 w-4" /></Button>
                </div>
              ))}
              <div className="text-xs text-muted-foreground">Total primes : {fcfa(totalPrimes)}</div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Retenues (deductions)</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => addLine("retenues")}><Plus className="mr-1 h-3 w-3" />Ajouter</Button>
              </div>
              {payForm.retenues.length === 0 && <div className="text-xs text-muted-foreground">Aucune retenue</div>}
              {payForm.retenues.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder="Libellé (ex: Avance)" value={l.label} onChange={e => updateLine("retenues", i, { label: e.target.value })} />
                  <Input type="number" placeholder="Montant" className="w-32" value={l.amount} onChange={e => updateLine("retenues", i, { amount: e.target.value })} />
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeLine("retenues", i)}><X className="h-4 w-4" /></Button>
                </div>
              ))}
              <div className="text-xs text-muted-foreground">Total retenues : {fcfa(totalRetenues)}</div>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              Salaire net : <span className="font-semibold">{fcfa(computedNet)}</span>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPaySlipOpen(false)}>Annuler</Button><Button onClick={savePayslip}>{editPayslipId ? "Enregistrer" : "Créer"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark paid */}
      <Dialog open={!!payDialog} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marquer comme payé</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Net à payer : <span className="font-semibold text-foreground">{fcfa(Number(payDialog?.net_salary ?? 0))}</span>
            </div>
            <div><Label>Méthode de paiement</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="text-xs text-muted-foreground">
              Une dépense correspondante sera ajoutée automatiquement en Comptabilité (catégorie Salaires). La fiche sera ensuite verrouillée.
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPayDialog(null)}>Annuler</Button><Button onClick={markPaid}>Confirmer le paiement</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel payment */}
      <AlertDialog open={!!cancelDialog} onOpenChange={(o) => !o && setCancelDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler ce paiement de salaire ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action sera enregistrée dans l'historique et la dépense correspondante sera annulée en comptabilité. La fiche redeviendra modifiable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>Motif d'annulation (recommandé)</Label>
            <Textarea rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Ex: erreur de montant, paiement non effectué…" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-amber-600 hover:bg-amber-700">Confirmer l'annulation</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History dialog */}
      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Historique de la fiche</DialogTitle>
            <DialogDescription>{historyFor && <>{MONTHS_FR[historyFor.month-1]} {historyFor.year} — {fcfa(Number(historyFor.net_salary))}</>}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {historyFor && (historyByPayslip[historyFor.id] ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground">Aucun événement.</div>
            )}
            {historyFor && (historyByPayslip[historyFor.id] ?? []).map(h => (
              <div key={h.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="capitalize">{h.action}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(h.changed_at).toLocaleString("fr-FR")}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Par {actorName(h)}
                  {h.old_status && h.new_status && h.old_status !== h.new_status && <> · {h.old_status} → {h.new_status}</>}
                </div>
                {h.reason && <div className="mt-1 text-sm">Motif : {h.reason}</div>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Printable payslip */}
      {printSlip && (
        <div ref={printRef} className="payslip-print">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              {school?.logo_url && <img src={school.logo_url} alt="" className="h-14 w-14 object-contain" />}
              <div>
                <div className="text-lg font-bold">{school?.name ?? "École"}</div>
                <div className="text-xs text-muted-foreground">Fiche de paie</div>
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="font-semibold">{MONTHS_FR[printSlip.month-1]} {printSlip.year}</div>
              <div className="text-xs text-muted-foreground">Réf : PAIE-{printSlip.year}-{String(printSlip.month).padStart(2,"0")}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><div className="text-xs text-muted-foreground">Salarié</div>
              <div className="font-semibold">{staff.first_name} {staff.last_name}</div>
              <div>{staff.role_title}</div></div>
            <div><div className="text-xs text-muted-foreground">Contrat</div>
              <div>{staff.contract_type ?? "—"}</div>
              <div>Embauche : {staff.hire_date ?? "—"}</div></div>
          </div>
          <table className="mt-6 w-full text-sm">
            <thead><tr className="border-b"><th className="text-left py-2">Désignation</th><th className="text-right py-2">Montant (FCFA)</th></tr></thead>
            <tbody>
              <tr className="border-b"><td className="py-2">Salaire de base</td><td className="py-2 text-right">{fcfa(Number(printSlip.base_salary))}</td></tr>
              <tr className="border-b"><td className="py-2">Primes</td><td className="py-2 text-right">+ {fcfa(Number(printSlip.bonuses))}</td></tr>
              <tr className="border-b"><td className="py-2">Retenues</td><td className="py-2 text-right">- {fcfa(Number(printSlip.deductions))}</td></tr>
              <tr className="border-b-2 border-foreground"><td className="py-3 font-bold">Salaire net à payer</td><td className="py-3 text-right font-bold">{fcfa(Number(printSlip.net_salary))}</td></tr>
            </tbody>
          </table>
          <div className="mt-6 text-sm">
            <div>Statut : <span className="font-semibold capitalize">{printSlip.status}</span></div>
            {printSlip.payment_date && <div>Payé le {printSlip.payment_date} ({printSlip.payment_method})</div>}
          </div>
          <div className="mt-12 grid grid-cols-2 gap-8 text-xs text-muted-foreground">
            <div className="border-t pt-2">Signature employeur</div>
            <div className="border-t pt-2">Signature salarié</div>
          </div>
        </div>
      )}
      <style>{`
        .payslip-print { display: none; }
        @media print {
          body * { visibility: hidden; }
          .payslip-print, .payslip-print * { visibility: visible; }
          .payslip-print { display: block; position: absolute; top: 0; left: 0; right: 0; padding: 40px; background: white; color: black; }
        }
      `}</style>
    </AppLayout>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div><div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value && String(value).length > 0 ? value : "—"}</div></div>
  );
}
