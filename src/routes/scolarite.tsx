import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/AppLayout";
import { StatCard, useLoaded, TableSkeleton, EmptyState } from "@/components/shared";
import { useDB, updateDB, getDB } from "@/lib/store";
import { fcfa } from "@/lib/format";
import {
  PAYMENT_MODES,
  FEE_SCOPES,
  deriveInvoiceStatus,
  amountInWords,
  type PaymentMode,
  type PaymentStatus,
  type FeeLevelScope,
  type Payment,
  type FeeType,
  type PaymentRecord,
} from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Printer,
  Download,
  Search,
  Wallet,
  Receipt,
  FileText,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { csvRow } from "@/lib/csv";

export const Route = createFileRoute("/scolarite")({ component: ScolaritePage });

const STATUS_LABELS: Record<PaymentStatus, { label: string; cls: string }> = {
  paye: { label: "Payée", cls: "bg-success text-success-foreground" },
  partiel: { label: "Partiel", cls: "bg-secondary text-secondary-foreground" },
  impaye: { label: "En attente", cls: "bg-accent text-accent-foreground" },
  retard: { label: "En retard", cls: "bg-destructive text-destructive-foreground" },
};



function nextInvoiceNumber(): string {
  const prefix = "FAC-2026-";
  const max = getDB().payments.reduce((m, p) => {
    const n = parseInt(p.invoiceNumber?.slice(prefix.length) || "0", 10);
    return n > m ? n : m;
  }, 0);
  return `${prefix}${(max + 1).toString().padStart(3, "0")}`;
}

function nextReceiptNumber(): string {
  const prefix = "REC-2026-";
  const max = getDB().paymentRecords.reduce((m, r) => {
    const n = parseInt(r.receiptNumber.slice(prefix.length) || "0", 10);
    return n > m ? n : m;
  }, 0);
  return `${prefix}${(max + 1).toString().padStart(3, "0")}`;
}

function ScolaritePage() {
  const { t } = useTranslation();
  const db = useDB();
  const loaded = useLoaded();

  const totalDue = db.payments.reduce((s, p) => s + p.amount, 0);
  const totalCollected = db.payments.reduce((s, p) => s + (p.amountPaid ?? 0), 0);
  const pendingCount = db.payments.filter((p) => deriveInvoiceStatus(p.amount, p.amountPaid, p.dueDate) === "impaye").length;
  const overdueCount = db.payments.filter((p) => deriveInvoiceStatus(p.amount, p.amountPaid, p.dueDate) === "retard").length;

  return (
    <AppLayout title={t("fees.title")}>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("fees.kpiTotalDue")} value={fcfa(totalDue)} icon={Wallet} tone="blue" />
        <StatCard label={t("fees.kpiTotalCollected")} value={fcfa(totalCollected)} icon={TrendingUp} tone="green" />
        <StatCard label={t("fees.kpiPending")} value={String(pendingCount)} icon={CreditCard} tone="orange" />
        <StatCard label={t("fees.kpiOverdue")} value={String(overdueCount)} icon={AlertTriangle} tone="red" />
      </div>

      <Tabs defaultValue="invoices" className="w-full">
        <TabsList>
          <TabsTrigger value="invoices">{t("fees.tabInvoices")}</TabsTrigger>
          <TabsTrigger value="history">{t("fees.tabHistory")}</TabsTrigger>
          <TabsTrigger value="fees">{t("fees.tabFeeTypes")}</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-4">
          <InvoicesTab loaded={loaded} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTab loaded={loaded} />
        </TabsContent>
        <TabsContent value="fees" className="mt-4">
          <FeeTypesTab />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

/* ============================ INVOICES ============================ */

function InvoicesTab({ loaded }: { loaded: boolean }) {
  const db = useDB();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [feeFilter, setFeeFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Payment | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Payment | null>(null);
  const [deleteInvoice, setDeleteInvoice] = useState<Payment | null>(null);
  const [receipt, setReceipt] = useState<PaymentRecord | null>(null);

  const studentMap = useMemo(() => Object.fromEntries(db.students.map((s) => [s.id, s])), [db.students]);
  const classMap = useMemo(() => Object.fromEntries(db.classes.map((c) => [c.id, c])), [db.classes]);

  const rows = useMemo(() => {
    return db.payments
      .map((p) => ({
        ...p,
        status: deriveInvoiceStatus(p.amount, p.amountPaid, p.dueDate),
      }))
      .filter((p) => {
        const s = studentMap[p.studentId];
        if (!s) return false;
        if (search) {
          const q = search.toLowerCase();
          const name = `${s.firstName} ${s.lastName}`.toLowerCase();
          if (!name.includes(q) && !(p.invoiceNumber || "").toLowerCase().includes(q)) return false;
        }
        if (statusFilter !== "all" && p.status !== statusFilter) return false;
        if (classFilter !== "all" && s.classId !== classFilter) return false;
        if (feeFilter !== "all" && p.feeTypeId !== feeFilter && p.type !== feeFilter) return false;
        return true;
      })
      .sort((a, b) => (b.invoiceNumber || "").localeCompare(a.invoiceNumber || ""));
  }, [db.payments, studentMap, search, statusFilter, classFilter, feeFilter]);

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-2 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Rechercher par élève ou n° facture..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="md:w-44"><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="paye">Payée</SelectItem>
                  <SelectItem value="partiel">Partiel</SelectItem>
                  <SelectItem value="impaye">En attente</SelectItem>
                  <SelectItem value="retard">En retard</SelectItem>
                </SelectContent>
              </Select>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="md:w-40"><SelectValue placeholder="Classe" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes classes</SelectItem>
                  {db.classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={feeFilter} onValueChange={setFeeFilter}>
                <SelectTrigger className="md:w-44"><SelectValue placeholder="Type de frais" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  {db.feeTypes.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> Nouvelle facture</Button>
          </div>

          {!loaded ? (
            <TableSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Aucune facture"
              description="Créez votre première facture pour commencer."
              actionLabel="Nouvelle facture"
              onAction={() => setCreateOpen(true)}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Facture</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Type de frais</TableHead>
                    <TableHead>Montant dû</TableHead>
                    <TableHead>Montant payé</TableHead>
                    <TableHead>Reste</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => {
                    const s = studentMap[p.studentId];
                    const cls = s ? classMap[s.classId] : undefined;
                    const remaining = p.amount - (p.amountPaid ?? 0);
                    const st = STATUS_LABELS[p.status];
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.invoiceNumber || "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{s ? `${s.firstName} ${s.lastName}` : "—"}</span>
                            {cls && <Badge variant="outline" className="text-xs">{cls.name}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{p.type}</TableCell>
                        <TableCell className="font-semibold">{fcfa(p.amount)}</TableCell>
                        <TableCell>{fcfa(p.amountPaid ?? 0)}</TableCell>
                        <TableCell className={remaining > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}>
                          {fcfa(remaining)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.dueDate || "—"}</TableCell>
                        <TableCell><Badge className={st.cls}>{st.label}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => setViewInvoice(p)} title="Voir">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {remaining > 0 && (
                              <Button size="icon" variant="ghost" onClick={() => setPayInvoice(p)} title="Encaisser">
                                <CreditCard className="h-4 w-4 text-secondary" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => setDeleteInvoice(p)} title="Supprimer">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {createOpen && (
        <CreateInvoiceModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onPaid={(rec) => setReceipt(rec)}
        />
      )}
      {payInvoice && (
        <PaymentModal
          invoice={payInvoice}
          onClose={() => setPayInvoice(null)}
          onPaid={(rec) => {
            setPayInvoice(null);
            setReceipt(rec);
          }}
        />
      )}
      {viewInvoice && <InvoiceDetailModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} />}
      {receipt && <ReceiptModal record={receipt} onClose={() => setReceipt(null)} />}

      <AlertDialog open={!!deleteInvoice} onOpenChange={(o) => !o && setDeleteInvoice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les paiements liés seront également supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const id = deleteInvoice!.id;
                updateDB((d) => {
                  d.payments = d.payments.filter((p) => p.id !== id);
                  d.paymentRecords = d.paymentRecords.filter((r) => r.invoiceId !== id);
                });
                toast.success("Facture supprimée");
                setDeleteInvoice(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ============================ CREATE INVOICE ============================ */

const invoiceSchema = z.object({
  studentId: z.string().min(1, "Élève requis"),
  feeTypeId: z.string().min(1, "Type de frais requis"),
  amount: z.coerce.number().positive("Montant invalide"),
  dueDate: z.string().min(1, "Date d'échéance requise"),
  notes: z.string().max(300).optional(),
});

function CreateInvoiceModal({
  open,
  onClose,
  onPaid,
}: {
  open: boolean;
  onClose: () => void;
  onPaid: (rec: PaymentRecord) => void;
}) {
  const { t } = useTranslation();
  const db = useDB();
  const [form, setForm] = useState({ studentId: "", feeTypeId: "", amount: "", dueDate: "", notes: "" });
  const [studentSearch, setStudentSearch] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Pay-now state
  const [payNow, setPayNow] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: "",
    mode: "Espèces" as PaymentMode,
    reference: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase().trim();
    return db.students
      .filter((s) => !q || `${s.firstName} ${s.lastName}`.toLowerCase().includes(q))
      .slice(0, 50);
  }, [db.students, studentSearch]);

  const submit = () => {
    if (submitting) return;
    const parsed = invoiceSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    const data = parsed.data;
    const fee = db.feeTypes.find((f) => f.id === data.feeTypeId);
    const num = nextInvoiceNumber();
    const invoiceId = crypto.randomUUID();

    let payAmount = 0;
    let payMode: PaymentMode = "Espèces";
    let payReference = "";
    let payDate = new Date().toISOString().slice(0, 10);
    let newRecord: PaymentRecord | null = null;

    if (payNow) {
      const paySchema = z
        .object({
          amount: z.coerce.number().positive("Montant invalide").max(data.amount, `Maximum ${fcfa(data.amount)}`),
          mode: z.enum(PAYMENT_MODES as [PaymentMode, ...PaymentMode[]], { message: "Mode requis" }),
          reference: z.string().max(60).optional(),
          date: z.string().min(1, "Date requise"),
        })
        .superRefine((v, ctx) => {
          const needsRef = v.mode === "MTN Mobile Money" || v.mode === "Orange Money";
          if (needsRef && (!v.reference || v.reference.trim().length === 0)) {
            ctx.addIssue({ code: "custom", path: ["payReference"], message: "Référence requise pour Mobile Money" });
          }
        });
      const payParsed = paySchema.safeParse({
        amount: payForm.amount || String(data.amount),
        mode: payForm.mode,
        reference: payForm.reference,
        date: payForm.date,
      });
      if (!payParsed.success) {
        const errs: Record<string, string> = {};
        payParsed.error.issues.forEach((i) => {
          const k = i.path[0] as string;
          errs["pay_" + k] = i.message;
        });
        setErrors(errs);
        return;
      }
      payAmount = payParsed.data.amount;
      payMode = payParsed.data.mode;
      payReference = payParsed.data.reference || "";
      payDate = payParsed.data.date;
      newRecord = {
        id: crypto.randomUUID(),
        receiptNumber: nextReceiptNumber(),
        invoiceId,
        studentId: data.studentId,
        amount: payAmount,
        mode: payMode,
        reference: payReference,
        date: payDate,
      };
    }

    setSubmitting(true);
    const student = db.students.find((s) => s.id === data.studentId);
    updateDB((d) => {
      const newInvoice: Payment = {
        id: invoiceId,
        invoiceNumber: num,
        studentId: data.studentId,
        feeTypeId: data.feeTypeId,
        amount: data.amount,
        amountPaid: payAmount,
        date: payNow ? payDate : new Date().toISOString().slice(0, 10),
        dueDate: data.dueDate,
        type: fee?.name || "Frais",
        status: deriveInvoiceStatus(data.amount, payAmount, data.dueDate),
        notes: data.notes,
        ...(payNow ? { mode: payMode, reference: payReference } : {}),
      };
      d.payments.push(newInvoice);
      d.activities.unshift({
        id: crypto.randomUUID(),
        type: "payment",
        text: `Facture ${num} créée`,
        date: new Date().toISOString(),
      });
      if (newRecord) {
        d.paymentRecords.unshift(newRecord);
        d.activities.unshift({
          id: crypto.randomUUID(),
          type: "payment",
          text: `Paiement de ${fcfa(payAmount)} (${payMode})${student ? " — " + student.firstName + " " + student.lastName : ""}`,
          date: new Date().toISOString(),
        });
      }
    });
    toast.success(newRecord ? `Facture créée et paiement enregistré — Reçu N° ${newRecord.receiptNumber}` : "Facture créée avec succès");
    onClose();
    if (newRecord) onPaid(newRecord);
  };

  const invoiceAmount = Number(form.amount) || 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("fees.createInvoiceTitle")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Field label={t("fees.fieldStudent")} error={errors.studentId}>
            {db.students.length === 0 ? (
              <EmptySelectHint message={t("quickCreate.noStudents")} />
            ) : (
              <>
                <Input
                  placeholder={t("fees.studentSearchPlaceholder")}
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="mb-2"
                />
                <Select value={form.studentId} onValueChange={(v) => setForm((f) => ({ ...f, studentId: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("fees.chooseStudent")} /></SelectTrigger>
                  <SelectContent>
                    {filteredStudents.map((s) => {
                      const cls = db.classes.find((c) => c.id === s.classId);
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          {s.firstName} {s.lastName} {cls ? `— ${cls.name}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </>
            )}
          </Field>
          <Field label={t("fees.colFeeType")} error={errors.feeTypeId}>
            {db.feeTypes.length === 0 ? (
              <EmptySelectHint
                message={t("quickCreate.noFeeTypes")}
                actionLabel={t("quickCreate.createFeeType")}
                onAction={() => setQuickFeeOpen(true)}
              />
            ) : (
              <Select
                value={form.feeTypeId}
                onValueChange={(v) => {
                  if (v === CREATE_NEW_VALUE) { setQuickFeeOpen(true); return; }
                  const fee = db.feeTypes.find((f) => f.id === v);
                  setForm((f) => ({
                    ...f,
                    feeTypeId: v,
                    amount: fee ? String(fee.amount) : f.amount,
                    dueDate: fee?.dueDate || f.dueDate,
                  }));
                }}
              >
                <SelectTrigger><SelectValue placeholder={t("fees.chooseFeeType")} /></SelectTrigger>
                <SelectContent>
                  {db.feeTypes.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name} — {fcfa(f.amount)}</SelectItem>
                  ))}
                  <CreateNewOption label={t("quickCreate.createFeeType")} />
                </SelectContent>
              </Select>
            )}
          </Field>
          <QuickCreateFeeTypeDialog
            open={quickFeeOpen}
            onOpenChange={setQuickFeeOpen}
            onCreated={(id) => {
              setForm((f) => {
                const fee = getDB().feeTypes.find((x) => x.id === id);
                return {
                  ...f,
                  feeTypeId: id,
                  amount: fee ? String(fee.amount) : f.amount,
                  dueDate: fee?.dueDate || f.dueDate,
                };
              });
              setErrors((e) => ({ ...e, feeTypeId: "" }));
            }}
          />

          <Field label={t("fees.fieldAmount")} error={errors.amount}>
            <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          </Field>
          <Field label={t("fees.fieldDueDate")} error={errors.dueDate}>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
          </Field>
          <Field label={t("fees.fieldNotes")} error={errors.notes}>
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
          </Field>

          <div className="rounded-lg border bg-muted/40 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={payNow}
                onChange={(e) => {
                  const on = e.target.checked;
                  setPayNow(on);
                  if (on && !payForm.amount && invoiceAmount > 0) {
                    setPayForm((p) => ({ ...p, amount: String(invoiceAmount) }));
                  }
                }}
                className="h-4 w-4"
              />
              {t("fees.payNowCheckbox")}
            </label>
            {payNow && (
              <div className="mt-3 space-y-3">
                <Field label={t("fees.fieldAmountPaid")} error={errors.pay_amount}>
                  <Input
                    type="number"
                    value={payForm.amount}
                    placeholder={String(invoiceAmount)}
                    onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
                  />
                </Field>
                <Field label={t("fees.fieldPaymentMode")} error={errors.pay_mode}>
                  <Select value={payForm.mode} onValueChange={(v) => setPayForm((p) => ({ ...p, mode: v as PaymentMode }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("fees.fieldPaymentReference")} error={errors.pay_reference}>
                  <Input
                    value={payForm.reference}
                    onChange={(e) => setPayForm((p) => ({ ...p, reference: e.target.value }))}
                    placeholder={payForm.mode === "Espèces" ? t("fees.refOptional") : t("fees.refRequired")}
                  />
                </Field>
                <Field label={t("fees.fieldPaymentDate")} error={errors.pay_date}>
                  <Input
                    type="date"
                    value={payForm.date}
                    onChange={(e) => setPayForm((p) => ({ ...p, date: e.target.value }))}
                  />
                </Field>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>{t("common.cancel")}</Button>
          <Button onClick={submit} disabled={submitting}>
            {payNow ? t("fees.createAndCollect") : t("fees.createInvoiceBtn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/* ============================ PAYMENT MODAL ============================ */

function PaymentModal({
  invoice,
  onClose,
  onPaid,
}: {
  invoice: Payment;
  onClose: () => void;
  onPaid: (rec: PaymentRecord) => void;
}) {
  const { t } = useTranslation();
  const db = useDB();
  const student = db.students.find((s) => s.id === invoice.studentId);
  const cls = student ? db.classes.find((c) => c.id === student.classId) : undefined;
  const remaining = invoice.amount - (invoice.amountPaid ?? 0);

  const [form, setForm] = useState({
    amount: String(remaining),
    mode: "Espèces" as PaymentMode,
    reference: "",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const schema = z
    .object({
      amount: z.coerce.number().positive("Montant invalide").max(remaining, `Maximum ${fcfa(remaining)}`),
      mode: z.enum(PAYMENT_MODES as [PaymentMode, ...PaymentMode[]], { message: "Mode requis" }),
      reference: z.string().max(60).optional(),
      date: z.string().min(1, "Date requise"),
      notes: z.string().max(300).optional(),
    })
    .superRefine((val, ctx) => {
      const needsRef = val.mode === "MTN Mobile Money" || val.mode === "Orange Money";
      if (needsRef && (!val.reference || val.reference.trim().length === 0)) {
        ctx.addIssue({ code: "custom", path: ["reference"], message: "Référence requise pour Mobile Money" });
      }
    });

  const submit = () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    const data = parsed.data;
    const receiptNumber = nextReceiptNumber();
    const recordId = crypto.randomUUID();
    const newRecord: PaymentRecord = {
      id: recordId,
      receiptNumber,
      invoiceId: invoice.id,
      studentId: invoice.studentId,
      amount: data.amount,
      mode: data.mode,
      reference: data.reference,
      date: data.date,
      notes: data.notes,
    };
    updateDB((d) => {
      const inv = d.payments.find((p) => p.id === invoice.id);
      if (!inv) return;
      inv.amountPaid = (inv.amountPaid ?? 0) + data.amount;
      inv.mode = data.mode;
      inv.reference = data.reference;
      inv.date = data.date;
      inv.status = deriveInvoiceStatus(inv.amount, inv.amountPaid, inv.dueDate);
      d.paymentRecords.unshift(newRecord);
      d.activities.unshift({
        id: crypto.randomUUID(),
        type: "payment",
        text: `Paiement de ${fcfa(data.amount)} (${data.mode}) — ${student ? student.firstName + " " + student.lastName : ""}`,
        date: new Date().toISOString(),
      });
    });
    toast.success(`Paiement enregistré — Reçu N° ${receiptNumber}`);
    onPaid(newRecord);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t("fees.collectPayment")}</DialogTitle></DialogHeader>
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="font-semibold">{student ? `${student.firstName} ${student.lastName}` : "—"}{cls ? ` — ${cls.name}` : ""}</div>
          <div className="text-muted-foreground">{t("fees.colInvoiceNo")} {invoice.invoiceNumber} • {invoice.type}</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div><div className="text-xs text-muted-foreground">{t("common.total")}</div><div className="font-semibold">{fcfa(invoice.amount)}</div></div>
            <div><div className="text-xs text-muted-foreground">{t("fees.colAmountPaid")}</div><div className="font-semibold">{fcfa(invoice.amountPaid ?? 0)}</div></div>
            <div><div className="text-xs text-muted-foreground">{t("fees.colRemaining")}</div><div className="font-semibold text-destructive">{fcfa(remaining)}</div></div>
          </div>
        </div>
        <div className="space-y-4">
          <Field label={t("fees.fieldAmountToCollect")} error={errors.amount}>
            <Input
              type="number"
              value={form.amount}
              placeholder={String(remaining)}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </Field>
          <Field label={t("fees.fieldPaymentMode")} error={errors.mode}>
            <Select value={form.mode} onValueChange={(v) => setForm((f) => ({ ...f, mode: v as PaymentMode }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("fees.fieldReceiptRef")} error={errors.reference}>
            <Input
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              placeholder={form.mode === "Espèces" ? t("fees.refOptional") : t("fees.refRequired")}
            />
          </Field>
          <Field label={t("fees.fieldPaymentDate")} error={errors.date}>
            <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </Field>
          <Field label={t("fees.fieldNotes")}>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={submit}>{t("fees.collect")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================ INVOICE DETAIL ============================ */

function InvoiceDetailModal({ invoice, onClose }: { invoice: Payment; onClose: () => void }) {
  const db = useDB();
  const s = db.students.find((x) => x.id === invoice.studentId);
  const cls = s ? db.classes.find((c) => c.id === s.classId) : undefined;
  const records = db.paymentRecords.filter((r) => r.invoiceId === invoice.id);
  const status = deriveInvoiceStatus(invoice.amount, invoice.amountPaid, invoice.dueDate);
  const st = STATUS_LABELS[status];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Facture {invoice.invoiceNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Statut</span>
            <Badge className={st.cls}>{st.label}</Badge>
          </div>
          <Row label="Élève" value={s ? `${s.firstName} ${s.lastName}` : "—"} />
          <Row label="Classe" value={cls?.name || "—"} />
          <Row label="Type" value={invoice.type} />
          <Row label="Montant" value={fcfa(invoice.amount)} />
          <Row label="Payé" value={fcfa(invoice.amountPaid)} />
          <Row label="Reste" value={fcfa(invoice.amount - invoice.amountPaid)} />
          <Row label="Échéance" value={invoice.dueDate || "—"} />
          {invoice.notes && <Row label="Notes" value={invoice.notes} />}
          <div className="pt-2">
            <div className="mb-2 font-semibold">Historique des paiements</div>
            {records.length === 0 ? (
              <div className="text-muted-foreground">Aucun paiement enregistré.</div>
            ) : (
              <div className="space-y-1.5">
                {records.map((r) => (
                  <div key={r.id} className="flex justify-between rounded border px-3 py-1.5">
                    <span className="font-mono text-xs">{r.receiptNumber}</span>
                    <span>{r.date}</span>
                    <span className="text-muted-foreground">{r.mode}</span>
                    <span className="font-semibold">{fcfa(r.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/* ============================ RECEIPT MODAL ============================ */

function ReceiptModal({ record, onClose }: { record: PaymentRecord; onClose: () => void }) {
  const db = useDB();
  const student = db.students.find((s) => s.id === record.studentId);
  const cls = student ? db.classes.find((c) => c.id === student.classId) : undefined;
  const invoice = db.payments.find((p) => p.id === record.invoiceId);
  const school = db.schools[0];
  const remaining = invoice ? invoice.amount - invoice.amountPaid : 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Reçu de paiement</DialogTitle></DialogHeader>
        <div id="receipt-print" className="rounded-lg border bg-background p-5 text-sm">
          <div className="mb-3 border-b pb-3 text-center">
            <div className="text-base font-bold">{school?.name}</div>
            <div className="text-xs text-muted-foreground">{school?.city}, {school?.country}</div>
            <div className="text-xs text-muted-foreground">Tél : {school?.phone}</div>
          </div>
          <div className="mb-3 text-center">
            <div className="text-sm font-semibold uppercase tracking-wide">Reçu de paiement</div>
            <div className="font-mono text-xs">N° {record.receiptNumber}</div>
            <div className="text-xs text-muted-foreground">Date : {record.date}</div>
          </div>
          <div className="space-y-1.5 border-t border-b py-3">
            <Row label="Reçu de" value={student?.parentName || "—"} />
            <Row label="Élève" value={student ? `${student.firstName} ${student.lastName}` : "—"} />
            <Row label="Classe" value={cls?.name || "—"} />
            <Row label="Au titre de" value={invoice?.type || "—"} />
            <Row label="Montant" value={fcfa(record.amount)} />
            <div className="text-xs italic text-muted-foreground">En lettres : {amountInWords(record.amount)}</div>
            <Row label="Mode" value={record.mode} />
            {record.reference && <Row label="Référence" value={record.reference} />}
          </div>
          <div className="py-3">
            <Row label="Reste à payer" value={fcfa(remaining)} />
          </div>
          <div className="mt-4 pt-6 text-xs">
            <div>Signature Caissier :</div>
            <div className="mt-6 border-t pt-1">_____________________</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
          <Button onClick={() => printReceipt()}><Printer className="mr-1.5 h-4 w-4" /> Imprimer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function printReceipt() {
  const node = document.getElementById("receipt-print");
  if (!node) return;
  const w = window.open("", "_blank", "width=420,height=600");
  if (!w) return;
  w.document.write(
    `<html><head><title>Reçu</title><style>body{font-family:sans-serif;padding:20px;color:#111} .row{display:flex;justify-content:space-between;margin:4px 0} hr{border:none;border-top:1px solid #ddd;margin:8px 0}</style></head><body>${node.innerHTML}</body></html>`,
  );
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
    w.close();
  }, 250);
}

/* ============================ HISTORY ============================ */

function HistoryTab({ loaded }: { loaded: boolean }) {
  const db = useDB();
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [receipt, setReceipt] = useState<PaymentRecord | null>(null);

  const studentMap = useMemo(() => Object.fromEntries(db.students.map((s) => [s.id, s])), [db.students]);
  const classMap = useMemo(() => Object.fromEntries(db.classes.map((c) => [c.id, c])), [db.classes]);
  const invMap = useMemo(() => Object.fromEntries(db.payments.map((p) => [p.id, p])), [db.payments]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.paymentRecords
      .filter((r) => {
        if (from && r.date < from) return false;
        if (to && r.date > to) return false;
        if (modeFilter !== "all" && r.mode !== modeFilter) return false;
        const s = studentMap[r.studentId];
        if (classFilter !== "all" && s?.classId !== classFilter) return false;
        if (q) {
          const name = s ? `${s.firstName} ${s.lastName}`.toLowerCase() : "";
          const rec = (r.receiptNumber || "").toLowerCase();
          if (!name.includes(q) && !rec.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [db.paymentRecords, studentMap, search, from, to, classFilter, modeFilter]);

  const exportCSV = () => {
    const headers = ["Date", "Reçu", "Élève", "Classe", "Type", "Mode", "Référence", "Montant"];
    const lines = rows.map((r) => {
      const s = studentMap[r.studentId];
      const cls = s ? classMap[s.classId] : undefined;
      const inv = invMap[r.invoiceId];
      return [
        r.date,
        r.receiptNumber,
        s ? `${s.firstName} ${s.lastName}` : "",
        cls?.name || "",
        inv?.type || "",
        r.mode,
        r.reference || "",
        r.amount,
      ];
    });
    const csv = [csvRow(headers), ...lines.map(csvRow)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paiements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:flex md:flex-wrap md:items-end">
            <div className="flex flex-col gap-1 md:w-64">
              <Label htmlFor="hist-search" className="text-xs">Rechercher</Label>
              <Input id="hist-search" placeholder="Rechercher un élève ou un reçu..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1 md:w-40">
              <Label htmlFor="hist-from" className="text-xs">Du</Label>
              <Input id="hist-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1 md:w-40">
              <Label htmlFor="hist-to" className="text-xs">Au</Label>
              <Input id="hist-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1 md:w-40">
              <Label className="text-xs">Classe</Label>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes classes</SelectItem>
                  {db.classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 md:w-44">
              <Label className="text-xs">Mode de paiement</Label>
              <Select value={modeFilter} onValueChange={setModeFilter}>
                <SelectTrigger><SelectValue placeholder="Mode" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous modes</SelectItem>
                  {PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button variant="outline" onClick={exportCSV}><Download className="mr-1.5 h-4 w-4" /> Exporter CSV</Button>
        </div>

        {!loaded ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={Receipt} title="Aucun paiement" description="L'historique des paiements apparaîtra ici." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Élève</TableHead>
                  <TableHead>Type frais</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>N° Reçu</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const s = studentMap[r.studentId];
                  const inv = invMap[r.invoiceId];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{r.date}</TableCell>
                      <TableCell className="font-medium">{s ? `${s.firstName} ${s.lastName}` : "—"}</TableCell>
                      <TableCell className="text-sm">{inv?.type || "—"}</TableCell>
                      <TableCell className="font-semibold">{fcfa(r.amount)}</TableCell>
                      <TableCell className="text-sm">{r.mode}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.reference || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.receiptNumber}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => setReceipt(r)} title="Imprimer le reçu">
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {receipt && <ReceiptModal record={receipt} onClose={() => setReceipt(null)} />}
    </Card>
  );
}

/* ============================ FEE TYPES ============================ */

const feeSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(60),
  amount: z.coerce.number().positive("Montant invalide"),
  scope: z.enum(FEE_SCOPES as [FeeLevelScope, ...FeeLevelScope[]]),
  dueDate: z.string().optional(),
});

function FeeTypesTab() {
  const db = useDB();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FeeType | null>(null);
  const [removing, setRemoving] = useState<FeeType | null>(null);
  const [form, setForm] = useState({ name: "", amount: "", scope: "Tous" as FeeLevelScope, dueDate: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const startCreate = () => {
    setEditing(null);
    setForm({ name: "", amount: "", scope: "Tous", dueDate: "" });
    setErrors({});
    setOpen(true);
  };
  const startEdit = (f: FeeType) => {
    setEditing(f);
    setForm({ name: f.name, amount: String(f.amount), scope: f.scope, dueDate: f.dueDate || "" });
    setErrors({});
    setOpen(true);
  };
  const submit = () => {
    const parsed = feeSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    const data = parsed.data;
    updateDB((d) => {
      if (editing) {
        const f = d.feeTypes.find((x) => x.id === editing.id);
        if (f) Object.assign(f, data);
      } else {
        d.feeTypes.push({ id: crypto.randomUUID(), ...data });
      }
    });
    toast.success(editing ? "Type de frais modifié" : "Type de frais créé");
    setOpen(false);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4 flex justify-end">
          <Button onClick={startCreate}><Plus className="mr-1.5 h-4 w-4" /> Ajouter un type de frais</Button>
        </div>
        {db.feeTypes.length === 0 ? (
          <EmptyState icon={FileText} title="Aucun type de frais" description="Créez vos types de frais pour générer des factures." actionLabel="Ajouter" onAction={startCreate} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {db.feeTypes.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell className="font-semibold">{fcfa(f.amount)}</TableCell>
                  <TableCell><Badge variant="outline">{f.scope}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{f.dueDate || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(f)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setRemoving(f)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Modifier le type de frais" : "Ajouter un type de frais"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Field label="Nom" error={errors.name}>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Scolarité T1" />
            </Field>
            <Field label="Montant (FCFA)" error={errors.amount}>
              <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </Field>
            <Field label="Niveau applicable" error={errors.scope}>
              <Select value={form.scope} onValueChange={(v) => setForm((f) => ({ ...f, scope: v as FeeLevelScope }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FEE_SCOPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date d'échéance (optionnel)">
              <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit}>{editing ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce type de frais ?</AlertDialogTitle>
            <AlertDialogDescription>Les factures existantes ne seront pas affectées.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const id = removing!.id;
                updateDB((d) => { d.feeTypes = d.feeTypes.filter((x) => x.id !== id); });
                toast.success("Supprimé");
                setRemoving(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/* ============================ HELPERS ============================ */

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
