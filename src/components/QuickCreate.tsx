import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateDB } from "@/lib/store";
import { LEVELS, LEVEL_LABELS, FEE_SCOPES, type Level, type FeeLevelScope } from "@/lib/types";

/** Sentinel value used for the "+ Create new…" row inside a <Select>. */
export const CREATE_NEW_VALUE = "__create_new__";

/**
 * Inline empty-state shown under (or instead of) a dropdown whose options
 * depend on data the school hasn't created yet. Keeps the surrounding form
 * mounted so the user never loses what they already typed.
 */
export function EmptySelectHint({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/40 p-3">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      {actionLabel && onAction && (
        <Button type="button" size="sm" variant="outline" className="mt-3" onClick={onAction}>
          <Plus className="mr-1.5 h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

/** "+ Créer nouveau…" row rendered at the bottom of a <SelectContent>. */
export function CreateNewOption({ label }: { label: string }) {
  return (
    <SelectItem value={CREATE_NEW_VALUE} className="text-primary font-medium">
      + {label}
    </SelectItem>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** Quick-create a class from inside another form. Returns the new id. */
export function QuickCreateClassDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (classId: string) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level>("CP" as Level);
  const [capacity, setCapacity] = useState("30");
  const [fees, setFees] = useState("");

  const reset = () => { setName(""); setLevel("CP" as Level); setCapacity("30"); setFees(""); };

  const submit = () => {
    const n = name.trim();
    if (!n) { toast.error(t("quickCreate.nameRequired")); return; }
    const id = crypto.randomUUID();
    updateDB((d) => {
      d.classes.push({
        id,
        name: n,
        level,
        capacity: Number(capacity) || 30,
        fees: Number(fees) || 0,
        teacherId: "",
      });
    });
    toast.success(t("quickCreate.classCreated"));
    onCreated(id);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("quickCreate.classTitle")}</DialogTitle>
          <DialogDescription>{t("quickCreate.keepProgress")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t("quickCreate.className")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="CP A" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("quickCreate.classLevel")}>
              <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => <SelectItem key={l} value={l}>{l} — {LEVEL_LABELS[l]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("quickCreate.classCapacity")}>
              <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </Field>
          </div>
          <Field label={t("quickCreate.classFees")}>
            <Input type="number" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="150000" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={submit}>{t("common.create")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Quick-create a fee type from inside another form. */
export function QuickCreateFeeTypeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (feeTypeId: string) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [scope, setScope] = useState<FeeLevelScope>("Tous");

  const reset = () => { setName(""); setAmount(""); setScope("Tous"); };

  const submit = () => {
    const n = name.trim();
    const amt = Number(amount);
    if (!n) { toast.error(t("quickCreate.nameRequired")); return; }
    if (!Number.isFinite(amt) || amt <= 0) { toast.error(t("quickCreate.amountRequired")); return; }
    const id = crypto.randomUUID();
    updateDB((d) => {
      d.feeTypes.push({ id, name: n, amount: amt, scope });
    });
    toast.success(t("quickCreate.feeTypeCreated"));
    onCreated(id);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("quickCreate.feeTypeTitle")}</DialogTitle>
          <DialogDescription>{t("quickCreate.keepProgress")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t("quickCreate.feeTypeName")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Scolarité T1" autoFocus />
          </Field>
          <Field label={t("quickCreate.feeTypeAmount")}>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label={t("quickCreate.feeTypeScope")}>
            <Select value={scope} onValueChange={(v) => setScope(v as FeeLevelScope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FEE_SCOPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={submit}>{t("common.create")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
