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
import { EmptySelectHint } from "@/components/QuickCreate";
import { useTranslation } from "react-i18next";
import { TableEmpty, EmptyStateBlock, ListSkeleton } from "@/components/states";
import { useDB, updateDB, getDB } from "@/lib/store";
import { deriveInvoiceStatus, type Payment } from "@/lib/types";
import { usePlan } from "@/lib/usePlan";
import { LockedFeatureOverlay } from "@/components/UpgradePrompt";
import { requiredPlanFor } from "@/lib/plans";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";

const TRANSPORT_REALTIME_TABLES = [
  "vehicles", "drivers", "vehicle_documents",
  "transport_routes", "route_stops", "student_transport",
  "transactions", "suppliers",
] as const;

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
function expiryBadge(iso: string | null | undefined, t: (k: string, o?: Record<string, unknown>) => string) {
  const d = daysUntil(iso);
  if (d === null) return null;
  if (d < 0) return <Badge variant="destructive">{t("transport.expiry.expired", { days: Math.abs(d) })}</Badge>;
  if (d <= 30) return <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400">{t("transport.expiry.expiringIn", { days: d })}</Badge>;
  return <Badge variant="outline">{t("transport.expiry.remaining", { days: d })}</Badge>;
}

function TransportPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { hasFeature, loading: planLoading } = usePlan();
  const schoolId = user?.schoolId;
  const isAdmin = user?.role === "school_admin" || user?.role === "super_admin";
  const isSecretary = user?.role === "secretary";
  const canAccess = isAdmin || isSecretary;

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [docs, setDocs] = useState<VDoc[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expenses, setExpenses] = useState<Tx[]>([]);
  const [routes, setRoutes] = useState<TRoute[]>([]);
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [assignments, setAssignments] = useState<StudentTransport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const [v, d, doc, sup, tx, rt, st, sa] = await Promise.all([
      supabase.from("vehicles").select("*").eq("school_id", schoolId).order("registration_number"),
      supabase.from("drivers").select("*").eq("school_id", schoolId).order("name"),
      supabase.from("vehicle_documents").select("*").eq("school_id", schoolId).order("expiry_date"),
      supabase.from("suppliers").select("id,school_id,name,type").eq("school_id", schoolId).order("name"),
      supabase.from("transactions").select("*").eq("school_id", schoolId).eq("type","depense").not("vehicle_id","is",null).order("date",{ascending:false}),
      supabase.from("transport_routes").select("*").eq("school_id", schoolId).order("name"),
      supabase.from("route_stops").select("*").eq("school_id", schoolId).order("order_index"),
      supabase.from("student_transport").select("*").eq("school_id", schoolId),
    ]);
    if (v.error || d.error || doc.error || tx.error || rt.error || st.error || sa.error) toast.error("Erreur de chargement Transport");
    setVehicles(((v.data ?? []) as unknown) as Vehicle[]);
    setDrivers(((d.data ?? []) as unknown) as Driver[]);
    setDocs(((doc.data ?? []) as unknown) as VDoc[]);
    setSuppliers(((sup.data ?? []) as unknown) as Supplier[]);
    setExpenses(((tx.data ?? []) as unknown) as Tx[]);
    setRoutes(((rt.data ?? []) as unknown) as TRoute[]);
    setStops(((st.data ?? []) as unknown) as RouteStop[]);
    setAssignments(((sa.data ?? []) as unknown) as StudentTransport[]);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useRealtimeRefresh(schoolId, TRANSPORT_REALTIME_TABLES, fetchAll);

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
  const activeAssignments = useMemo(() => assignments.filter((a)=>a.active), [assignments]);

  if (!user) return <Navigate to="/login" />;
  if (!canAccess) return <Navigate to="/dashboard" />;

  if (!planLoading && user?.role !== "super_admin" && !hasFeature("transport")) {
    return (
      <AppLayout title="Transport">
        <LockedFeatureOverlay
          requiredPlan={requiredPlanFor("transport")}
          featureLabel="Le module Transport"
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Transport">
      <div className="space-y-6">
        {/* Dashboard cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard icon={<Bus className="h-5 w-5" />} label="Bus" value={`${vehicles.length}`} hint={`${vehicles.filter(v=>v.status==="en_service").length} en service`} />
          <StatCard icon={<User className="h-5 w-5" />} label="Chauffeurs" value={`${drivers.length}`} />
          <StatCard icon={<RouteIcon className="h-5 w-5" />} label="Circuits" value={`${routes.length}`} />
          <StatCard icon={<Users className="h-5 w-5" />} label="Élèves transportés" value={`${activeAssignments.length}`} />
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

        <Tabs defaultValue={isSecretary ? "students" : "vehicles"}>
          <TabsList>
            {isAdmin && <TabsTrigger value="vehicles">Bus</TabsTrigger>}
            {isAdmin && <TabsTrigger value="drivers">Chauffeurs</TabsTrigger>}
            {isAdmin && <TabsTrigger value="routes">Circuits</TabsTrigger>}
            <TabsTrigger value="students">Élèves transportés</TabsTrigger>
            {isAdmin && <TabsTrigger value="documents">Documents</TabsTrigger>}
            {isAdmin && <TabsTrigger value="expenses">Dépenses</TabsTrigger>}
          </TabsList>

          {isAdmin && (
            <TabsContent value="vehicles" className="mt-4">
              <VehiclesTab schoolId={schoolId!} vehicles={vehicles} reload={fetchAll} loading={loading} expenses={expenses} />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="drivers" className="mt-4">
              <DriversTab schoolId={schoolId!} drivers={drivers} vehicles={vehicles} reload={fetchAll} />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="routes" className="mt-4">
              <RoutesTab schoolId={schoolId!} routes={routes} stops={stops} assignments={assignments} vehicles={vehicles} drivers={drivers} reload={fetchAll} />
            </TabsContent>
          )}
          <TabsContent value="students" className="mt-4">
            <TransportedStudentsTab schoolId={schoolId!} routes={routes} stops={stops} assignments={assignments} vehicles={vehicles} reload={fetchAll} />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="documents" className="mt-4">
              <DocumentsTab schoolId={schoolId!} docs={docs} vehicles={vehicles} reload={fetchAll} />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="expenses" className="mt-4">
              <ExpensesTab schoolId={schoolId!} expenses={expenses} vehicles={vehicles} suppliers={suppliers} reload={fetchAll} userId={user.id} />
            </TabsContent>
          )}
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
      {loading ? <ListSkeleton rows={3} /> :
        vehicles.length === 0 ? <EmptyStateBlock titleKey="emptyVehicles" actionLabel="Nouveau bus" onAction={openNew} /> : (
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
            {drivers.length === 0 ? <TableEmpty colSpan={6} titleKey="emptyDrivers" actionLabel="Nouveau chauffeur" onAction={openNew} /> :
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
            {docs.length === 0 ? <TableEmpty colSpan={7} titleKey="emptyDocuments" actionLabel="Nouveau document" onAction={openNew} /> :
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
            {expenses.length === 0 ? <TableEmpty colSpan={7} titleKey="emptyExpenses" actionLabel="Nouvelle dépense" onAction={openNew} /> :
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

// ---------------- ROUTES (Circuits) ----------------
function RoutesTab({ schoolId, routes, stops, assignments, vehicles, drivers, reload }: { schoolId: string; routes: TRoute[]; stops: RouteStop[]; assignments: StudentTransport[]; vehicles: Vehicle[]; drivers: Driver[]; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<TRoute | null>(null);
  const [del, setDel] = useState<TRoute | null>(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<TRoute | null>(null);
  const empty = { name: "", description: "", assigned_vehicle_id: "", assigned_driver_id: "", fee_amount: "", notes: "" };
  const [form, setForm] = useState(empty);

  function openNew() { setEdit(null); setForm(empty); setOpen(true); }
  function openEdit(r: TRoute) {
    setEdit(r);
    setForm({
      name: r.name, description: r.description ?? "",
      assigned_vehicle_id: r.assigned_vehicle_id ?? "",
      assigned_driver_id: r.assigned_driver_id ?? "",
      fee_amount: r.fee_amount ? String(r.fee_amount) : "",
      notes: r.notes ?? "",
    });
    setOpen(true);
  }
  async function save() {
    if (saving) return;
    if (!form.name.trim()) { toast.error("Nom requis"); return; }
    setSaving(true);
    const payload = {
      school_id: schoolId, name: form.name.trim(),
      description: form.description || null,
      assigned_vehicle_id: form.assigned_vehicle_id || null,
      assigned_driver_id: form.assigned_driver_id || null,
      fee_amount: form.fee_amount ? Number(form.fee_amount) : 0,
      notes: form.notes || null,
    };
    const res = edit
      ? await supabase.from("transport_routes").update(payload).eq("id", edit.id)
      : await supabase.from("transport_routes").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(edit ? "Circuit mis à jour" : "Circuit créé");
    setOpen(false); reload();
  }
  async function doDelete() {
    if (!del) return;
    const { error } = await supabase.from("transport_routes").delete().eq("id", del.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Circuit supprimé"); setDel(null); reload();
  }
  const studentsOf = (rid: string) => assignments.filter((a)=>a.route_id===rid && a.active).length;

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nouveau circuit</Button></div>
      {routes.length === 0 ? <EmptyStateBlock titleKey="emptyRoutes" actionLabel="Nouveau circuit" onAction={openNew} /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {routes.map((r) => {
            const v = vehicles.find((x) => x.id === r.assigned_vehicle_id);
            const dr = drivers.find((x) => x.id === r.assigned_driver_id);
            const nbStops = stops.filter((s)=>s.route_id===r.id).length;
            const nbStudents = studentsOf(r.id);
            const cap = v?.capacity ?? 0;
            const over = cap > 0 && nbStudents > cap;
            return (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <RouteIcon className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">{r.name}</h3>
                      </div>
                      {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                    </div>
                    {over && <Badge variant="destructive">Capacité dépassée</Badge>}
                  </div>
                  <div className="text-sm">Bus : {v ? (v.bus_number || v.registration_number) : "—"} {cap > 0 ? `(${cap} pl.)` : ""}</div>
                  <div className="text-sm">Chauffeur : {dr?.name || "—"}</div>
                  <div className="text-sm">Arrêts : {nbStops} · Élèves : {nbStudents}{cap>0?` / ${cap}`:""}</div>
                  <div className="text-sm">Tarif : {fcfa(Number(r.fee_amount||0))}</div>
                  <div className="flex gap-2 pt-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={()=>setDetail(r)}>Détails / arrêts</Button>
                    <Button size="sm" variant="outline" onClick={()=>openEdit(r)}><Pencil className="h-3 w-3 mr-1" />Modifier</Button>
                    <Button size="sm" variant="ghost" onClick={()=>setDel(r)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit ? "Modifier le circuit" : "Nouveau circuit"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nom *</Label><Input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} placeholder="Ex: Bonapriso - Akwa" /></div>
            <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e)=>setForm({...form, description:e.target.value})} /></div>
            <div><Label>Bus assigné</Label>
              <Select value={form.assigned_vehicle_id || "none"} onValueChange={(v)=>setForm({...form, assigned_vehicle_id: v==="none"?"":v})}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {vehicles.map(v=><SelectItem key={v.id} value={v.id}>{v.bus_number || v.registration_number}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Chauffeur assigné</Label>
              <Select value={form.assigned_driver_id || "none"} onValueChange={(v)=>setForm({...form, assigned_driver_id: v==="none"?"":v})}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {drivers.map(d=><SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Tarif mensuel par défaut (FCFA)</Label><Input type="number" value={form.fee_amount} onChange={(e)=>setForm({...form, fee_amount:e.target.value})} /></div>
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
          <AlertDialogHeader><AlertDialogTitle>Supprimer ce circuit ?</AlertDialogTitle>
            <AlertDialogDescription>Les arrêts et assignations d'élèves seront aussi supprimés.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={doDelete}>Supprimer</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {detail && (
        <RouteDetailDialog
          route={detail}
          stops={stops.filter((s)=>s.route_id===detail.id)}
          assignments={assignments.filter((a)=>a.route_id===detail.id)}
          vehicles={vehicles}
          onClose={()=>setDetail(null)}
          reload={reload}
          schoolId={schoolId}
        />
      )}
    </div>
  );
}

function RouteDetailDialog({ route, stops, assignments, vehicles, onClose, reload, schoolId }: { route: TRoute; stops: RouteStop[]; assignments: StudentTransport[]; vehicles: Vehicle[]; onClose: () => void; reload: () => void; schoolId: string }) {
  const db = useDB();
  const [stopName, setStopName] = useState("");
  const [pickup, setPickup] = useState("");
  const v = vehicles.find((x) => x.id === route.assigned_vehicle_id);
  const cap = v?.capacity ?? 0;
  const activeCount = assignments.filter((a)=>a.active).length;

  async function addStop() {
    if (!stopName.trim()) { toast.error("Nom arrêt requis"); return; }
    const order = stops.length;
    const { error } = await supabase.from("route_stops").insert({
      school_id: schoolId, route_id: route.id,
      stop_name: stopName.trim(), order_index: order,
      pickup_time: pickup || null,
    });
    if (error) { toast.error(error.message); return; }
    setStopName(""); setPickup(""); reload();
  }
  async function delStop(id: string) {
    const { error } = await supabase.from("route_stops").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    reload();
  }
  async function moveStop(s: RouteStop, dir: -1 | 1) {
    const sorted = [...stops].sort((a,b)=>a.order_index - b.order_index);
    const idx = sorted.findIndex((x)=>x.id===s.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await supabase.from("route_stops").update({ order_index: swap.order_index }).eq("id", s.id);
    await supabase.from("route_stops").update({ order_index: s.order_index }).eq("id", swap.id);
    reload();
  }

  return (
    <Dialog open onOpenChange={(o)=>!o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{route.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Bus : {v ? (v.bus_number || v.registration_number) : "—"} · Capacité : {cap || "—"} · Élèves actifs : {activeCount}
            {cap > 0 && activeCount > cap && <span className="text-destructive font-medium"> · Dépassement !</span>}
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-2">Arrêts (ordonnés)</h4>
            <Table>
              <TableHeader><TableRow><TableHead className="w-12">#</TableHead><TableHead>Arrêt</TableHead><TableHead>Horaire</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {stops.length === 0 ? <TableEmpty colSpan={4} titleKey="emptyStops" /> :
                [...stops].sort((a,b)=>a.order_index-b.order_index).map((s, i) => (
                  <TableRow key={s.id}>
                    <TableCell>{i+1}</TableCell>
                    <TableCell>{s.stop_name}</TableCell>
                    <TableCell>{s.pickup_time || "—"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={()=>moveStop(s,-1)} disabled={i===0}><ArrowUp className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={()=>moveStop(s,1)} disabled={i===stops.length-1}><ArrowDown className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={()=>delStop(s.id)}><Trash2 className="h-3 w-3" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex gap-2 mt-2">
              <Input placeholder="Nom de l'arrêt" value={stopName} onChange={(e)=>setStopName(e.target.value)} />
              <Input type="time" value={pickup} onChange={(e)=>setPickup(e.target.value)} className="w-32" />
              <Button onClick={addStop}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-2">Élèves assignés ({assignments.length})</h4>
            <Table>
              <TableHeader><TableRow><TableHead>Élève</TableHead><TableHead>Arrêt</TableHead><TableHead>Direction</TableHead><TableHead>Tarif</TableHead><TableHead>Actif</TableHead></TableRow></TableHeader>
              <TableBody>
                {assignments.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Aucun élève</TableCell></TableRow> :
                assignments.map((a) => {
                  const st = db.students.find((s)=>s.id===a.student_id);
                  const stop = stops.find((s)=>s.id===a.stop_id);
                  return (
                    <TableRow key={a.id}>
                      <TableCell>{st ? `${st.firstName} ${st.lastName}` : "—"}</TableCell>
                      <TableCell>{stop?.stop_name || "—"}</TableCell>
                      <TableCell>{DIRECTION_LABEL[a.direction]}</TableCell>
                      <TableCell>{fcfa(Number(a.fee_amount||0))}</TableCell>
                      <TableCell>{a.active ? <Badge>Oui</Badge> : <Badge variant="secondary">Non</Badge>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
        <DialogFooter><Button onClick={onClose}>Fermer</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- TRANSPORTED STUDENTS ----------------
function TransportedStudentsTab({ schoolId, routes, stops, assignments, vehicles, reload }: { schoolId: string; routes: TRoute[]; stops: RouteStop[]; assignments: StudentTransport[]; vehicles: Vehicle[]; reload: () => void }) {
  const { t } = useTranslation();
  const db = useDB();

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<StudentTransport | null>(null);
  const [del, setDel] = useState<StudentTransport | null>(null);
  const [saving, setSaving] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const empty = { student_id: "", route_id: "", stop_id: "", direction: "les_deux" as Direction, fee_amount: "", active: true };
  const [form, setForm] = useState(empty);

  function openNew() { setEdit(null); setForm(empty); setOpen(true); }
  function openEdit(a: StudentTransport) {
    setEdit(a);
    setForm({
      student_id: a.student_id, route_id: a.route_id,
      stop_id: a.stop_id ?? "", direction: a.direction,
      fee_amount: a.fee_amount ? String(a.fee_amount) : "",
      active: a.active,
    });
    setOpen(true);
  }
  async function save() {
    if (saving) return;
    if (!form.student_id) { toast.error("Élève requis"); return; }
    if (!form.route_id) { toast.error("Circuit requis"); return; }
    // capacity warning
    const route = routes.find((r)=>r.id===form.route_id);
    const veh = vehicles.find((v)=>v.id===route?.assigned_vehicle_id);
    const cap = veh?.capacity ?? 0;
    const currentCount = assignments.filter((a)=>a.route_id===form.route_id && a.active && a.id !== edit?.id).length;
    if (cap > 0 && form.active && currentCount + 1 > cap) {
      if (!confirm(`La capacité du bus (${cap}) est dépassée. Continuer ?`)) return;
    }
    setSaving(true);
    const payload = {
      school_id: schoolId, student_id: form.student_id, route_id: form.route_id,
      stop_id: form.stop_id || null, direction: form.direction,
      fee_amount: form.fee_amount ? Number(form.fee_amount) : Number(route?.fee_amount || 0),
      active: form.active,
    };
    const res = edit
      ? await supabase.from("student_transport").update(payload).eq("id", edit.id)
      : await supabase.from("student_transport").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(edit ? "Assignation mise à jour" : "Élève assigné");
    setOpen(false); reload();
  }
  async function doDelete() {
    if (!del) return;
    const { error } = await supabase.from("student_transport").delete().eq("id", del.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Assignation supprimée"); setDel(null); reload();
  }

  // Group rows
  const rows = assignments.map((a) => {
    const st = db.students.find((s)=>s.id===a.student_id);
    const r = routes.find((x)=>x.id===a.route_id);
    const stop = stops.find((s)=>s.id===a.stop_id);
    return { a, st, r, stop };
  });

  // Available students = exclude those already assigned (when creating)
  const assignedIds = new Set(assignments.map((a)=>a.student_id));
  const studentOptions = db.students.filter((s) => edit?.student_id === s.id || !assignedIds.has(s.id));
  const stopOptions = stops.filter((s)=>s.route_id===form.route_id).sort((a,b)=>a.order_index-b.order_index);

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={()=>setBillOpen(true)}><Receipt className="h-4 w-4 mr-2" />Facturer le transport</Button>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Assigner un élève</Button>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Élève</TableHead><TableHead>Circuit</TableHead>
            <TableHead>Arrêt</TableHead><TableHead>Direction</TableHead>
            <TableHead className="text-right">Tarif</TableHead><TableHead>Actif</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun élève assigné</TableCell></TableRow> :
            rows.map(({a, st, r, stop}) => (
              <TableRow key={a.id}>
                <TableCell>{st ? `${st.firstName} ${st.lastName}` : "—"}</TableCell>
                <TableCell>{r?.name || "—"}</TableCell>
                <TableCell>{stop?.stop_name || "—"}</TableCell>
                <TableCell>{DIRECTION_LABEL[a.direction]}</TableCell>
                <TableCell className="text-right">{fcfa(Number(a.fee_amount||0))}</TableCell>
                <TableCell>{a.active ? <Badge>Oui</Badge> : <Badge variant="secondary">Non</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={()=>openEdit(a)}><Pencil className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={()=>setDel(a)}><Trash2 className="h-3 w-3" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Modifier l'assignation" : "Assigner un élève au transport"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Élève *</Label>
              <Select value={form.student_id} onValueChange={(v)=>setForm({...form, student_id:v})}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{studentOptions.map(s=><SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Circuit *</Label>
              {routes.length === 0 ? (
                <EmptySelectHint message={t("quickCreate.noRoutes")} />
              ) : (
                <Select value={form.route_id} onValueChange={(v)=>setForm({...form, route_id:v, stop_id:""})}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{routes.map(r=><SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div><Label>Arrêt</Label>
              <Select value={form.stop_id || "none"} onValueChange={(v)=>setForm({...form, stop_id: v==="none"?"":v})}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {stopOptions.map(s=><SelectItem key={s.id} value={s.id}>{s.stop_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Direction</Label>
              <Select value={form.direction} onValueChange={(v)=>setForm({...form, direction: v as Direction})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(DIRECTION_LABEL) as Direction[]).map(d=><SelectItem key={d} value={d}>{DIRECTION_LABEL[d]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tarif (FCFA)</Label><Input type="number" value={form.fee_amount} onChange={(e)=>setForm({...form, fee_amount:e.target.value})} placeholder="Défaut circuit" /></div>
            <div className="flex items-center gap-2 mt-6">
              <input id="active" type="checkbox" checked={form.active} onChange={(e)=>setForm({...form, active:e.target.checked})} />
              <Label htmlFor="active">Actif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving}>{saving ? "…" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o)=>!o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Retirer cet élève du transport ?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={doDelete}>Retirer</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {billOpen && (
        <BillTransportDialog
          assignments={assignments}
          routes={routes}
          onClose={()=>setBillOpen(false)}
        />
      )}
    </div>
  );
}

// ---------------- BILLING ----------------
function BillTransportDialog({ assignments, routes, onClose }: { assignments: StudentTransport[]; routes: TRoute[]; onClose: () => void }) {
  const db = useDB();
  const [period, setPeriod] = useState(todayISO().slice(0,7));
  const [dueDate, setDueDate] = useState(todayISO());
  const [generating, setGenerating] = useState(false);

  const eligible = assignments.filter((a)=>a.active && Number(a.fee_amount||0) > 0);

  function generate() {
    if (generating) return;
    if (eligible.length === 0) { toast.error("Aucun élève à facturer"); return; }
    setGenerating(true);
    try {
      updateDB((d) => {
        // Ensure a "Transport" fee type exists
        let feeType = d.feeTypes.find((f) => f.name.toLowerCase().startsWith("transport"));
        if (!feeType) {
          feeType = { id: crypto.randomUUID(), name: "Transport", amount: 0, scope: "Tous" };
          d.feeTypes.push(feeType);
        }
        const tag = `Transport ${period}`;
        let created = 0; let skipped = 0;
        eligible.forEach((a) => {
          // Single-insert guard: skip if invoice already exists for student+period+transport
          const exists = d.payments.some((p) => p.studentId === a.student_id && p.type === "Transport" && (p.notes || "").includes(period));
          if (exists) { skipped++; return; }
          const prefix = "FAC-2026-";
          const max = d.payments.reduce((m, p) => {
            const n = parseInt(p.invoiceNumber?.slice(prefix.length) || "0", 10);
            return n > m ? n : m;
          }, 0);
          const num = `${prefix}${(max + 1 + created).toString().padStart(3, "0")}`;
          const inv: Payment = {
            id: crypto.randomUUID(),
            invoiceNumber: num,
            studentId: a.student_id,
            feeTypeId: feeType!.id,
            amount: Number(a.fee_amount),
            amountPaid: 0,
            date: todayISO(),
            dueDate,
            type: "Transport",
            status: deriveInvoiceStatus(Number(a.fee_amount), 0, dueDate),
            notes: tag,
          };
          d.payments.push(inv);
          created++;
        });
        d.activities.unshift({
          id: crypto.randomUUID(),
          type: "payment",
          text: `Facturation Transport ${period} : ${created} facture(s) créée(s)${skipped?`, ${skipped} ignorée(s)`:""}`,
          date: new Date().toISOString(),
        });
        toast.success(`${created} facture(s) créée(s)${skipped?`, ${skipped} déjà existante(s)`:""}`);
      });
      onClose();
    } finally {
      setGenerating(false);
    }
  }
  // suppress unused warning
  void routes; void db;

  return (
    <Dialog open onOpenChange={(o)=>!o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Facturer le transport</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Génère une facture par élève transporté actif, via le système de facturation standard (Scolarité &amp; Paiements, Comptabilité).
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Période (mois)</Label><Input type="month" value={period} onChange={(e)=>setPeriod(e.target.value)} /></div>
            <div><Label>Échéance</Label><Input type="date" value={dueDate} onChange={(e)=>setDueDate(e.target.value)} /></div>
          </div>
          <div className="text-sm">Élèves à facturer : <strong>{eligible.length}</strong></div>
          <p className="text-xs text-muted-foreground">Les factures déjà créées pour cette période ne seront pas dupliquées.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={generate} disabled={generating || eligible.length===0}>{generating ? "…" : "Générer les factures"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
