import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";

import { AppLayout } from "@/components/AppLayout";
import { EmptyState, TableSkeleton, useLoaded } from "@/components/shared";
import { useDB, updateDB, getDB } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSchoolParentAccounts } from "@/lib/useSchoolParentAccounts";
import { Users, Search, Plus, Trash2, Pencil, Upload, UserPlus } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { STUDENT_STATUSES, PARENT_RELATIONS, type Student, type StudentStatus, type ParentRelation, type DB } from "@/lib/types";
import { cn } from "@/lib/utils";
import { adminApi } from "@/lib/admin-api";
import { CredentialsModal, type CredentialsInfo } from "@/components/CredentialsModal";
import { useAuth } from "@/lib/auth";
import { usePlan } from "@/lib/usePlan";
import { UpgradeModal } from "@/components/UpgradePrompt";

type ParentForm = {
  parentName: string; parentPhone: string; parentEmail: string;
  parentRelation: ParentRelation; parentWhatsapp: string;
};

function upsertParentForStudent(d: DB, studentId: string, f: ParentForm) {
  const [firstName, ...rest] = f.parentName.trim().split(/\s+/);
  const lastName = rest.join(" ");
  const existing = d.parents.find((p) => p.studentId === studentId);
  const payload = {
    studentId,
    firstName: firstName || f.parentName.trim() || "—",
    lastName: lastName || "",
    phone: f.parentPhone || undefined,
    whatsapp: f.parentWhatsapp || undefined,
    email: f.parentEmail || undefined,
    relationship: f.parentRelation,
    isEmergencyContact: true,
  };
  if (existing) {
    Object.assign(existing, payload);
  } else {
    d.parents.push({ id: crypto.randomUUID(), ...payload });
  }
}

export const Route = createFileRoute("/eleves")({
  component: ElevesPage,
});

const schema = z.object({
  firstName: z.string().trim().min(2, "Prénom requis"),
  lastName: z.string().trim().min(2, "Nom requis"),
  birthDate: z.string().min(1, "Date de naissance requise"),
  gender: z.enum(["M", "F"]),
  classId: z.string().min(1, "Classe requise"),
  status: z.enum(["actif", "inactif", "transfere"]),
  parentName: z.string().trim().min(2, "Nom du parent requis"),
  parentPhone: z.string().trim().min(6, "Téléphone invalide"),
  parentEmail: z.string().email("Email invalide").or(z.literal("")).optional(),
  parentRelation: z.enum(["Père", "Mère", "Tuteur"]),
  parentWhatsapp: z.string().optional(),
});

type FormState = {
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: "M" | "F";
  classId: string;
  code: string;
  status: StudentStatus;
  photo?: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  parentRelation: ParentRelation;
  parentWhatsapp: string;
};

const emptyForm = (): FormState => ({
  firstName: "",
  lastName: "",
  birthDate: "",
  gender: "M",
  classId: "",
  code: "",
  status: "actif",
  photo: undefined,
  parentName: "",
  parentPhone: "",
  parentEmail: "",
  parentRelation: "Père",
  parentWhatsapp: "",
});

function nextCode(): string {
  const year = new Date().getFullYear();
  const prefix = `EL-${year}-`;
  const max = getDB().students.reduce((m, s) => {
    if (s.code?.startsWith(prefix)) {
      const n = parseInt(s.code.slice(prefix.length), 10);
      if (!isNaN(n) && n > m) return n;
    }
    return m;
  }, 0);
  return `${prefix}${(max + 1).toString().padStart(3, "0")}`;
}

function initials(s: { firstName: string; lastName: string }) {
  return (s.firstName[0] ?? "").toUpperCase() + (s.lastName[0] ?? "").toUpperCase();
}

function statusBadge(s?: StudentStatus) {
  const map: Record<StudentStatus, { label: string; cls: string }> = {
    actif: { label: "Actif", cls: "bg-success/15 text-success" },
    inactif: { label: "Inactif", cls: "bg-muted text-muted-foreground" },
    transfere: { label: "Transféré", cls: "bg-accent/20 text-accent" },
  };
  const v = map[s ?? "actif"];
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", v.cls)}>{v.label}</span>;
}

function ElevesPage() {
  const db = useDB();
  const { user } = useAuth();
  const loaded = useLoaded();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<Student | null>(null);
  const [parentAccountFor, setParentAccountFor] = useState<Student | null>(null);
  const [credentials, setCredentials] = useState<CredentialsInfo | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const school = db.schools.find((s) => s.id === user?.schoolId);
  const { plan, canAddStudent, limits, studentCount } = usePlan();

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const className = (id: string) => db.classes.find((c) => c.id === id)?.name ?? "—";

  const parentsByStudent = useMemo(() => {
    const m = new Map<string, typeof db.parents>();
    for (const p of db.parents) {
      const arr = m.get(p.studentId) ?? [];
      arr.push(p);
      m.set(p.studentId, arr);
    }
    return m;
  }, [db.parents]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return db.students.filter((s) => {
      if (classFilter !== "all" && s.classId !== classFilter) return false;
      if (statusFilter !== "all" && (s.status ?? "actif") !== statusFilter) return false;
      if (!q) return true;
      return `${s.firstName} ${s.lastName} ${className(s.classId)} ${s.code ?? ""}`.toLowerCase().includes(q);
    });
  }, [db.students, db.classes, search, classFilter, statusFilter]);

  const openCreate = () => {
    if (!editingId && !canAddStudent()) {
      setUpgradeOpen(true);
      return;
    }
    setEditingId(null);
    setErrors({});
    setForm({ ...emptyForm(), code: nextCode() });
    setOpen(true);
  };

  const openEdit = (s: Student) => {
    setEditingId(s.id);
    setErrors({});
    setForm({
      firstName: s.firstName,
      lastName: s.lastName,
      birthDate: s.birthDate,
      gender: s.gender,
      classId: s.classId,
      code: s.code ?? nextCode(),
      status: s.status ?? "actif",
      photo: s.photo,
      parentName: s.parentName,
      parentPhone: s.parentPhone,
      parentEmail: s.parentEmail ?? "",
      parentRelation: s.parentRelation ?? "Père",
      parentWhatsapp: s.parentWhatsapp ?? "",
    });
    setOpen(true);
  };

  const onPhoto = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("photo", reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});

    if (editingId) {
      updateDB((d) => {
        const idx = d.students.findIndex((x) => x.id === editingId);
        if (idx >= 0) {
          d.students[idx] = {
            ...d.students[idx],
            ...form,
            parentEmail: form.parentEmail || undefined,
            parentWhatsapp: form.parentWhatsapp || undefined,
            photo: form.photo,
          };
        }
        upsertParentForStudent(d, editingId, form);
      });
      toast.success("Élève modifié avec succès");
    } else {
      const id = crypto.randomUUID();
      updateDB((d) => {
        d.students.push({
          id,
          ...form,
          parentEmail: form.parentEmail || undefined,
          parentWhatsapp: form.parentWhatsapp || undefined,
          enrolledAt: new Date().toISOString().slice(0, 10),
        });
        upsertParentForStudent(d, id, form);
        d.activities.unshift({
          id: crypto.randomUUID(),
          type: "student",
          text: `Nouvel élève inscrit : ${form.firstName} ${form.lastName}`,
          date: new Date().toISOString(),
        });
      });
      toast.success("Élève ajouté avec succès");
    }
    setOpen(false);
  };

  const confirmRemove = () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    updateDB((d) => {
      d.students = d.students.filter((s) => s.id !== id);
    });
    toast.success("Élève supprimé");
    setConfirmDelete(null);
  };

  return (
    <AppLayout title="Élèves">
      <Tabs defaultValue="eleves" className="space-y-4">
        <TabsList>
          <TabsTrigger value="eleves">Élèves</TabsTrigger>
          <TabsTrigger value="parents">Parents</TabsTrigger>
        </TabsList>
        <TabsContent value="eleves" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un élève..." className="pl-9" />
          </div>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Classe" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les classes</SelectItem>
              {db.classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {STUDENT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Nouvel élève
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {!loaded ? (
            <TableSkeleton cols={8} />
          ) : filtered.length === 0 ? (
            <EmptyState icon={Users} title="Aucun élève trouvé" description="Commencez par inscrire votre premier élève." actionLabel="Nouvel élève" onAction={openCreate} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Prénom</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Date naissance</TableHead>
                  <TableHead>Téléphone parent</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {s.photo ? (
                        <img src={s.photo} alt="" className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {initials(s)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link to="/eleves/$studentId" params={{ studentId: s.id }} className="hover:underline">
                        {s.firstName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link to="/eleves/$studentId" params={{ studentId: s.id }} className="hover:underline">
                        {s.lastName}
                      </Link>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{className(s.classId)}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{s.birthDate}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {(() => {
                        const ps = parentsByStudent.get(s.id) ?? [];
                        const primary = ps.find((p) => p.phone) ?? ps[0];
                        if (!primary?.phone) return "—";
                        return (
                          <span className="inline-flex items-center gap-1.5">
                            {primary.phone}
                            {ps.length > 1 && (
                              <Badge variant="outline" className="px-1.5 text-[10px]">+{ps.length - 1}</Badge>
                            )}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>{statusBadge(s.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setParentAccountFor(s)} aria-label="Créer compte parent" title="Créer compte parent">
                        <UserPlus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label="Modifier">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(s)} aria-label="Supprimer">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </TabsContent>
        <TabsContent value="parents">
          <ParentsListView />
        </TabsContent>
      </Tabs>



      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier l'élève" : "Inscrire un nouvel élève"}</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-4">
            <div className="relative">
              {form.photo ? (
                <img src={form.photo} alt="" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
                  {(form.firstName[0] ?? "?").toUpperCase()}
                  {(form.lastName[0] ?? "").toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-1.5 h-4 w-4" /> {form.photo ? "Changer la photo" : "Ajouter une photo"}
              </Button>
              {form.photo && (
                <Button type="button" variant="ghost" size="sm" onClick={() => set("photo", undefined)}>Retirer</Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Prénom *" error={errors.firstName}>
              <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={errors.firstName ? "border-destructive" : ""} />
            </Field>
            <Field label="Nom *" error={errors.lastName}>
              <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={errors.lastName ? "border-destructive" : ""} />
            </Field>
            <Field label="Date de naissance *" error={errors.birthDate}>
              <Input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} className={errors.birthDate ? "border-destructive" : ""} />
            </Field>
            <Field label="Genre *" error={errors.gender}>
              <Select value={form.gender} onValueChange={(v) => set("gender", v as "M" | "F")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculin</SelectItem>
                  <SelectItem value="F">Féminin</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Classe *" error={errors.classId}>
              <Select value={form.classId} onValueChange={(v) => set("classId", v)}>
                <SelectTrigger className={errors.classId ? "border-destructive" : ""}><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {db.classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Code élève">
              <Input value={form.code} readOnly className="bg-muted" />
            </Field>
            <Field label="Statut">
              <Select value={form.status} onValueChange={(v) => set("status", v as StudentStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STUDENT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="mt-2 border-t pt-4">
            <h3 className="mb-3 text-sm font-semibold">Parent / Tuteur</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nom du parent *" error={errors.parentName}>
                <Input value={form.parentName} onChange={(e) => set("parentName", e.target.value)} className={errors.parentName ? "border-destructive" : ""} />
              </Field>
              <Field label="Téléphone *" error={errors.parentPhone}>
                <Input value={form.parentPhone} onChange={(e) => set("parentPhone", e.target.value)} className={errors.parentPhone ? "border-destructive" : ""} />
              </Field>
              <Field label="Email" error={errors.parentEmail}>
                <Input type="email" value={form.parentEmail} onChange={(e) => set("parentEmail", e.target.value)} />
              </Field>
              <Field label="Relation *" error={errors.parentRelation}>
                <Select value={form.parentRelation} onValueChange={(v) => set("parentRelation", v as ParentRelation)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PARENT_RELATIONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Numéro WhatsApp">
                <Input value={form.parentWhatsapp} onChange={(e) => set("parentWhatsapp", e.target.value)} />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit}>{editingId ? "Enregistrer les modifications" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'élève</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete && `Êtes-vous sûr de vouloir supprimer ${confirmDelete.firstName} ${confirmDelete.lastName} ? Cette action est irréversible.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ParentAccountDialog
        student={parentAccountFor}
        onClose={() => setParentAccountFor(null)}
        onCreated={(creds) => { setParentAccountFor(null); setCredentials(creds); }}
        schoolName={school?.name}
      />
      <CredentialsModal info={credentials} onClose={() => setCredentials(null)} />
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        title={`Limite du plan ${plan.label} atteinte`}
        message={`Vous avez atteint la limite de ${limits.maxStudents} élèves (${studentCount} inscrits) de votre plan ${plan.label}. Passez à un plan supérieur pour ajouter plus d'élèves.`}
      />
    </AppLayout>
  );
}

function ParentAccountDialog({
  student, onClose, onCreated, schoolName,
}: {
  student: Student | null;
  onClose: () => void;
  onCreated: (c: CredentialsInfo) => void;
  schoolName?: string;
}) {
  const db = useDB();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState<ParentRelation>("Père");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [primed, setPrimed] = useState(false);

  if (!student) return null;
  if (!primed) {
    setPrimed(true);
    const p = db.parents.find((x) => x.studentId === student.id);
    if (p) {
      setFirstName(p.firstName || student.parentName.split(" ")[0] || "");
      setLastName(p.lastName || student.parentName.split(" ").slice(1).join(" ") || "");
      setEmail(p.email || student.parentEmail || "");
      setPhone(p.phone || student.parentPhone || "");
      if (p.relationship) setRelationship(p.relationship as ParentRelation);
    } else {
      const [fn, ...rest] = (student.parentName || "").trim().split(/\s+/);
      setFirstName(fn || "");
      setLastName(rest.join(" "));
      setEmail(student.parentEmail || "");
      setPhone(student.parentPhone || "");
      if (student.parentRelation) setRelationship(student.parentRelation);
    }
    setSelectedIds([student.id]);
  }

  const toggle = (sid: string) =>
    setSelectedIds((cur) => cur.includes(sid) ? cur.filter((x) => x !== sid) : [...cur, sid]);

  // Other students in the school = potential siblings
  const otherStudents = db.students.filter((s) => s.id !== student.id);

  const submit = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("Prénom, nom et email requis");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Sélectionnez au moins un enfant");
      return;
    }
    setSubmitting(true);
    try {
      const res = await adminApi.createParent({
        firstName: firstName.trim(), lastName: lastName.trim(),
        email: email.trim(), phone: phone.trim() || undefined,
        studentIds: selectedIds,
        relationship,
      });
      onCreated({
        name: `${firstName} ${lastName}`,
        email: email.trim(),
        tempPassword: res.tempPassword,
        role: "parent",
        schoolName,
      });
      setFirstName(""); setLastName(""); setEmail(""); setPhone(""); setSelectedIds([]); setPrimed(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !submitting && (onClose(), setPrimed(false))}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Créer un compte parent</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Prénom</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Nom</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Email (login)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Téléphone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Relation</Label>
            <Select value={relationship} onValueChange={(v) => setRelationship(v as ParentRelation)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PARENT_RELATIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Enfants liés à ce compte</Label>
          <div className="rounded-md border border-border max-h-48 overflow-auto divide-y">
            <label className="flex items-center gap-2 p-2 text-sm bg-muted/30">
              <input type="checkbox" checked={selectedIds.includes(student.id)} onChange={() => toggle(student.id)} />
              <span className="font-medium">{student.firstName} {student.lastName}</span>
              <Badge variant="outline" className="ml-auto text-[10px]">Élève courant</Badge>
            </label>
            {otherStudents.map((s) => (
              <label key={s.id} className="flex items-center gap-2 p-2 text-sm">
                <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggle(s.id)} />
                <span>{s.firstName} {s.lastName}</span>
                <span className="text-xs text-muted-foreground ml-auto">{db.classes.find((c) => c.id === s.classId)?.name ?? "—"}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {selectedIds.length} enfant{selectedIds.length > 1 ? "s" : ""} sélectionné{selectedIds.length > 1 ? "s" : ""}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setPrimed(false); }} disabled={submitting}>Annuler</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Création..." : "Créer le compte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
