import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Save, X, HeartPulse, Phone, AlertTriangle } from "lucide-react";
import { useMedicalInfo, type MedicalInfo } from "@/lib/student-extras";
import { toast } from "sonner";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

interface Props {
  studentId: string;
  canEdit: boolean;
}

export function MedicalTab({ studentId, canEdit }: Props) {
  const { data, loading, save } = useMedicalInfo(studentId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<MedicalInfo>(data);
  const [saving, setSaving] = useState(false);

  const start = () => { setForm(data); setEditing(true); };
  const cancel = () => { setEditing(false); };
  const submit = async () => {
    setSaving(true);
    const { error } = await save(form);
    setSaving(false);
    if (error) toast.error("Échec de l'enregistrement"); else { toast.success("Informations médicales enregistrées"); setEditing(false); }
  };

  if (loading) return <Card><CardContent className="p-8 text-center text-muted-foreground">Chargement…</CardContent></Card>;

  if (editing) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><HeartPulse className="h-4 w-4 text-destructive" /> Informations médicales</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}><X className="mr-1 h-4 w-4" /> Annuler</Button>
            <Button size="sm" onClick={submit} disabled={saving}><Save className="mr-1 h-4 w-4" /> {saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Groupe sanguin">
            <Select value={form.blood_group ?? ""} onValueChange={(v) => setForm({ ...form, blood_group: v || null })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {BLOOD_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <TextField label="Allergies" value={form.allergies} onChange={(v) => setForm({ ...form, allergies: v })} placeholder="ex. arachides, pollen…" />
          <TextField label="Maladies chroniques" value={form.chronic_conditions} onChange={(v) => setForm({ ...form, chronic_conditions: v })} placeholder="ex. asthme, diabète…" />
          <TextField label="Traitements en cours" value={form.medications} onChange={(v) => setForm({ ...form, medications: v })} />
          <div className="md:col-span-2">
            <TextField label="Vaccinations" value={form.vaccinations} onChange={(v) => setForm({ ...form, vaccinations: v })} placeholder="ex. DTP à jour, ROR…" />
          </div>

          <div className="md:col-span-2"><h3 className="mb-2 mt-2 text-sm font-semibold">Contact d'urgence</h3></div>
          <Field label="Nom"><Input value={form.emergency_contact_name ?? ""} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value || null })} /></Field>
          <Field label="Téléphone"><Input value={form.emergency_contact_phone ?? ""} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value || null })} /></Field>
          <Field label="Lien de parenté"><Input value={form.emergency_contact_relation ?? ""} onChange={(e) => setForm({ ...form, emergency_contact_relation: e.target.value || null })} placeholder="ex. Mère, Oncle…" /></Field>

          <div className="md:col-span-2">
            <Label className="mb-1.5 block">Notes médicales</Label>
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
          <HeartPulse className="h-4 w-4 text-destructive" /> Informations médicales
        </CardTitle>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={start}><Pencil className="mr-1 h-4 w-4" /> Modifier</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {hasAlert && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Attention — informations sensibles</p>
              {data.allergies?.trim() && <p>Allergies : {data.allergies}</p>}
              {data.chronic_conditions?.trim() && <p>Maladies chroniques : {data.chronic_conditions}</p>}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2 text-sm">
          <Row label="Groupe sanguin" value={data.blood_group} />
          <Row label="Allergies" value={data.allergies} />
          <Row label="Maladies chroniques" value={data.chronic_conditions} />
          <Row label="Traitements en cours" value={data.medications} />
          <div className="md:col-span-2"><Row label="Vaccinations" value={data.vaccinations} /></div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Contact d'urgence</h3>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-3 text-sm">
            <Row label="Nom" value={data.emergency_contact_name} />
            <Row label="Téléphone" value={data.emergency_contact_phone ? (
              <a href={`tel:${data.emergency_contact_phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                <Phone className="h-3.5 w-3.5" /> {data.emergency_contact_phone}
              </a>
            ) : null} />
            <Row label="Lien de parenté" value={data.emergency_contact_relation} />
          </div>
        </div>

        {data.medical_notes?.trim() && (
          <div>
            <h3 className="mb-1 text-sm font-semibold">Notes</h3>
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
