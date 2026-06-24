import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Bus, User, FileText, Wallet, AlertTriangle, Route as RouteIcon, Users, ArrowUp, ArrowDown, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useDB, updateDB, getDB } from "@/lib/store";
import { deriveInvoiceStatus, type Payment } from "@/lib/types";

export const Route = createFileRoute("/transport")({ component: TransportPage });

// ----- Part 2 types -----
interface TRoute {
  id: string; school_id: string; name: string; description: string | null;
  assigned_vehicle_id: string | null; assigned_driver_id: string | null;
  fee_amount: number; notes: string | null;
}
interface RouteStop {
  id: string; school_id: string; route_id: string;
  stop_name: string; order_index: number; pickup_time: string | null;
}
type Direction = "aller" | "retour" | "les_deux";
interface StudentTransport {
  id: string; school_id: string; student_id: string; route_id: string;
  stop_id: string | null; direction: Direction; fee_amount: number; active: boolean;
}
const DIRECTION_LABEL: Record<Direction, string> = { aller: "Aller", retour: "Retour", les_deux: "Aller-retour" };

function nextTransportInvoiceNumber(): string {
  const prefix = "FAC-2026-";
  const max = getDB().payments.reduce((m, p) => {
    const n = parseInt(p.invoiceNumber?.slice(prefix.length) || "0", 10);
    return n > m ? n : m;
  }, 0);
  return `${prefix}${(max + 1).toString().padStart(3, "0")}`;
}

// ----- types -----
type VehicleStatus = "en_service" | "en_panne" | "maintenance";
interface Vehicle {
  id: string; school_id: string;
  registration_number: string; bus_number: string | null;
  brand: string | null; model: string | null;
  capacity: number | null; year: number | null;
  status: VehicleStatus;
  photo_url: string | null; notes: string | null;
}
interface Driver {
  id: string; school_id: string;
  name: string; phone: string | null;
  license_number: string | null; license_expiry: string | null;
  assigned_vehicle_id: string | null; notes: string | null;
}
type DocType = "assurance" | "visite_technique" | "vignette" | "autre";
interface VDoc {
  id: string; school_id: string; vehicle_id: string;
  doc_type: DocType; provider: string | null;
  start_date: string | null; expiry_date: string | null;
  amount: number | null; notes: string | null;
}
interface Supplier { id: string; school_id: string; name: string; type: string | null; }
interface Tx {
  id: string; school_id: string; type: "recette" | "depense";
  category: string; amount: number; description: string | null;
  date: string; payment_method: string | null; reference: string | null;
  supplier_id: string | null; vehicle_id: string | null;
}

const STATUS_LABEL: Record<VehicleStatus, string> = {
  en_service: "En service", en_panne: "En panne", maintenance: "Maintenance",
};
const STATUS_VARIANT: Record<VehicleStatus, "default" | "destructive" | "secondary"> = {
  en_service: "default", en_panne: "destructive", maintenance: "secondary",
};
const DOC_LABEL: Record<DocType, string> = {
  assurance: "Assurance", visite_technique: "Visite technique", vignette: "Vignette", autre: "Autre",
};
const EXPENSE_CATEGORIES = ["Carburant", "Réparation", "Entretien", "Assurance", "Visite technique", "Pièces", "Autre"] as const;
const PAYMENT_METHODS = ["Espèces", "MTN Mobile Money", "Orange Money", "Virement bancaire", "Chèque"] as const;

function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const a = new Date(iso); a.setHours(0,0,0,0);
  const b = new Date(); b.setHours(0,0,0,0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
function expiryBadge(iso: string | null | undefined) {
  const d = daysUntil(iso);
  if (d === null) return null;
  if (d < 0) return <Badge variant="destructive">Expiré ({Math.abs(d)} j)</Badge>;
  if (d <= 30) return <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400">Expire dans {d} j</Badge>;
  return <Badge variant="outline">{d} j restants</Badge>;
}

function TransportPage() {
  const { user } = useAuth();
  const schoolId = user?.schoolId;
  const isAdmin = user?.role === "school_admin" || user?.role === "super_admin";

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [docs, setDocs] = useState<VDoc[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expenses, setExpenses] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const [v, d, doc, sup, tx] = await Promise.all([
      supabase.from("vehicles").select("*").eq("school_id", schoolId).order("registration_number"),
      supabase.from("drivers").select("*").eq("school_id", schoolId).order("name"),
      supabase.from("vehicle_documents").select("*").eq("school_id", schoolId).order("expiry_date"),
      supabase.from("suppliers").select("id,school_id,name,type").eq("school_id", schoolId).order("name"),
      supabase.from("transactions").select("*").eq("school_id", schoolId).eq("type","depense").not("vehicle_id","is",null).order("date",{ascending:false}),
    ]);
    if (v.error || d.error || doc.error || tx.error) toast.error("Erreur de chargement Transport");
    setVehicles(((v.data ?? []) as unknown) as Vehicle[]);
    setDrivers(((d.data ?? []) as unknown) as Driver[]);
    setDocs(((doc.data ?? []) as unknown) as VDoc[]);
    setSuppliers(((sup.data ?? []) as unknown) as Supplier[]);
    setExpenses(((tx.data ?? []) as unknown) as Tx[]);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // alerts
  const alerts = useMemo(() => {
    const items: { kind: string; label: string; days: number; severity: "expired" | "soon" }[] = [];
    docs.forEach((d) => {
      const dd = daysUntil(d.expiry_date);
      if (dd === null) return;
      const v = vehicles.find((x) => x.id === d.vehicle_id);
      const vname = v ? (v.bus_number || v.registration_number) : "Véhicule";
      if (dd < 0) items.push({ kind: "doc", label: `${DOC_LABEL[d.doc_type]} du ${vname} expirée`, days: dd, severity: "expired" });
      else if (dd <= 30) items.push({ kind: "doc", label: `${DOC_LABEL[d.doc_type]} du ${vname} expire dans ${dd} j`, days: dd, severity: "soon" });
    });
    drivers.forEach((dr) => {
      const dd = daysUntil(dr.license_expiry);
      if (dd === null) return;
      if (dd < 0) items.push({ kind: "permis", label: `Permis de ${dr.name} expiré`, days: dd, severity: "expired" });
      else if (dd <= 30) items.push({ kind: "permis", label: `Permis de ${dr.name} expire dans ${dd} j`, days: dd, severity: "soon" });
    });
    return items.sort((a,b)=>a.days - b.days);
  }, [docs, drivers, vehicles]);

  const monthTotal = useMemo(() => {
    const m = todayISO().slice(0,7);
    return expenses.filter((e)=>e.date.startsWith(m)).reduce((s,e)=>s+Number(e.amount||0),0);
  }, [expenses]);
  const allTotal = useMemo(() => expenses.reduce((s,e)=>s+Number(e.amount||0),0), [expenses]);

  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/dashboard" />;

  return (
    <AppLayout title="Transport">
      <div className="space-y-6">
        {/* Dashboard cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard icon={<Bus className="h-5 w-5" />} label="Bus" value={`${vehicles.length}`} hint={`${vehicles.filter(v=>v.status==="en_service").length} en service`} />
          <StatCard icon={<User className="h-5 w-5" />} label="Chauffeurs" value={`${drivers.length}`} />
          <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="Alertes" value={`${alerts.length}`} hint={`${alerts.filter(a=>a.severity==="expired").length} expirés`} />
          <StatCard icon={<Wallet className="h-5 w-5" />} label="Dépenses (mois)" value={fcfa(monthTotal)} hint={`Total: ${fcfa(allTotal)}`} />
        </div>

        {alerts.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Alertes échéances</h3>
              <ul className="text-sm space-y-1">
                {alerts.slice(0,8).map((a, i) => (
                  <li key={i} className={a.severity === "expired" ? "text-destructive" : "text-amber-700 dark:text-amber-400"}>• {a.label}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="vehicles">
          <TabsList>
            <TabsTrigger value="vehicles">Bus</TabsTrigger>
            <TabsTrigger value="drivers">Chauffeurs</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="expenses">Dépenses</TabsTrigger>
          </TabsList>

          <TabsContent value="vehicles" className="mt-4">
            <VehiclesTab schoolId={schoolId!} vehicles={vehicles} reload={fetchAll} loading={loading} expenses={expenses} />
          </TabsContent>
          <TabsContent value="drivers" className="mt-4">
            <DriversTab schoolId={schoolId!} drivers={drivers} vehicles={vehicles} reload={fetchAll} />
          </TabsContent>
          <TabsContent value="documents" className="mt-4">
            <DocumentsTab schoolId={schoolId!} docs={docs} vehicles={vehicles} reload={fetchAll} />
          </TabsContent>
          <TabsContent value="expenses" className="mt-4">
            <ExpensesTab schoolId={schoolId!} expenses={expenses} vehicles={vehicles} suppliers={suppliers} reload={fetchAll} userId={user.id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
      </div>
    </CardContent></Card>
  );
}

// ---------------- VEHICLES ----------------
function VehiclesTab({ schoolId, vehicles, reload, loading, expenses }: { schoolId: string; vehicles: Vehicle[]; reload: () => void; loading: boolean; expenses: Tx[] }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Vehicle | null>(null);
  const [del, setDel] = useState<Vehicle | null>(null);
  const [saving, setSaving] = useState(false);
  const empty = { registration_number: "", bus_number: "", brand: "", model: "", capacity: "", year: "", status: "en_service" as VehicleStatus, photo_url: "", notes: "" };
  const [form, setForm] = useState(empty);

  function openNew() { setEdit(null); setForm(empty); setOpen(true); }
  function openEdit(v: Vehicle) {
    setEdit(v);
    setForm({
      registration_number: v.registration_number, bus_number: v.bus_number ?? "",
      brand: v.brand ?? "", model: v.model ?? "",
      capacity: v.capacity?.toString() ?? "", year: v.year?.toString() ?? "",
      status: v.status, photo_url: v.photo_url ?? "", notes: v.notes ?? "",
    });
    setOpen(true);
  }
  async function save() {
    if (saving) return;
    if (!form.registration_number.trim()) { toast.error("Immatriculation requise"); return; }
    setSaving(true);
    const payload = {
      school_id: schoolId,
      registration_number: form.registration_number.trim(),
      bus_number: form.bus_number || null,
      brand: form.brand || null, model: form.model || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      year: form.year ? Number(form.year) : null,
      status: form.status,
      photo_url: form.photo_url || null,
      notes: form.notes || null,
    };
    const res = edit
      ? await supabase.from("vehicles").update(payload).eq("id", edit.id)
      : await supabase.from("vehicles").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(edit ? "Véhicule mis à jour" : "Véhicule ajouté");
    setOpen(false); reload();
  }
  async function doDelete() {
    if (!del) return;
    const { error } = await supabase.from("vehicles").delete().eq("id", del.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Véhicule supprimé"); setDel(null); reload();
  }

  const totalByVehicle = (id: string) => expenses.filter(e=>e.vehicle_id===id).reduce((s,e)=>s+Number(e.amount||0),0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nouveau bus</Button></div>
      {loading ? <p className="text-muted-foreground text-sm">Chargement…</p> :
        vehicles.length === 0 ? <Card><CardContent className="p-6 text-center text-muted-foreground">Aucun bus enregistré</CardContent></Card> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((v) => (
            <Card key={v.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Bus className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">{v.bus_number || v.registration_number}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">{v.registration_number}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[v.status]}>{STATUS_LABEL[v.status]}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {[v.brand, v.model].filter(Boolean).join(" ")} {v.year ? `(${v.year})` : ""}
                </div>
                <div className="text-sm">Capacité : {v.capacity ?? "—"} places</div>
                <div className="text-sm font-medium">Total dépenses : {fcfa(totalByVehicle(v.id))}</div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={()=>openEdit(v)}><Pencil className="h-3 w-3 mr-1" />Modifier</Button>
                  <Button size="sm" variant="ghost" onClick={()=>setDel(v)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit ? "Modifier le bus" : "Nouveau bus"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Immatriculation *</Label><Input value={form.registration_number} onChange={(e)=>setForm({...form, registration_number:e.target.value})} /></div>
            <div><Label>N° bus</Label><Input value={form.bus_number} onChange={(e)=>setForm({...form, bus_number:e.target.value})} /></div>
            <div><Label>Statut</Label>
              <Select value={form.status} onValueChange={(v)=>setForm({...form, status: v as VehicleStatus})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(STATUS_LABEL) as VehicleStatus[]).map(s=><SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Marque</Label><Input value={form.brand} onChange={(e)=>setForm({...form, brand:e.target.value})} /></div>
            <div><Label>Modèle</Label><Input value={form.model} onChange={(e)=>setForm({...form, model:e.target.value})} /></div>
            <div><Label>Capacité (places)</Label><Input type="number" value={form.capacity} onChange={(e)=>setForm({...form, capacity:e.target.value})} /></div>
            <div><Label>Année</Label><Input type="number" value={form.year} onChange={(e)=>setForm({...form, year:e.target.value})} /></div>
            <div className="col-span-2"><Label>Photo (URL)</Label><Input value={form.photo_url} onChange={(e)=>setForm({...form, photo_url:e.target.value})} /></div>
            <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e)=>setForm({...form, notes:e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o)=>!o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Supprimer ce bus ?</AlertDialogTitle>
            <AlertDialogDescription>Les documents associés seront aussi supprimés. Les dépenses liées resteront en Comptabilité (sans lien véhicule).</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={doDelete}>Supprimer</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------- DRIVERS ----------------
function DriversTab({ schoolId, drivers, vehicles, reload }: { schoolId: string; drivers: Driver[]; vehicles: Vehicle[]; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Driver | null>(null);
  const [del, setDel] = useState<Driver | null>(null);
  const [saving, setSaving] = useState(false);
  const empty = { name: "", phone: "", license_number: "", license_expiry: "", assigned_vehicle_id: "", notes: "" };
  const [form, setForm] = useState(empty);

  function openNew() { setEdit(null); setForm(empty); setOpen(true); }
  function openEdit(d: Driver) {
    setEdit(d);
    setForm({
      name: d.name, phone: d.phone ?? "",
      license_number: d.license_number ?? "", license_expiry: d.license_expiry ?? "",
      assigned_vehicle_id: d.assigned_vehicle_id ?? "", notes: d.notes ?? "",
    });
    setOpen(true);
  }
  async function save() {
    if (saving) return;
    if (!form.name.trim()) { toast.error("Nom requis"); return; }
    setSaving(true);
    const payload = {
      school_id: schoolId, name: form.name.trim(),
      phone: form.phone || null,
      license_number: form.license_number || null,
      license_expiry: form.license_expiry || null,
      assigned_vehicle_id: form.assigned_vehicle_id || null,
      notes: form.notes || null,
    };
    const res = edit
      ? await supabase.from("drivers").update(payload).eq("id", edit.id)
      : await supabase.from("drivers").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(edit ? "Chauffeur mis à jour" : "Chauffeur ajouté");
    setOpen(false); reload();
  }
  async function doDelete() {
    if (!del) return;
    const { error } = await supabase.from("drivers").delete().eq("id", del.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Chauffeur supprimé"); setDel(null); reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nouveau chauffeur</Button></div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nom</TableHead><TableHead>Téléphone</TableHead>
            <TableHead>N° permis</TableHead><TableHead>Expiration permis</TableHead>
            <TableHead>Bus assigné</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {drivers.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun chauffeur</TableCell></TableRow> :
            drivers.map((d) => {
              const v = vehicles.find((x) => x.id === d.assigned_vehicle_id);
              return (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>{d.phone || "—"}</TableCell>
                  <TableCell>{d.license_number || "—"}</TableCell>
                  <TableCell className="space-x-2">
                    <span>{d.license_expiry || "—"}</span>
                    {expiryBadge(d.license_expiry)}
                  </TableCell>
                  <TableCell>{v ? (v.bus_number || v.registration_number) : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={()=>openEdit(d)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={()=>setDel(d)}><Trash2 className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Modifier le chauffeur" : "Nouveau chauffeur"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nom *</Label><Input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} /></div>
            <div><Label>Téléphone</Label><Input value={form.phone} onChange={(e)=>setForm({...form, phone:e.target.value})} /></div>
            <div><Label>N° permis</Label><Input value={form.license_number} onChange={(e)=>setForm({...form, license_number:e.target.value})} /></div>
            <div><Label>Expiration permis</Label><Input type="date" value={form.license_expiry} onChange={(e)=>setForm({...form, license_expiry:e.target.value})} /></div>
            <div><Label>Bus assigné</Label>
              <Select value={form.assigned_vehicle_id || "none"} onValueChange={(v)=>setForm({...form, assigned_vehicle_id: v==="none" ? "" : v})}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {vehicles.map(v=><SelectItem key={v.id} value={v.id}>{v.bus_number || v.registration_number}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e)=>setForm({...form, notes:e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving}>{saving ? "…" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o)=>!o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Supprimer ce chauffeur ?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={doDelete}>Supprimer</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------- DOCUMENTS ----------------
function DocumentsTab({ schoolId, docs, vehicles, reload }: { schoolId: string; docs: VDoc[]; vehicles: Vehicle[]; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<VDoc | null>(null);
  const [del, setDel] = useState<VDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const empty = { vehicle_id: "", doc_type: "assurance" as DocType, provider: "", start_date: "", expiry_date: "", amount: "", notes: "" };
  const [form, setForm] = useState(empty);

  function openNew() { setEdit(null); setForm(empty); setOpen(true); }
  function openEdit(d: VDoc) {
    setEdit(d);
    setForm({
      vehicle_id: d.vehicle_id, doc_type: d.doc_type,
      provider: d.provider ?? "", start_date: d.start_date ?? "",
      expiry_date: d.expiry_date ?? "", amount: d.amount?.toString() ?? "",
      notes: d.notes ?? "",
    });
    setOpen(true);
  }
  async function save() {
    if (saving) return;
    if (!form.vehicle_id) { toast.error("Bus requis"); return; }
    setSaving(true);
    const payload = {
      school_id: schoolId, vehicle_id: form.vehicle_id,
      doc_type: form.doc_type, provider: form.provider || null,
      start_date: form.start_date || null, expiry_date: form.expiry_date || null,
      amount: form.amount ? Number(form.amount) : null,
      notes: form.notes || null,
    };
    const res = edit
      ? await supabase.from("vehicle_documents").update(payload).eq("id", edit.id)
      : await supabase.from("vehicle_documents").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(edit ? "Document mis à jour" : "Document ajouté");
    setOpen(false); reload();
  }
  async function doDelete() {
    if (!del) return;
    const { error } = await supabase.from("vehicle_documents").delete().eq("id", del.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Document supprimé"); setDel(null); reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nouveau document</Button></div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Bus</TableHead><TableHead>Type</TableHead>
            <TableHead>Fournisseur</TableHead><TableHead>Début</TableHead>
            <TableHead>Expiration</TableHead><TableHead>Montant</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {docs.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun document</TableCell></TableRow> :
            docs.map((d) => {
              const v = vehicles.find((x) => x.id === d.vehicle_id);
              return (
                <TableRow key={d.id}>
                  <TableCell>{v ? (v.bus_number || v.registration_number) : "—"}</TableCell>
                  <TableCell>{DOC_LABEL[d.doc_type]}</TableCell>
                  <TableCell>{d.provider || "—"}</TableCell>
                  <TableCell>{d.start_date || "—"}</TableCell>
                  <TableCell className="space-x-2">
                    <span>{d.expiry_date || "—"}</span>
                    {expiryBadge(d.expiry_date)}
                  </TableCell>
                  <TableCell>{d.amount != null ? fcfa(Number(d.amount)) : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={()=>openEdit(d)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={()=>setDel(d)}><Trash2 className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Modifier le document" : "Nouveau document"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Bus *</Label>
              <Select value={form.vehicle_id} onValueChange={(v)=>setForm({...form, vehicle_id:v})}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{vehicles.map(v=><SelectItem key={v.id} value={v.id}>{v.bus_number || v.registration_number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Type</Label>
              <Select value={form.doc_type} onValueChange={(v)=>setForm({...form, doc_type: v as DocType})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(DOC_LABEL) as DocType[]).map(t=><SelectItem key={t} value={t}>{DOC_LABEL[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Fournisseur / compagnie</Label><Input value={form.provider} onChange={(e)=>setForm({...form, provider:e.target.value})} /></div>
            <div><Label>Date début</Label><Input type="date" value={form.start_date} onChange={(e)=>setForm({...form, start_date:e.target.value})} /></div>
            <div><Label>Date expiration</Label><Input type="date" value={form.expiry_date} onChange={(e)=>setForm({...form, expiry_date:e.target.value})} /></div>
            <div><Label>Montant (FCFA)</Label><Input type="number" value={form.amount} onChange={(e)=>setForm({...form, amount:e.target.value})} /></div>
            <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e)=>setForm({...form, notes:e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving}>{saving ? "…" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o)=>!o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={doDelete}>Supprimer</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------- EXPENSES ----------------
function ExpensesTab({ schoolId, expenses, vehicles, suppliers, reload, userId }: { schoolId: string; expenses: Tx[]; vehicles: Vehicle[]; suppliers: Supplier[]; reload: () => void; userId: string }) {
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Tx | null>(null);
  const [saving, setSaving] = useState(false);
  const empty = { vehicle_id: "", category: "Carburant", amount: "", date: todayISO(), payment_method: "Espèces", supplier_id: "", description: "", reference: "" };
  const [form, setForm] = useState(empty);

  function openNew() { setForm(empty); setOpen(true); }
  async function save() {
    if (saving) return;
    if (!form.vehicle_id) { toast.error("Bus requis"); return; }
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { toast.error("Montant invalide"); return; }
    setSaving(true);
    // Writes directly into Comptabilité (transactions) -> single source of truth
    const { error } = await supabase.from("transactions").insert({
      school_id: schoolId,
      type: "depense",
      category: "Transport",
      amount: amt,
      description: `${form.category}${form.description ? " — " + form.description : ""}`,
      date: form.date,
      payment_method: form.payment_method,
      reference: form.reference || null,
      supplier_id: form.supplier_id || null,
      vehicle_id: form.vehicle_id,
      recorded_by: userId,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Dépense enregistrée");
    setOpen(false); reload();
  }
  async function doDelete() {
    if (!del) return;
    const { error } = await supabase.from("transactions").delete().eq("id", del.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Dépense supprimée"); setDel(null); reload();
  }

  // breakdown per vehicle
  const breakdown = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    expenses.forEach((e) => {
      if (!e.vehicle_id) return;
      const cat = (e.description || "Autre").split(" — ")[0] || "Autre";
      if (!map.has(e.vehicle_id)) map.set(e.vehicle_id, new Map());
      const m = map.get(e.vehicle_id)!;
      m.set(cat, (m.get(cat) || 0) + Number(e.amount || 0));
    });
    return map;
  }, [expenses]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nouvelle dépense</Button></div>

      {vehicles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((v) => {
            const m = breakdown.get(v.id);
            const total = m ? Array.from(m.values()).reduce((s,x)=>s+x, 0) : 0;
            return (
              <Card key={v.id}><CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{v.bus_number || v.registration_number}</h4>
                  <span className="font-semibold">{fcfa(total)}</span>
                </div>
                {m && m.size > 0 ? (
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    {Array.from(m.entries()).map(([k, val]) => (
                      <li key={k} className="flex justify-between"><span>{k}</span><span>{fcfa(val)}</span></li>
                    ))}
                  </ul>
                ) : <p className="text-xs text-muted-foreground">Aucune dépense</p>}
              </CardContent></Card>
            );
          })}
        </div>
      )}

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Bus</TableHead>
            <TableHead>Catégorie</TableHead><TableHead>Bénéficiaire</TableHead>
            <TableHead>Mode</TableHead><TableHead className="text-right">Montant</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {expenses.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucune dépense</TableCell></TableRow> :
            expenses.map((e) => {
              const v = vehicles.find((x) => x.id === e.vehicle_id);
              const s = suppliers.find((x) => x.id === e.supplier_id);
              const cat = (e.description || "").split(" — ")[0] || "—";
              return (
                <TableRow key={e.id}>
                  <TableCell>{e.date}</TableCell>
                  <TableCell>{v ? (v.bus_number || v.registration_number) : "—"}</TableCell>
                  <TableCell>{cat}</TableCell>
                  <TableCell>{s?.name || "—"}</TableCell>
                  <TableCell>{e.payment_method || "—"}</TableCell>
                  <TableCell className="text-right">{fcfa(Number(e.amount))}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={()=>setDel(e)}><Trash2 className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle dépense Transport</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Enregistrée comme dépense Transport en Comptabilité (comptée une seule fois).</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Bus *</Label>
              <Select value={form.vehicle_id} onValueChange={(v)=>setForm({...form, vehicle_id:v})}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{vehicles.map(v=><SelectItem key={v.id} value={v.id}>{v.bus_number || v.registration_number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Catégorie</Label>
              <Select value={form.category} onValueChange={(v)=>setForm({...form, category:v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_CATEGORIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Montant *</Label><Input type="number" value={form.amount} onChange={(e)=>setForm({...form, amount:e.target.value})} /></div>
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e)=>setForm({...form, date:e.target.value})} /></div>
            <div><Label>Mode paiement</Label>
              <Select value={form.payment_method} onValueChange={(v)=>setForm({...form, payment_method:v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map(m=><SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Bénéficiaire</Label>
              <Select value={form.supplier_id || "none"} onValueChange={(v)=>setForm({...form, supplier_id: v==="none" ? "" : v})}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {suppliers.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Référence</Label><Input value={form.reference} onChange={(e)=>setForm({...form, reference:e.target.value})} /></div>
            <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e)=>setForm({...form, description:e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving}>{saving ? "…" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o)=>!o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Supprimer cette dépense ?</AlertDialogTitle>
            <AlertDialogDescription>Elle sera également retirée de la Comptabilité.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={doDelete}>Supprimer</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
