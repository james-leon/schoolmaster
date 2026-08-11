import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Save, X, HeartPulse, Phone, AlertTriangle } from "lucide-react";
import { useMedicalInfo, type MedicalInfo } from "@/lib/student-extras";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { useTranslation } from "react-i18next";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

interface Props {
  studentId: string;
  canEdit: boolean;
}

export function MedicalTab({ studentId, canEdit }: Props) {
  const { t } = useTranslation();
  const { data, loading, save } = useMedicalInfo(studentId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<MedicalInfo>(data);
  const [saving, setSaving] = useState(false);

  // Log medical record view once per student mount (only when loaded).
  const loggedRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading) return;
    if (loggedRef.current === studentId) return;
    loggedRef.current = studentId;
    logAudit({ action: "medical_record_viewed", targetType: "student", targetId: studentId });
  }, [studentId, loading]);

  const start = () => { setForm(data); setEditing(true); };
  const cancel = () => { setEditing(false); };
  const submit = async () => {
    setSaving(true);
    const { error } = await save(form);
    setSaving(false);
    if (error) {
      toast.error(t("parentPortal.medical.saveError"));
    } else {
      toast.success(t("parentPortal.medical.saveSuccess"));
      logAudit({ action: "medical_record_updated", targetType: "student", targetId: studentId });
      setEditing(false);
    }
  };

  if (loading) return <Card><CardContent className="p-8 text-center text-muted-foreground">{t("parentPortal.medical.loading")}</CardContent></Card>;

  if (editing) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><HeartPulse className="h-4 w-4 text-destructive" /> {t("parentPortal.medical.title")}</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}><X className="mr-1 h-4 w-4" /> {t("parentPortal.medical.cancel")}</Button>
            <Button size="sm" onClick={submit} disabled={saving}><Save className="mr-1 h-4 w-4" /> {saving ? t("parentPortal.medical.saving") : t("parentPortal.medical.save")}</Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t("parentPortal.medical.bloodGroup")}>
            <Select value={form.blood_group ?? ""} onValueChange={(v) => setForm({ ...form, blood_group: v || null })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {BLOOD_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <TextField label={t("parentPortal.medical.allergies")} value={form.allergies} onChange={(v) => setForm({ ...form, allergies: v })} placeholder={t("parentPortal.medical.allergiesPlaceholder")} />
          <TextField label={t("parentPortal.medical.chronicConditions")} value={form.chronic_conditions} onChange={(v) => setForm({ ...form, chronic_conditions: v })} placeholder={t("parentPortal.medical.chronicConditionsPlaceholder")} />
          <TextField label={t("parentPortal.medical.medications")} value={form.medications} onChange={(v) => setForm({ ...form, medications: v })} />
          <div className="md:col-span-2">
            <TextField label={t("parentPortal.medical.vaccinations")} value={form.vaccinations} onChange={(v) => setForm({ ...form, vaccinations: v })} placeholder={t("parentPortal.medical.vaccinationsPlaceholder")} />
          </div>

          <div className="md:col-span-2"><h3 className="mb-2 mt-2 text-sm font-semibold">{t("parentPortal.medical.emergencyContact")}</h3></div>
          <Field label={t("parentPortal.medical.name")}><Input value={form.emergency_contact_name ?? ""} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value || null })} /></Field>
          <Field label={t("parentPortal.medical.phone")}><Input value={form.emergency_contact_phone ?? ""} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value || null })} /></Field>
          <Field label={t("parentPortal.medical.relation")}><Input value={form.emergency_contact_relation ?? ""} onChange={(e) => setForm({ ...form, emergency_contact_relation: e.target.value || null })} placeholder={t("parentPortal.medical.relationPlaceholder")} /></Field>

          <div className="md:col-span-2">
            <Label className="mb-1.5 block">{t("parentPortal.medical.notes")}</Label>
            <Textarea rows={4} value={form.medical_notes ?? ""} onChange={(e) => setForm({ ...form, medical_notes: e.target.value || null })} />
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasAlert = !!(data.allergies?.trim() || data.chronic_conditions?.trim());

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-destructive" /> {t("parentPortal.medical.title")}
        </CardTitle>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={start}><Pencil className="mr-1 h-4 w-4" /> {t("parentPortal.medical.edit")}</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {hasAlert && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">{t("parentPortal.medical.alertTitle")}</p>
              {data.allergies?.trim() && <p>{t("parentPortal.medical.alertAllergies", { value: data.allergies })}</p>}
              {data.chronic_conditions?.trim() && <p>{t("parentPortal.medical.alertChronic", { value: data.chronic_conditions })}</p>}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2 text-sm">
          <Row label={t("parentPortal.medical.bloodGroup")} value={data.blood_group} />
          <Row label={t("parentPortal.medical.allergies")} value={data.allergies} />
          <Row label={t("parentPortal.medical.chronicConditions")} value={data.chronic_conditions} />
          <Row label={t("parentPortal.medical.medications")} value={data.medications} />
          <div className="md:col-span-2"><Row label={t("parentPortal.medical.vaccinations")} value={data.vaccinations} /></div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">{t("parentPortal.medical.emergencyContact")}</h3>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-3 text-sm">
            <Row label={t("parentPortal.medical.name")} value={data.emergency_contact_name} />
            <Row label={t("parentPortal.medical.phone")} value={data.emergency_contact_phone ? (
              <a href={`tel:${data.emergency_contact_phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                <Phone className="h-3.5 w-3.5" /> {data.emergency_contact_phone}
              </a>
            ) : null} />
            <Row label={t("parentPortal.medical.relation")} value={data.emergency_contact_relation} />
          </div>
        </div>

        {data.medical_notes?.trim() && (
          <div>
            <h3 className="mb-1 text-sm font-semibold">{t("parentPortal.medical.notesTitle")}</h3>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{data.medical_notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: {
  label: string; value: string | null; onChange: (v: string | null) => void; placeholder?: string;
}) {
  return (
    <Field label={label}>
      <Input value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value || null)} />
    </Field>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}
