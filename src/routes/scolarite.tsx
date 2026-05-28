import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { StatCard, useLoaded, TableSkeleton } from "@/components/shared";
import { useDB, updateDB } from "@/lib/store";
import { fcfa } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, TrendingUp, AlertTriangle, Plus } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

export const Route = createFileRoute("/scolarite")({
  component: ScolaritePage,
});

const schema = z.object({
  studentId: z.string().min(1, "Élève requis"),
  amount: z.coerce.number().positive("Montant invalide"),
  type: z.string().min(2, "Motif requis"),
});

function ScolaritePage() {
  const db = useDB();
  const loaded = useLoaded();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ studentId: "", amount: "", type: "Scolarité" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const studentName = (id: string) => {
    const s = db.students.find((x) => x.id === id);
    return s ? `${s.firstName} ${s.lastName}` : "—";
  };

  const total = db.payments.reduce((s, p) => s + p.amount, 0);
  const unpaid = db.payments.filter((p) => p.status === "impaye").length;
  const collected = db.payments.filter((p) => p.status === "paye").length;

  const submit = () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    updateDB((d) => {
      d.payments.unshift({
        id: "pay-" + Math.random().toString(36).slice(2, 9),
        studentId: form.studentId,
        amount: Number(form.amount),
        date: new Date().toISOString().slice(0, 10),
        type: form.type,
        status: "paye",
      });
      d.activities.unshift({ id: "act-" + Math.random().toString(36).slice(2, 7), type: "payment", text: `Paiement de ${fcfa(Number(form.amount))} reçu`, date: new Date().toISOString() });
    });
    toast.success("Paiement enregistré");
    setForm({ studentId: "", amount: "", type: "Scolarité" });
    setOpen(false);
  };

  const statusBadge = (s: string) =>
    s === "paye" ? <Badge className="bg-success text-success-foreground">Payé</Badge> : s === "partiel" ? <Badge className="bg-accent text-accent-foreground">Partiel</Badge> : <Badge variant="destructive">Impayé</Badge>;

  return (
    <AppLayout title="Scolarité & Paiements">
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total encaissé" value={fcfa(total)} icon={TrendingUp} tone="green" />
        <StatCard label="Paiements validés" value={String(collected)} icon={CreditCard} tone="blue" />
        <StatCard label="Factures impayées" value={String(unpaid)} icon={AlertTriangle} tone="red" />
      </div>

      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> Enregistrer paiement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enregistrer un paiement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Élève</Label>
                <Select value={form.studentId} onValueChange={(v) => setForm((f) => ({ ...f, studentId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choisir un élève" /></SelectTrigger>
                  <SelectContent>
                    {db.students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.studentId && <p className="text-xs text-destructive">{errors.studentId}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Montant (FCFA)</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Motif</Label>
                <Input value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} />
                {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={submit}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          {!loaded ? (
            <TableSkeleton />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {db.payments.slice(0, 40).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{studentName(p.studentId)}</TableCell>
                    <TableCell>{p.type}</TableCell>
                    <TableCell className="text-muted-foreground">{p.date}</TableCell>
                    <TableCell className="font-semibold">{fcfa(p.amount)}</TableCell>
                    <TableCell>{statusBadge(p.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
