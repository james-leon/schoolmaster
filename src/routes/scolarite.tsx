import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { StatCard, useLoaded, TableSkeleton } from "@/components/shared";
import { useDB, updateDB } from "@/lib/store";
import { fcfa } from "@/lib/format";
import { PAYMENT_MODES, deriveInvoiceStatus, type PaymentMode, type PaymentStatus } from "@/lib/types";
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

export const Route = createFileRoute("/scolarite")({ component: ScolaritePage });

const schema = z.object({
  invoiceId: z.string().min(1, "Facture requise"),
  amount: z.coerce.number().positive("Montant invalide"),
  mode: z.enum(PAYMENT_MODES as [PaymentMode, ...PaymentMode[]], { message: "Mode requis" }),
  reference: z.string().trim().min(1, "Référence requise").max(60),
});

const STATUS_LABELS: Record<PaymentStatus, { label: string; cls: string }> = {
  paye: { label: "Payée", cls: "bg-success text-success-foreground" },
  impaye: { label: "En attente", cls: "bg-accent text-accent-foreground" },
  partiel: { label: "Partiel", cls: "bg-secondary text-secondary-foreground" },
  retard: { label: "En retard", cls: "bg-destructive text-destructive-foreground" },
};

function ScolaritePage() {
  const db = useDB();
  const loaded = useLoaded();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ invoiceId: "", amount: "", mode: "Espèces" as PaymentMode, reference: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const studentName = (id: string) => {
    const s = db.students.find((x) => x.id === id);
    return s ? `${s.firstName} ${s.lastName}` : "—";
  };

  const totalCollected = db.payments.reduce((s, p) => s + (p.amountPaid ?? 0), 0);
  const unpaid = db.payments.filter((p) => (p.amountPaid ?? 0) < p.amount).length;
  const paid = db.payments.filter((p) => p.status === "paye").length;

  const submit = () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    const { invoiceId, amount, mode, reference } = parsed.data;
    updateDB((d) => {
      const inv = d.payments.find((p) => p.id === invoiceId);
      if (!inv) return;
      inv.amountPaid = (inv.amountPaid ?? 0) + amount;
      inv.mode = mode;
      inv.reference = reference;
      inv.date = new Date().toISOString().slice(0, 10);
      inv.status = deriveInvoiceStatus(inv.amount, inv.amountPaid, inv.dueDate);
      d.activities.unshift({ id: "act-" + Math.random().toString(36).slice(2, 7), type: "payment", text: `Paiement de ${fcfa(amount)} (${mode}) — ${studentName(inv.studentId)}`, date: new Date().toISOString() });
    });
    toast.success("Paiement enregistré");
    setErrors({});
    setForm({ invoiceId: "", amount: "", mode: "Espèces", reference: "" });
    setOpen(false);
  };

  const openInvoices = useMemo(() => db.payments.filter((p) => (p.amountPaid ?? 0) < p.amount), [db.payments]);

  return (
    <AppLayout title="Scolarité & Paiements">
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total encaissé" value={fcfa(totalCollected)} icon={TrendingUp} tone="green" />
        <StatCard label="Factures payées" value={String(paid)} icon={CreditCard} tone="blue" />
        <StatCard label="Factures en attente" value={String(unpaid)} icon={AlertTriangle} tone="red" />
      </div>

      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1.5 h-4 w-4" /> Enregistrer un paiement</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Enregistrer un paiement</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Field label="Facture" error={errors.invoiceId}>
                <Select value={form.invoiceId} onValueChange={(v) => setForm((f) => ({ ...f, invoiceId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choisir une facture" /></SelectTrigger>
                  <SelectContent>
                    {openInvoices.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {studentName(p.studentId)} — {p.type} — Reste {fcfa(p.amount - (p.amountPaid ?? 0))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Montant (FCFA)" error={errors.amount}>
                <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </Field>
              <Field label="Mode de paiement" error={errors.mode}>
                <Select value={form.mode} onValueChange={(v) => setForm((f) => ({ ...f, mode: v as PaymentMode }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Référence" error={errors.reference}>
                <Input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="N° transaction / reçu" />
              </Field>
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
                  <TableHead>Total</TableHead>
                  <TableHead>Payé</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {db.payments.slice(0, 60).map((p) => {
                  const st = STATUS_LABELS[p.status];
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{studentName(p.studentId)}</TableCell>
                      <TableCell>{p.type}</TableCell>
                      <TableCell className="text-muted-foreground">{p.date}</TableCell>
                      <TableCell className="font-semibold">{fcfa(p.amount)}</TableCell>
                      <TableCell>{fcfa(p.amountPaid ?? 0)}</TableCell>
                      <TableCell className="text-muted-foreground">{p.mode ?? "—"}</TableCell>
                      <TableCell><Badge className={st.cls}>{st.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
