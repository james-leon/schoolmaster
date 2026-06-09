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

interface Props {
  studentId: string;
  schoolId: string | undefined;
  canAdd: boolean;
  /** If true, hide all controls (admin/teacher) and show read-only timeline. */
  readOnly?: boolean;
}

export function DisciplineTab({ studentId, schoolId, canAdd, readOnly }: Props) {
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
            <p className="text-xs text-muted-foreground">Observations positives</p>
            <p className="text-xl font-bold text-success">{stats.positive}</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/15 text-destructive"><ShieldAlert className="h-4 w-4" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Incidents / sanctions</p>
            <p className="text-xl font-bold text-destructive">{stats.negative}</p>
          </div>
        </CardContent></Card>
      </div>

      {!readOnly && canAdd && schoolId && (
        <div className="flex justify-end">
          <AddRecordDialog onAdd={async (input) => {
            const { error } = await add({ ...input, schoolId });
            if (error) toast.error("Échec de l'ajout"); else toast.success("Observation enregistrée");
            return !error;
          }} />
        </div>
      )}

      <Card><CardContent className="p-0">
        {loading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : records.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Aucune observation enregistrée.</p>
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
                          Gravité : {r.severity}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{formatDateFr(r.date)}</span>
                    </div>
                    <p className="mt-1.5 font-semibold">{r.title}</p>
                    {r.description && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{r.description}</p>}
                    {r.recorded_by_name && (
                      <p className="mt-1 text-xs text-muted-foreground">Enregistré par {r.recorded_by_name}</p>
                    )}
                  </div>
                  {canDelete && (
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        if (!confirm("Supprimer cette observation ?")) return;
                        const { error } = await remove(r.id);
                        if (error) toast.error("Échec de la suppression"); else toast.success("Observation supprimée");
                      }}
                      aria-label="Supprimer"
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
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DisciplineType>("observation_positive");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<DisciplineSeverity>("faible");
  const [saving, setSaving] = useState(false);

  const reset = () => { setType("observation_positive"); setDate(new Date().toISOString().slice(0, 10)); setTitle(""); setDescription(""); setSeverity("faible"); };

  const submit = async () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    setSaving(true);
    const ok = await onAdd({ date, type, title: title.trim(), description: description.trim() || undefined, severity: type === "incident" ? severity : null });
    setSaving(false);
    if (ok) { reset(); setOpen(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Ajouter une observation</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvelle observation</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as DisciplineType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="observation_positive">Observation positive</SelectItem>
                  <SelectItem value="avertissement">Avertissement</SelectItem>
                  <SelectItem value="sanction">Sanction</SelectItem>
                  <SelectItem value="incident">Incident</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          {type === "incident" && (
            <div>
              <Label className="mb-1.5 block">Gravité</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as DisciplineSeverity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="faible">Faible</SelectItem>
                  <SelectItem value="moyen">Moyen</SelectItem>
                  <SelectItem value="grave">Grave</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="mb-1.5 block">Titre</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. A aidé un camarade" />
          </div>
          <div>
            <Label className="mb-1.5 block">Description</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Annuler</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
