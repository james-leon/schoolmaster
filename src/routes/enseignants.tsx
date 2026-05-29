import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useLoaded, TableSkeleton, EmptyState } from "@/components/shared";
import { useDB, updateDB } from "@/lib/store";
import { SUBJECTS, type Teacher } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { GraduationCap, Plus, Pencil, Trash2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

export const Route = createFileRoute("/enseignants")({ component: EnseignantsPage });

const schema = z.object({
  firstName: z.string().trim().min(2, "Prénom requis").max(60),
  lastName: z.string().trim().min(2, "Nom requis").max(60),
  email: z.string().trim().email("Email invalide"),
  phone: z.string().trim().min(6, "Téléphone invalide").max(30),
  subjects: z.array(z.string()).min(1, "Au moins une matière"),
});

type FormState = { firstName: string; lastName: string; email: string; phone: string; subjects: string[] };
const empty: FormState = { firstName: "", lastName: "", email: "", phone: "", subjects: [] };

function EnseignantsPage() {
  const db = useDB();
  const loaded = useLoaded();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<Teacher | null>(null);

  const openNew = () => { setEditing(null); setForm(empty); setErrors({}); setOpen(true); };
  const openEdit = (t: Teacher) => {
    setEditing(t);
    setForm({ firstName: t.firstName, lastName: t.lastName, email: t.email, phone: t.phone, subjects: t.subjects ?? [t.subject].filter(Boolean) });
    setErrors({});
    setOpen(true);
  };

  const toggleSubject = (s: string) => {
    setForm((f) => ({ ...f, subjects: f.subjects.includes(s) ? f.subjects.filter((x) => x !== s) : [...f.subjects, s] }));
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
        const t = d.teachers.find((x) => x.id === editing.id);
        if (t) Object.assign(t, data, { subject: data.subjects[0] });
      } else {
        d.teachers.push({ id: "teacher-" + Math.random().toString(36).slice(2, 9), ...data, subject: data.subjects[0] });
      }
    });
    toast.success(editing ? "Enseignant modifié" : "Enseignant ajouté");
    setOpen(false);
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    updateDB((d) => { d.teachers = d.teachers.filter((t) => t.id !== id); });
    toast.success("Enseignant supprimé");
    setToDelete(null);
  };

  return (
    <AppLayout title="Enseignants">
      <div className="mb-4 flex justify-end">
        <Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Nouvel enseignant</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {!loaded ? (
            <TableSkeleton rows={4} cols={5} />
          ) : db.teachers.length === 0 ? (
            <EmptyState icon={GraduationCap} title="Aucun enseignant" description="Ajoutez le premier membre de l'équipe pédagogique." actionLabel="Nouvel enseignant" onAction={openNew} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom complet</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Matières</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {db.teachers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.firstName} {t.lastName}</TableCell>
                    <TableCell className="text-muted-foreground">{t.email}</TableCell>
                    <TableCell className="text-muted-foreground">{t.phone}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(t.subjects ?? [t.subject]).map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setToDelete(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Modifier l'enseignant" : "Nouvel enseignant"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Prénom" error={errors.firstName}>
              <Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
            </Field>
            <Field label="Nom" error={errors.lastName}>
              <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="Téléphone" error={errors.phone}>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Matières enseignées" error={errors.subjects}>
                <div className="grid grid-cols-2 gap-2 rounded-md border border-border p-3">
                  {SUBJECTS.map((s) => (
                    <label key={s} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox checked={form.subjects.includes(s)} onCheckedChange={() => toggleSubject(s)} />
                      {s}
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit}>{editing ? "Enregistrer" : "Ajouter"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet enseignant ?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.firstName} {toDelete?.lastName} sera définitivement supprimé(e).
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
