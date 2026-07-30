import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useLoaded, TableSkeleton, EmptyState } from "@/components/shared";
import { useDB, updateDB } from "@/lib/store";
import { fcfa } from "@/lib/format";
import { LEVELS, LEVEL_LABELS, LEVEL_ORDER, type Level, type Classe, type ClassSubject } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus, Pencil, Trash2, Users, FileUp } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { ImportDialog, type ImportConfig, type RowStatus } from "@/components/ImportDialog";
import { useAuth } from "@/lib/auth";
import { resolveTeacherClasses } from "@/lib/teacher-scope";
import { getSchoolSubjects } from "@/lib/subjects";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/classes")({ component: ClassesPage });

const schema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(40),
  level: z.enum(LEVELS as [Level, ...Level[]], { message: "Niveau requis" }),
  capacity: z.coerce.number().int().positive("Capacité invalide").max(200),
  teacherId: z.string(),
  fees: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce.number({ message: "Frais requis" }).nonnegative("Frais invalides"),
  ),
});

type FormState = { name: string; level: string; capacity: string; teacherId: string; fees: string };
const empty: FormState = { name: "", level: "CP", capacity: "30", teacherId: "", fees: "" };

function ClassesPage() {
  const { t } = useTranslation();
  const db = useDB();
  const { user } = useAuth();
  const loaded = useLoaded();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Classe | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<Classe | null>(null);
  const [subjectsFor, setSubjectsFor] = useState<Classe | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const teachersOfClass = (classId: string): string[] => {
    const ids = new Set<string>();
    for (const ct of db.classTeachers ?? []) {
      if (ct.classId === classId) ids.add(ct.teacherId);
    }
    const c = db.classes.find((x) => x.id === classId);
    if (c?.teacherId) ids.add(c.teacherId);
    return Array.from(ids);
  };

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setSelectedTeacherIds([]);
    setErrors({});
    setOpen(true);
  };
  const openEdit = (c: Classe) => {
    setEditing(c);
    setForm({ name: c.name, level: c.level, capacity: String(c.capacity), teacherId: c.teacherId, fees: String(c.fees) });
    setSelectedTeacherIds(teachersOfClass(c.id));
    setErrors({});
    setOpen(true);
  };

  const toggleTeacher = (teacherId: string) => {
    setSelectedTeacherIds((prev) => {
      if (prev.includes(teacherId)) {
        const next = prev.filter((id) => id !== teacherId);
        if (form.teacherId === teacherId) set("teacherId", next[0] ?? "");
        return next;
      }
      const next = [...prev, teacherId];
      if (!form.teacherId) set("teacherId", teacherId);
      return next;
    });
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
    const principalId = selectedTeacherIds.includes(data.teacherId) ? data.teacherId : (selectedTeacherIds[0] ?? "");
    updateDB((d) => {
      let classId: string;
      if (editing) {
        const c = d.classes.find((x) => x.id === editing.id);
        if (c) {
          c.name = data.name; c.level = data.level as Level;
          c.capacity = data.capacity; c.fees = data.fees;
          c.teacherId = principalId;
        }
        classId = editing.id;
      } else {
        classId = crypto.randomUUID();
        d.classes.push({ id: classId, name: data.name, level: data.level as Level, capacity: data.capacity, fees: data.fees, teacherId: principalId });
      }
      // Reconcile class_teachers
      if (!d.classTeachers) d.classTeachers = [];
      d.classTeachers = d.classTeachers.filter((ct) => ct.classId !== classId);
      for (const tid of selectedTeacherIds) {
        d.classTeachers.push({
          id: crypto.randomUUID(),
          classId,
          teacherId: tid,
          isPrincipal: tid === principalId,
        });
      }
    });
    toast.success(editing ? "Classe modifiée" : "Classe créée");
    setOpen(false);
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    updateDB((d) => {
      d.classes = d.classes.filter((c) => c.id !== id);
      d.classTeachers = (d.classTeachers ?? []).filter((ct) => ct.classId !== id);
    });
    toast.success("Classe supprimée");
    setToDelete(null);
  };

  const isTeacher = user?.role === "teacher";
  const isAdmin = user?.role === "school_admin" || user?.role === "super_admin";

  // Teachers see all classes they're linked to via any assignment source.
  const baseClasses = isTeacher ? resolveTeacherClasses(user, db) : db.classes;
  const visibleClasses = [...baseClasses].sort((a, b) => {
    const oa = LEVEL_ORDER[a.level as Level] ?? 999;
    const ob = LEVEL_ORDER[b.level as Level] ?? 999;
    return oa - ob || a.name.localeCompare(b.name);
  });

  return (
    <AppLayout title={t("classes.title")}>
      {isAdmin && (
        <div className="mb-4 flex justify-end gap-2">
          {user?.role === "school_admin" && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp className="mr-1.5 h-4 w-4" /> {t("common.import")}
            </Button>
          )}
          <Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> {t("classes.newClass")}</Button>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          {!loaded ? (
            <TableSkeleton rows={5} cols={isAdmin ? 6 : 4} />
          ) : visibleClasses.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={isTeacher ? t("classes.emptyTeacher") : t("classes.emptyAdmin")}
              description={isTeacher ? t("classes.emptyTeacherDesc") : t("classes.emptyAdminDesc")}
              actionLabel={isAdmin ? t("classes.newClass") : undefined}
              onAction={isAdmin ? openNew : undefined}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("classes.colClass")}</TableHead>
                  <TableHead>{t("classes.colLevel")}</TableHead>
                  <TableHead>{t("classes.colTeacher")}</TableHead>
                  <TableHead>{t("classes.colHeadcount")}</TableHead>
                  {isAdmin && <TableHead>{t("classes.colFees")}</TableHead>}
                  {isAdmin && <TableHead className="text-right">{t("common.actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleClasses.map((c) => {
                  const count = db.students.filter((s) => s.classId === c.id).length;
                  const teacherIds = teachersOfClass(c.id);
                  const teacherList = teacherIds
                    .map((tid) => db.teachers.find((tt) => tt.id === tid))
                    .filter((tt): tt is NonNullable<typeof tt> => !!tt);
                  const principalId = c.teacherId;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell><Badge variant="outline">{c.level}</Badge></TableCell>
                      <TableCell>
                        {teacherList.length === 0 ? "—" : (
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                            {teacherList.slice(0, 2).map((tt, i) => (
                              <span key={tt.id} className="text-sm">
                                {i > 0 && <span className="text-muted-foreground mr-1">,</span>}
                                {tt.firstName} {tt.lastName}
                                {tt.id === principalId && <Badge variant="secondary" className="ml-1 text-[10px]">{t("classes.principal")}</Badge>}
                              </span>
                            ))}
                            {teacherList.length > 2 && (
                              <Badge variant="outline">+{teacherList.length - 2}</Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground"><Users className="mr-1 inline h-4 w-4" />{count} / {c.capacity}</TableCell>
                      {isAdmin && <TableCell className="font-semibold">{fcfa(c.fees)}</TableCell>}
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => setSubjectsFor(c)} aria-label="Matières"><BookOpen className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setToDelete(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      )}
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
          <DialogHeader><DialogTitle>{editing ? t("classes.editClass") : t("classes.newClass")}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("classes.fieldName")} error={errors.name}>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="ex: CP-A" />
            </Field>
            <Field label={t("classes.fieldLevel")} error={errors.level}>
              <Select value={form.level} onValueChange={(v) => set("level", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => <SelectItem key={l} value={l}>{l} — {LEVEL_LABELS[l]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("classes.fieldCapacity")} error={errors.capacity}>
              <Input type="number" value={form.capacity} onChange={(e) => set("capacity", e.target.value)} />
            </Field>
            <Field label={t("classes.fieldFees")} error={errors.fees}>
              <Input type="number" placeholder="150000" value={form.fees} onChange={(e) => set("fees", e.target.value)} />
            </Field>
            <div className="sm:col-span-2 space-y-2">
              <Label>{t("classes.fieldTeachers")}</Label>
              <div className="rounded-md border border-border divide-y divide-border max-h-64 overflow-auto">
                {db.teachers.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">{t("classes.noTeachers")}</div>
                ) : db.teachers.map((teacher) => {
                  const checked = selectedTeacherIds.includes(teacher.id);
                  const isPrincipal = form.teacherId === teacher.id;
                  return (
                    <div key={teacher.id} className="flex items-center justify-between gap-3 p-2">
                      <label className="flex items-center gap-2 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={checked}
                          onChange={() => toggleTeacher(teacher.id)}
                        />
                        <span className="text-sm">{teacher.firstName} {teacher.lastName}</span>
                      </label>
                      {checked && (
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                          <input
                            type="radio"
                            name="principal"
                            checked={isPrincipal}
                            onChange={() => set("teacherId", teacher.id)}
                          />
                          {t("classes.principal")}
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("classes.principalHelp")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={submit}>{editing ? t("common.save") : t("common.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("classes.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("classes.deleteDesc", { name: toDelete?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <SubjectsModal classe={subjectsFor} onClose={() => setSubjectsFor(null)} />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        config={buildClassImportConfig(db.classes)}
      />
    </AppLayout>
  );
}

function SubjectsModal({ classe, onClose }: { classe: Classe | null; onClose: () => void }) {
  const { t } = useTranslation();
  const db = useDB();
  const [editing, setEditing] = useState<ClassSubject | null>(null);
  const [draft, setDraft] = useState<{ name: string; coefficient: string; teacherId: string }>({ name: "", coefficient: "1", teacherId: "" });
  const [adding, setAdding] = useState(false);
  const [confirmDel, setConfirmDel] = useState<ClassSubject | null>(null);

  const subjects = classe ? db.classSubjects.filter((s) => s.classId === classe.id) : [];

  const reset = () => { setDraft({ name: "", coefficient: "1", teacherId: "" }); setEditing(null); setAdding(false); };

  const startEdit = (s: ClassSubject) => {
    setEditing(s);
    setDraft({ name: s.name, coefficient: String(s.coefficient), teacherId: s.teacherId ?? "" });
    setAdding(true);
  };

  const save = () => {
    if (!classe) return;
    const name = draft.name.trim();
    const coef = parseInt(draft.coefficient, 10);
    if (!name) { toast.error("Nom de matière requis"); return; }
    if (!coef || coef < 1 || coef > 5) { toast.error("Coefficient entre 1 et 5"); return; }
    updateDB((d) => {
      if (editing) {
        const s = d.classSubjects.find((x) => x.id === editing.id);
        if (s) { s.name = name; s.coefficient = coef; s.teacherId = draft.teacherId || undefined; }
      } else {
        d.classSubjects.push({
          id: crypto.randomUUID(),
          classId: classe.id,
          name,
          coefficient: coef,
          teacherId: draft.teacherId || undefined,
        });
      }
    });
    toast.success(editing ? "Matière modifiée" : "Matière ajoutée");
    reset();
  };

  const remove = () => {
    if (!confirmDel) return;
    const id = confirmDel.id;
    updateDB((d) => { d.classSubjects = d.classSubjects.filter((s) => s.id !== id); });
    toast.success("Matière supprimée");
    setConfirmDel(null);
  };

  return (
    <Dialog open={!!classe} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("classes.subjectsTitle", { name: classe?.name ?? "" })}</DialogTitle>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("classes.subjectCol")}</TableHead>
              <TableHead>{t("classes.subjectCoef")}</TableHead>
              <TableHead>{t("classes.subjectTeacher")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.map((s) => {
              const tt = db.teachers.find((x) => x.id === s.teacherId);
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell><Badge variant="outline">{s.coefficient}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{tt ? `${tt.firstName} ${tt.lastName}` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(s)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setConfirmDel(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {subjects.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">{t("classes.noSubjects")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        {adding ? (
          <div className="rounded-md border border-border p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={t("classes.fieldSubject")}>
                <Input
                  list="school-subjects-list"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="ex: Français"
                />
                <datalist id="school-subjects-list">
                  {getSchoolSubjects(db).map((s) => <option key={s} value={s} />)}
                </datalist>
              </Field>
              <Field label={t("classes.fieldCoefficient")}>
                <Input type="number" min={1} max={5} value={draft.coefficient} onChange={(e) => setDraft((d) => ({ ...d, coefficient: e.target.value }))} />
              </Field>
              <Field label={t("classes.fieldSubjectTeacher")}>
                <Select value={draft.teacherId} onValueChange={(v) => setDraft((d) => ({ ...d, teacherId: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("classes.choose")} /></SelectTrigger>
                  <SelectContent>
                    {db.teachers.map((tt) => <SelectItem key={tt.id} value={tt.id}>{tt.firstName} {tt.lastName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={reset}>{t("common.cancel")}</Button>
              <Button size="sm" onClick={save}>{editing ? t("common.save") : t("common.add")}</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setAdding(true)}><Plus className="mr-1.5 h-4 w-4" /> {t("classes.addSubject")}</Button>
        )}

        <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("classes.deleteSubjectTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("classes.deleteSubjectDesc", { name: confirmDel?.name ?? "" })}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common.delete")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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

type ClassImport = { name: string; level: Level; capacity: number };

function buildClassImportConfig(existing: Classe[]): ImportConfig<ClassImport> {
  const columns = ["Nom de la classe", "Niveau", "Capacité"];
  return {
    title: "Importer des classes",
    templateName: "modele-classes",
    columns,
    exampleRows: [
      ["CP-A", "CP", 30],
      ["CE1-B", "CE1", 28],
    ],
    notes: [
      "Niveau accepté : " + LEVELS.join(", "),
      "Ne modifiez pas les noms des colonnes.",
    ],
    previewColumns: columns,
    validateRow: (raw) => {
      const name = String(raw["Nom de la classe"] ?? "").trim();
      const level = String(raw["Niveau"] ?? "").trim().toUpperCase();
      const capRaw = String(raw["Capacité"] ?? "").trim();
      const capacity = parseInt(capRaw, 10);
      const messages: string[] = [];
      let status: RowStatus = "valid";

      if (!name) { messages.push("Nom manquant"); status = "error"; }
      if (!LEVELS.includes(level as Level)) {
        messages.push(`Niveau invalide (${LEVELS.join(", ")})`);
        status = "error";
      }
      if (!capacity || capacity < 1 || capacity > 200) {
        messages.push("Capacité invalide (1-200)");
        status = status === "error" ? "error" : "warning";
      }
      if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        messages.push("Classe déjà existante");
        status = "error";
      }

      const data: ClassImport | null = status === "error" ? null : {
        name, level: level as Level, capacity: capacity || 30,
      };
      return { data, status, messages, display: [name || "—", level || "—", String(capacity || "—")] };
    },
    importRows: async (rows, { onProgress }) => {
      let imported = 0;
      const valid = rows.filter((r) => r.data);
      updateDB((d) => {
        for (const r of valid) {
          const data = r.data!;
          d.classes.push({
            id: crypto.randomUUID(),
            name: data.name,
            level: data.level,
            capacity: data.capacity,
            teacherId: "",
            fees: 0,
          });
          imported++;
          onProgress(imported, valid.length);
        }
      });
      return { imported, skipped: rows.length - valid.length };
    },
  };
}
