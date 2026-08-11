import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Smile, ShieldAlert } from "lucide-react";
import {
  useDisciplineRecords, DISCIPLINE_TYPE_LABEL, disciplineBadgeClass,
  type DisciplineType, type DisciplineSeverity,
} from "@/lib/student-extras";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface Props {
  studentId: string;
  schoolId: string | undefined;
  canAdd: boolean;
  /** If true, hide all controls (admin/teacher) and show read-only timeline. */
  readOnly?: boolean;
}

export function DisciplineTab({ studentId, schoolId, canAdd, readOnly }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { records, loading, add, remove } = useDisciplineRecords(studentId);

  const stats = useMemo(() => {
    let positive = 0, negative = 0;
    for (const r of records) {
      if (r.type === "observation_positive") positive++;
      else negative++;
    }
    return { positive, negative };
  }, [records]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15 text-success"><Smile className="h-4 w-4" /></div>
          <div>
            <p className="text-xs text-muted-foreground">{t("parentPortal.discipline.positiveObservations")}</p>
            <p className="text-xl font-bold text-success">{stats.positive}</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/15 text-destructive"><ShieldAlert className="h-4 w-4" /></div>
          <div>
            <p className="text-xs text-muted-foreground">{t("parentPortal.discipline.incidentsSanctions")}</p>
            <p className="text-xl font-bold text-destructive">{stats.negative}</p>
          </div>
        </CardContent></Card>
      </div>

      {!readOnly && canAdd && schoolId && (
        <div className="flex justify-end">
          <AddRecordDialog onAdd={async (input) => {
            const { error } = await add({ ...input, schoolId });
            if (error) toast.error(t("parentPortal.discipline.addError")); else toast.success(t("parentPortal.discipline.addSuccess"));
            return !error;
          }} />
        </div>
      )}

      <Card><CardContent className="p-0">
        {loading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{t("parentPortal.discipline.loading")}</p>
        ) : records.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{t("parentPortal.discipline.noRecords")}</p>
        ) : (
          <ul>
            {records.map((r) => {
              const canDelete = !readOnly && (
                user?.role === "school_admin" || user?.role === "super_admin" ||
                (user?.role === "teacher" && r.recorded_by === user.id)
              );
              return (
                <li key={r.id} className="flex items-start gap-3 border-b border-border p-4 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn("border", disciplineBadgeClass(r.type))}>
                        {DISCIPLINE_TYPE_LABEL[r.type]}
                      </Badge>
                      {r.severity && r.type === "incident" && (
                        <Badge variant="outline" className="border-destructive/30 text-destructive">
                          {t("parentPortal.discipline.severity", { value: r.severity })}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{formatDateFr(r.date)}</span>
                    </div>
                    <p className="mt-1.5 font-semibold">{r.title}</p>
                    {r.description && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{r.description}</p>}
                    {r.recorded_by_name && (
                      <p className="mt-1 text-xs text-muted-foreground">{t("parentPortal.discipline.recordedBy", { name: r.recorded_by_name })}</p>
                    )}
                  </div>
                  {canDelete && (
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        if (!confirm(t("parentPortal.discipline.deleteConfirm"))) return;
                        const { error } = await remove(r.id);
                        if (error) toast.error(t("parentPortal.discipline.deleteError")); else toast.success(t("parentPortal.discipline.deleteSuccess"));
                      }}
                      aria-label={t("parentPortal.discipline.delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent></Card>
    </div>
  );
}

function formatDateFr(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch { return iso; }
}

function AddRecordDialog({ onAdd }: {
  onAdd: (input: { date: string; type: DisciplineType; title: string; description?: string; severity?: DisciplineSeverity | null }) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DisciplineType>("observation_positive");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<DisciplineSeverity>("faible");
  const [saving, setSaving] = useState(false);

  const reset = () => { setType("observation_positive"); setDate(new Date().toISOString().slice(0, 10)); setTitle(""); setDescription(""); setSeverity("faible"); };

  const submit = async () => {
    if (!title.trim()) { toast.error(t("parentPortal.discipline.titleRequired")); return; }
    setSaving(true);
    const ok = await onAdd({ date, type, title: title.trim(), description: description.trim() || undefined, severity: type === "incident" ? severity : null });
    setSaving(false);
    if (ok) { reset(); setOpen(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> {t("parentPortal.discipline.addObservation")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("parentPortal.discipline.newObservation")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">{t("parentPortal.discipline.type")}</Label>
              <Select value={type} onValueChange={(v) => setType(v as DisciplineType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="observation_positive">{t("parentPortal.discipline.types.observation_positive")}</SelectItem>
                  <SelectItem value="avertissement">{t("parentPortal.discipline.types.avertissement")}</SelectItem>
                  <SelectItem value="sanction">{t("parentPortal.discipline.types.sanction")}</SelectItem>
                  <SelectItem value="incident">{t("parentPortal.discipline.types.incident")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">{t("parentPortal.discipline.date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          {type === "incident" && (
            <div>
              <Label className="mb-1.5 block">{t("parentPortal.discipline.severityLevel")}</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as DisciplineSeverity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="faible">{t("parentPortal.discipline.severities.faible")}</SelectItem>
                  <SelectItem value="moyen">{t("parentPortal.discipline.severities.moyen")}</SelectItem>
                  <SelectItem value="grave">{t("parentPortal.discipline.severities.grave")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="mb-1.5 block">{t("parentPortal.discipline.title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("parentPortal.discipline.titlePlaceholder")} />
          </div>
          <div>
            <Label className="mb-1.5 block">{t("parentPortal.discipline.description")}</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("parentPortal.discipline.cancel")}</Button>
          <Button onClick={submit} disabled={saving}>{saving ? t("parentPortal.discipline.saving") : t("parentPortal.discipline.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
