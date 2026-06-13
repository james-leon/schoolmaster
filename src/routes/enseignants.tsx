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
import { GraduationCap, Plus, Pencil, Trash2, KeyRound, UserPlus } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { CredentialsModal, type CredentialsInfo } from "@/components/CredentialsModal";
import { hydrateAll } from "@/lib/supabase-sync";
import { useAuth } from "@/lib/auth";
import { usePlan } from "@/lib/usePlan";
import { UpgradeModal } from "@/components/UpgradePrompt";
import { useSchoolTeacherAccounts } from "@/lib/useSchoolTeacherAccounts";

export const Route = createFileRoute("/enseignants")({ component: EnseignantsPage });

const schema = z.object({
  firstName: z.string().trim().min(2, "Prénom requis").max(60),
  lastName: z.string().trim().min(2, "Nom requis").max(60),
  email: z.string().trim().email("Email invalide"),
  phone: z.string().trim().min(6, "Téléphone invalide").max(30),
  subjects: z.array(z.string()).min(1, "Au moins une matière"),
  assignedClasses: z.array(z.string()),
});

type FormState = { firstName: string; lastName: string; email: string; phone: string; subjects: string[]; assignedClasses: string[] };
const empty: FormState = { firstName: "", lastName: "", email: "", phone: "", subjects: [], assignedClasses: [] };

function EnseignantsPage() {
  const db = useDB();
  const { user } = useAuth();
  const loaded = useLoaded();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<Teacher | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<CredentialsInfo | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Teacher | null>(null);
  const school = db.schools.find((s) => s.id === user?.schoolId);
  const { plan, canAddTeacher, limits, teacherCount } = usePlan();
  const { accountFor, refresh: refreshAccounts } = useSchoolTeacherAccounts();

  const openNew = () => {
    if (!canAddTeacher()) { setUpgradeOpen(true); return; }
    setEditing(null); setForm(empty); setErrors({}); setOpen(true);
  };
  const openEdit = (t: Teacher) => {
    setEditing(t);
    setForm({
      firstName: t.firstName, lastName: t.lastName, email: t.email, phone: t.phone,
      subjects: t.subjects ?? [t.subject].filter(Boolean),
      assignedClasses: [],
    });
    setErrors({});
    setOpen(true);
  };

  const toggle = (key: "subjects" | "assignedClasses", v: string) => {
    setForm((f) => ({ ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] }));
  };

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    const data = parsed.data;
    setSubmitting(true);
    try {
      if (editing) {
        updateDB((d) => {
          const t = d.teachers.find((x) => x.id === editing.id);
          if (t) Object.assign(t, data, { subject: data.subjects[0] });
        });
        toast.success("Enseignant modifié");
        setOpen(false);
      } else {
        const res = await adminApi.createTeacher({
          firstName: data.firstName, lastName: data.lastName, email: data.email,
          phone: data.phone, subjects: data.subjects, assignedClasses: data.assignedClasses,
        });
        if (user?.schoolId) await hydrateAll(user.schoolId).catch(() => {});
        setOpen(false);
        setCredentials({
          name: `${data.firstName} ${data.lastName}`,
          email: data.email,
          tempPassword: res.tempPassword,
          role: "teacher",
          schoolName: school?.name,
        });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    updateDB((d) => { d.teachers = d.teachers.filter((t) => t.id !== id); });
    toast.success("Enseignant supprimé");
    setToDelete(null);
  };

  const createAccount = async (t: Teacher) => {
    if (!t.email) { toast.error("Cet enseignant n'a pas d'email"); return; }
    try {
      const res = await adminApi.createTeacherAccount(t.id);
      setCredentials({
        name: `${t.firstName} ${t.lastName}`, email: t.email,
        tempPassword: res.tempPassword, role: "teacher", schoolName: school?.name,
      });
      refreshAccounts();
    } catch (e) { toast.error((e as Error).message); }
  };

  const doResetPassword = async (t: Teacher) => {
    const acc = accountFor(t.email);
    if (!acc) return;
    try {
      const res = await adminApi.resetPassword(acc.id);
      setCredentials({
        name: `${t.firstName} ${t.lastName}`, email: t.email,
        tempPassword: res.tempPassword, role: "teacher", schoolName: school?.name,
      });
      setResetTarget(null);
    } catch (e) { toast.error((e as Error).message); }
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
                  <TableHead>Compte</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {db.teachers.map((t) => {
                  const acc = accountFor(t.email);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.firstName} {t.lastName}</TableCell>
                      <TableCell className="text-muted-foreground">{t.email}</TableCell>
                      <TableCell className="text-muted-foreground">{t.phone}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(t.subjects ?? [t.subject]).map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {acc ? (
                          <Badge className="bg-success/15 text-success hover:bg-success/15">Compte actif</Badge>
                        ) : (
                          <Badge variant="secondary">Aucun compte</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)} title="Modifier"><Pencil className="h-4 w-4" /></Button>
                        {acc ? (
                          <Button variant="ghost" size="icon" onClick={() => setResetTarget(t)} title="Réinitialiser le mot de passe">
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" onClick={() => createAccount(t)} title="Créer un compte" disabled={!t.email}>
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setToDelete(t)} title="Supprimer"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => !submitting && setOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Modifier l'enseignant" : "Nouvel enseignant"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Prénom" error={errors.firstName}>
              <Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
            </Field>
            <Field label="Nom" error={errors.lastName}>
              <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
            </Field>
            <Field label="Email (login)" error={errors.email}>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} disabled={!!editing} />
            </Field>
            <Field label="Téléphone" error={errors.phone}>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Matières enseignées" error={errors.subjects}>
                <div className="grid grid-cols-2 gap-2 rounded-md border border-border p-3">
                  {SUBJECTS.map((s) => (
                    <label key={s} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox checked={form.subjects.includes(s)} onCheckedChange={() => toggle("subjects", s)} />
                      {s}
                    </label>
                  ))}
                </div>
              </Field>
            </div>
            {!editing && (
              <div className="sm:col-span-2">
                <Field label="Classes assignées">
                  {db.classes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucune classe. Créez une classe d'abord.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 rounded-md border border-border p-3 sm:grid-cols-3">
                      {db.classes.map((c) => (
                        <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                          <Checkbox checked={form.assignedClasses.includes(c.name)} onCheckedChange={() => toggle("assignedClasses", c.name)} />
                          {c.name}
                        </label>
                      ))}
                    </div>
                  )}
                </Field>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Annuler</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Création..." : editing ? "Enregistrer" : "Créer le compte"}
            </Button>
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

      <AlertDialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réinitialiser le mot de passe ?</AlertDialogTitle>
            <AlertDialogDescription>
              Un nouveau mot de passe temporaire sera généré pour {resetTarget?.firstName} {resetTarget?.lastName}.
              Il devra le changer à sa prochaine connexion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => resetTarget && doResetPassword(resetTarget)}>Réinitialiser</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <CredentialsModal info={credentials} onClose={() => setCredentials(null)} />
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        title={`Limite du plan ${plan.label} atteinte`}
        message={`Vous avez atteint la limite de ${limits.maxTeachers} enseignants (${teacherCount} inscrits) de votre plan ${plan.label}. Passez à un plan supérieur pour en ajouter plus.`}
      />
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
