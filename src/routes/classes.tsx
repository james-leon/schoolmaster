import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useLoaded, TableSkeleton, EmptyState } from "@/components/shared";
import { useDB, updateDB } from "@/lib/store";
import { fcfa } from "@/lib/format";
import { LEVELS, type Level, type Classe, type ClassSubject } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus, Pencil, Trash2, Users } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

export const Route = createFileRoute("/classes")({ component: ClassesPage });

const schema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(40),
  level: z.enum(LEVELS as [Level, ...Level[]], { message: "Niveau requis" }),
  capacity: z.coerce.number().int().positive("Capacité invalide").max(200),
  teacherId: z.string().min(1, "Enseignant requis"),
  fees: z.coerce.number().nonnegative("Frais invalides"),
});

type FormState = { name: string; level: string; capacity: string; teacherId: string; fees: string };
const empty: FormState = { name: "", level: "CP", capacity: "30", teacherId: "", fees: "150000" };

function ClassesPage() {
  const db = useDB();
  const loaded = useLoaded();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Classe | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<Classe | null>(null);
  const [subjectsFor, setSubjectsFor] = useState<Classe | null>(null);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => { setEditing(null); setForm(empty); setErrors({}); setOpen(true); };
  const openEdit = (c: Classe) => {
    setEditing(c);
    setForm({ name: c.name, level: c.level, capacity: String(c.capacity), teacherId: c.teacherId, fees: String(c.fees) });
    setErrors({});
    setOpen(true);
  };

  const submit = () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    const data = parsed.data;
    updateDB((d) => {
      if (editing) {
        const c = d.classes.find((x) => x.id === editing.id);
        if (c) Object.assign(c, data);
      } else {
        d.classes.push({ id: "class-" + Math.random().toString(36).slice(2, 9), ...data });
      }
    });
    toast.success(editing ? "Classe modifiée" : "Classe créée");
    setOpen(false);
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    updateDB((d) => { d.classes = d.classes.filter((c) => c.id !== id); });
    toast.success("Classe supprimée");
    setToDelete(null);
  };

  return (
    <AppLayout title="Classes">
      <div className="mb-4 flex justify-end">
        <Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Nouvelle classe</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {!loaded ? (
            <TableSkeleton rows={5} cols={5} />
          ) : db.classes.length === 0 ? (
            <EmptyState icon={BookOpen} title="Aucune classe" description="Créez votre première classe." actionLabel="Nouvelle classe" onAction={openNew} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Classe</TableHead>
                  <TableHead>Niveau</TableHead>
                  <TableHead>Enseignant</TableHead>
                  <TableHead>Effectif / Capacité</TableHead>
                  <TableHead>Frais</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {db.classes.map((c) => {
                  const count = db.students.filter((s) => s.classId === c.id).length;
                  const teacher = db.teachers.find((t) => t.id === c.teacherId);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell><Badge variant="outline">{c.level}</Badge></TableCell>
                      <TableCell>{teacher ? `${teacher.firstName} ${teacher.lastName}` : "—"}</TableCell>
                      <TableCell className="text-muted-foreground"><Users className="mr-1 inline h-4 w-4" />{count} / {c.capacity}</TableCell>
                      <TableCell className="font-semibold">{fcfa(c.fees)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setSubjectsFor(c)} aria-label="Matières"><BookOpen className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setToDelete(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Modifier la classe" : "Nouvelle classe"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nom" error={errors.name}>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="ex: CP-A" />
            </Field>
            <Field label="Niveau" error={errors.level}>
              <Select value={form.level} onValueChange={(v) => set("level", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Capacité" error={errors.capacity}>
              <Input type="number" value={form.capacity} onChange={(e) => set("capacity", e.target.value)} />
            </Field>
            <Field label="Frais (FCFA)" error={errors.fees}>
              <Input type="number" value={form.fees} onChange={(e) => set("fees", e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Enseignant" error={errors.teacherId}>
                <Select value={form.teacherId} onValueChange={(v) => set("teacherId", v)}>
                  <SelectTrigger><SelectValue placeholder="Choisir un enseignant" /></SelectTrigger>
                  <SelectContent>
                    {db.teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit}>{editing ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette classe ?</AlertDialogTitle>
            <AlertDialogDescription>
              La classe « {toDelete?.name} » sera définitivement supprimée. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
