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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Printer, Check, X, Trash2 } from "lucide-react";
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
  payment_date: string | null; payment_method: string | null; status: string; }
interface School { name: string; logo_url: string | null; }

function StaffDetailPage() {
  const { staffId } = useParams({ from: "/personnel/$staffId" });
  const { user } = useAuth();
  const { hasFeature, loading: planLoading } = usePlan();
  const isAdmin = user?.role === "school_admin" || user?.role === "super_admin";

  const [staff, setStaff] = useState<Staff | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
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
    setPayslips((p.data ?? []) as Payslip[]);
    if (s.data?.school_id) {
      const { data: sch } = await sb.from("schools").select("name,logo_url").eq("id", s.data.school_id).maybeSingle();
      setSchool(sch ?? null);
    }
    setLoading(false);
  }, [staffId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Edit staff form
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
  const [paySlipOpen, setPaySlipOpen] = useState(false);
  const [payForm, setPayForm] = useState<any>({ month: now.getMonth()+1, year: now.getFullYear(), base_salary: "", bonuses: "0", deductions: "0" });
  const openCreatePayslip = () => {
    setPayForm({ month: now.getMonth()+1, year: now.getFullYear(),
      base_salary: String(staff?.base_salary ?? ""), bonuses: "0", deductions: "0" });
    setPaySlipOpen(true);
  };
  const computedNet = useMemo(() => (Number(payForm.base_salary)||0) + (Number(payForm.bonuses)||0) - (Number(payForm.deductions)||0), [payForm]);
  const createPayslip = async () => {
    if (!staff) return;
    const payload = {
      school_id: staff.school_id, staff_id: staff.id,
      month: Number(payForm.month), year: Number(payForm.year),
      base_salary: Number(payForm.base_salary)||0,
      bonuses: Number(payForm.bonuses)||0,
      deductions: Number(payForm.deductions)||0,
      net_salary: computedNet, status: "en attente",
    };
    const { error } = await sb.from("payroll").insert(payload);
    if (error) { toast.error(error.message.includes("duplicate") ? "Fiche déjà existante pour ce mois" : error.message); return; }
    toast.success("Fiche de paie créée"); setPaySlipOpen(false); fetchAll();
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
    // Create accounting transaction
    const { data: tx, error: txErr } = await sb.from("transactions").insert({
      school_id: staff.school_id, type: "depense", category: "Salaires",
      amount: Number(payDialog.net_salary || 0), date: today,
      payment_method: payMethod,
      description: `Salaire ${MONTHS_FR[payDialog.month-1]} ${payDialog.year} — ${staff.first_name} ${staff.last_name}`,
      reference: `PAIE-${payDialog.year}-${String(payDialog.month).padStart(2,"0")}-${staff.last_name.toUpperCase()}`,
    }).select("id").maybeSingle();
    if (!txErr && tx?.id) await sb.from("payroll").update({ transaction_id: tx.id }).eq("id", payDialog.id);
    toast.success("Paiement enregistré (dépense ajoutée en comptabilité)");
    setPayDialog(null); fetchAll();
  };

  const deletePayslip = async (id: string) => {
    const { error } = await sb.from("payroll").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Fiche supprimée"); fetchAll(); }
  };

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
  if (user?.role !== "super_admin" && !hasFeature("accounting")) {
    return <AppLayout title="Personnel"><LockedFeatureOverlay requiredPlan={requiredPlanFor("accounting")} featureLabel="Personnel" /></AppLayout>;
  }
  if (!staff) return <AppLayout title="Personnel"><div className="p-8 text-muted-foreground">Membre introuvable.</div></AppLayout>;

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
                <TableHead>Net</TableHead><TableHead>Statut</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {payslips.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Aucune fiche de paie</TableCell></TableRow>
                : payslips.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{MONTHS_FR[p.month-1]} {p.year}</TableCell>
                    <TableCell>{fcfa(Number(p.base_salary))}</TableCell>
                    <TableCell>{fcfa(Number(p.bonuses))}</TableCell>
                    <TableCell>{fcfa(Number(p.deductions))}</TableCell>
                    <TableCell className="font-semibold">{fcfa(Number(p.net_salary))}</TableCell>
                    <TableCell><Badge variant="outline" className={p.status === "payé" ? "border-green-500/30 bg-green-500/10 text-green-700" : ""}>{p.status}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => triggerPrint(p)} title="Imprimer"><Printer className="h-4 w-4" /></Button>
                      {p.status !== "payé" && <Button size="sm" variant="outline" onClick={() => { setPayDialog(p); setPayMethod("Espèces"); }}>Marquer payé</Button>}
                      <Button size="icon" variant="ghost" onClick={() => deletePayslip(p.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
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

      {/* Create payslip dialog */}
      <Dialog open={paySlipOpen} onOpenChange={setPaySlipOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Générer une fiche de paie</DialogTitle></DialogHeader>
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
            <div><Label>Primes</Label><Input type="number" value={payForm.bonuses} onChange={e => setPayForm({ ...payForm, bonuses: e.target.value })} /></div>
            <div><Label>Retenues</Label><Input type="number" value={payForm.deductions} onChange={e => setPayForm({ ...payForm, deductions: e.target.value })} /></div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              Salaire net : <span className="font-semibold">{fcfa(computedNet)}</span>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPaySlipOpen(false)}>Annuler</Button><Button onClick={createPayslip}>Créer</Button></DialogFooter>
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
              Une dépense correspondante sera ajoutée automatiquement en Comptabilité (catégorie Salaires).
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPayDialog(null)}>Annuler</Button><Button onClick={markPaid}>Confirmer le paiement</Button></DialogFooter>
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
