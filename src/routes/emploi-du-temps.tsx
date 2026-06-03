import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useDB } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Printer, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/emploi-du-temps")({ component: EmploiDuTempsPage });

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"] as const;
type Day = (typeof DAYS)[number];

const DEFAULT_SLOTS: { start: string; end: string }[] = [
  { start: "07:30", end: "08:30" },
  { start: "08:30", end: "09:30" },
  { start: "09:30", end: "10:30" },
  { start: "10:45", end: "11:45" },
  { start: "11:45", end: "12:45" },
  { start: "14:00", end: "15:00" },
  { start: "15:00", end: "16:00" },
  { start: "16:00", end: "17:00" },
];

interface TimetableRow {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string | null;
  subject_name: string;
  teacher_id: string | null;
  teacher_name: string | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string | null;
}

// Stable HSL color from a string
function colorFor(name: string): { bg: string; border: string; text: string } {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return {
    bg: `hsl(${h} 85% 92%)`,
    border: `hsl(${h} 60% 65%)`,
    text: `hsl(${h} 70% 25%)`,
  };
}

function EmploiDuTempsPage() {
  const db = useDB();
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  const isAdmin = user?.role === "school_admin" || user?.role === "super_admin";

  // Class filter (admin)
  const visibleClasses = useMemo(() => db.classes, [db.classes]);
  const [classId, setClassId] = useState<string>(visibleClasses[0]?.id ?? "");
  useEffect(() => {
    if (!classId && visibleClasses[0]) setClassId(visibleClasses[0].id);
  }, [visibleClasses, classId]);

  // Find teacher record matching the user (by name match if no direct id)
  const teacherRecord = useMemo(() => {
    if (!isTeacher || !user) return null;
    return (
      db.teachers.find(
        (t) =>
          (t.email && user.email && t.email.toLowerCase() === user.email.toLowerCase()) ||
          `${t.firstName} ${t.lastName}`.toLowerCase() === user.name.toLowerCase(),
      ) ?? null
    );
  }, [db.teachers, isTeacher, user]);

  const [rows, setRows] = useState<TimetableRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    let q = supabase.from("timetable").select("*").eq("school_id", user.schoolId);
    if (isTeacher && teacherRecord) q = q.eq("teacher_id", teacherRecord.id);
    const { data, error } = await q;
    setLoading(false);
    if (error) {
      toast.error("Impossible de charger l'emploi du temps");
      return;
    }
    setRows((data ?? []) as TimetableRow[]);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.schoolId, teacherRecord?.id]);

  // Filter rows for the visible grid
  const gridRows = useMemo(() => {
    if (isTeacher) return rows;
    return rows.filter((r) => r.class_id === classId);
  }, [rows, classId, isTeacher]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TimetableRow | null>(null);
  const [form, setForm] = useState({
    day: "Lundi" as Day,
    start_time: "08:00",
    end_time: "09:00",
    subject_id: "",
    teacher_id: "",
    room: "",
  });

  const classSubjects = useMemo(
    () => db.classSubjects.filter((s) => s.classId === classId),
    [db.classSubjects, classId],
  );

  const openAdd = (day: Day, slot: { start: string; end: string }) => {
    if (!isAdmin) return;
    setEditing(null);
    setForm({
      day,
      start_time: slot.start,
      end_time: slot.end,
      subject_id: classSubjects[0]?.id ?? "",
      teacher_id: classSubjects[0]?.teacherId ?? "",
      room: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (row: TimetableRow) => {
    if (!isAdmin) return;
    setEditing(row);
    setForm({
      day: row.day_of_week as Day,
      start_time: row.start_time,
      end_time: row.end_time,
      subject_id: row.subject_id ?? "",
      teacher_id: row.teacher_id ?? "",
      room: row.room ?? "",
    });
    setDialogOpen(true);
  };

  // Auto-fill teacher from subject
  const onSubjectChange = (subjectId: string) => {
    const subj = classSubjects.find((s) => s.id === subjectId);
    setForm((f) => ({ ...f, subject_id: subjectId, teacher_id: subj?.teacherId ?? f.teacher_id }));
  };

  const conflicts = useMemo(() => {
    if (!form.day || !form.start_time || !form.end_time) return [] as string[];
    const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
      aStart < bEnd && bStart < aEnd;
    const msgs: string[] = [];
    const teacher = db.teachers.find((t) => t.id === form.teacher_id);
    for (const r of rows) {
      if (editing && r.id === editing.id) continue;
      if (r.day_of_week !== form.day) continue;
      if (!overlaps(form.start_time, form.end_time, r.start_time, r.end_time)) continue;
      if (form.teacher_id && r.teacher_id === form.teacher_id) {
        msgs.push(`⚠️ ${teacher ? `${teacher.firstName} ${teacher.lastName}` : "L'enseignant"} est déjà occupé à cette heure (${r.start_time}-${r.end_time}).`);
      }
      if (r.class_id === classId) {
        msgs.push(`⚠️ Cette classe a déjà un cours à cette heure (${r.start_time}-${r.end_time}).`);
      }
    }
    return Array.from(new Set(msgs));
  }, [rows, form, classId, db.teachers, editing]);

  const save = async () => {
    if (!user?.schoolId || !classId) return;
    if (!form.subject_id) {
      toast.error("Sélectionnez une matière");
      return;
    }
    const subj = classSubjects.find((s) => s.id === form.subject_id);
    const teacher = db.teachers.find((t) => t.id === form.teacher_id);
    const payload = {
      school_id: user.schoolId,
      class_id: classId,
      subject_id: form.subject_id,
      subject_name: subj?.name ?? "Matière",
      teacher_id: form.teacher_id || null,
      teacher_name: teacher ? `${teacher.firstName} ${teacher.lastName}` : null,
      day_of_week: form.day,
      start_time: form.start_time,
      end_time: form.end_time,
      room: form.room || null,
    };
    if (editing) {
      const { error } = await supabase.from("timetable").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Cours modifié");
    } else {
      const { error } = await supabase.from("timetable").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Cours ajouté");
    }
    setDialogOpen(false);
    void refresh();
  };

  const remove = async () => {
    if (!editing) return;
    const { error } = await supabase.from("timetable").delete().eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Cours supprimé");
    setDialogOpen(false);
    void refresh();
  };

  // Build slots: union of defaults + actual slots from rows
  const slots = useMemo(() => {
    const all = new Map<string, { start: string; end: string }>();
    for (const s of DEFAULT_SLOTS) all.set(`${s.start}-${s.end}`, s);
    for (const r of gridRows) all.set(`${r.start_time}-${r.end_time}`, { start: r.start_time, end: r.end_time });
    return Array.from(all.values()).sort((a, b) => a.start.localeCompare(b.start));
  }, [gridRows]);

  const findRow = (day: Day, slot: { start: string; end: string }) =>
    gridRows.find((r) => r.day_of_week === day && r.start_time === slot.start && r.end_time === slot.end);

  const printTimetable = () => {
    const className = visibleClasses.find((c) => c.id === classId)?.name ?? "";
    const schoolName = db.schools[0]?.name ?? "École";
    const logo = db.schools[0]?.logo ?? "";
    const cellsHtml = slots
      .map((slot) => {
        const cells = DAYS.map((day) => {
          const r = findRow(day, slot);
          if (!r) return `<td></td>`;
          return `<td><strong>${r.subject_name}</strong><br/><small>${r.teacher_name ?? ""}</small>${r.room ? `<br/><em>${r.room}</em>` : ""}</td>`;
        }).join("");
        return `<tr><th>${slot.start} - ${slot.end}</th>${cells}</tr>`;
      })
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Emploi du temps - ${className}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;color:#111}
        header{display:flex;align-items:center;gap:16px;margin-bottom:16px;border-bottom:2px solid #111;padding-bottom:12px}
        header img{height:60px}
        h1{margin:0;font-size:20px}
        h2{margin:2px 0 0;font-size:14px;color:#555;font-weight:500}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #999;padding:8px;text-align:center;font-size:12px;vertical-align:top;height:56px}
        thead th{background:#f3f4f6}
        tbody th{background:#fafafa;width:110px;font-weight:600}
      </style></head><body>
      <header>${logo ? `<img src="${logo}" alt="logo"/>` : ""}<div><h1>${schoolName}</h1><h2>Emploi du temps — ${className}</h2></div></header>
      <table>
        <thead><tr><th>Horaire</th>${DAYS.map((d) => `<th>${d}</th>`).join("")}</tr></thead>
        <tbody>${cellsHtml}</tbody>
      </table>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return toast.error("Bloqueur de pop-up détecté");
    w.document.write(html);
    w.document.close();
  };

  return (
    <AppLayout title="Emploi du temps">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {!isTeacher ? (
          <div className="w-full sm:max-w-xs space-y-1.5">
            <Label>Classe</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner une classe" /></SelectTrigger>
              <SelectContent>
                {visibleClasses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Votre emploi du temps personnel (toutes classes confondues).
          </div>
        )}
        <div className="flex gap-2">
          {isAdmin && (
            <Button onClick={() => openAdd("Lundi", DEFAULT_SLOTS[0])} disabled={!classId}>
              <Plus className="mr-1 h-4 w-4" /> Ajouter un cours
            </Button>
          )}
          <Button variant="outline" onClick={printTimetable} disabled={!classId && !isTeacher}>
            <Printer className="mr-1 h-4 w-4" /> Imprimer
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="border-b border-r p-2 w-28 text-left font-medium text-muted-foreground">Horaire</th>
                {DAYS.map((d) => (
                  <th key={d} className="border-b border-r p-2 text-center font-medium">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={`${slot.start}-${slot.end}`}>
                  <th className="border-b border-r bg-muted/30 p-2 text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {slot.start}<br />{slot.end}
                  </th>
                  {DAYS.map((day) => {
                    const r = findRow(day, slot);
                    if (r) {
                      const c = colorFor(r.subject_name);
                      return (
                        <td key={day} className="border-b border-r p-1 align-top">
                          <button
                            type="button"
                            onClick={() => (isAdmin ? openEdit(r) : undefined)}
                            disabled={!isAdmin}
                            className={cn(
                              "w-full rounded-md border-l-4 p-2 text-left text-xs transition hover:opacity-90 disabled:cursor-default",
                            )}
                            style={{ background: c.bg, borderLeftColor: c.border, color: c.text }}
                          >
                            <div className="font-semibold">{r.subject_name}</div>
                            {r.teacher_name && <div className="opacity-80">{r.teacher_name}</div>}
                            {isTeacher && (
                              <div className="opacity-70">{visibleClasses.find((cc) => cc.id === r.class_id)?.name ?? ""}</div>
                            )}
                            {r.room && <div className="italic opacity-70">{r.room}</div>}
                          </button>
                        </td>
                      );
                    }
                    return (
                      <td key={day} className="border-b border-r p-1 align-top">
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => openAdd(day, slot)}
                            className="flex h-14 w-full items-center justify-center rounded-md border border-dashed border-muted text-muted-foreground transition hover:border-primary hover:text-primary"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        ) : (
                          <div className="h-14" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {slots.length === 0 && (
                <tr>
                  <td colSpan={DAYS.length + 1} className="p-6 text-center text-muted-foreground">
                    {loading ? "Chargement…" : "Aucun créneau."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le cours" : "Ajouter un cours"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Jour</Label>
              <Select value={form.day} onValueChange={(v) => setForm((f) => ({ ...f, day: v as Day }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Salle</Label>
              <Input value={form.room} onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))} placeholder="Salle 1" />
            </div>
            <div className="space-y-1.5">
              <Label>Heure début</Label>
              <Input type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Heure fin</Label>
              <Input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Matière</Label>
              <Select value={form.subject_id} onValueChange={onSubjectChange}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {classSubjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Enseignant</Label>
              <Select value={form.teacher_id} onValueChange={(v) => setForm((f) => ({ ...f, teacher_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {db.teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {conflicts.length > 0 && (
            <div className="rounded-md border border-accent/40 bg-accent/10 p-3 text-sm text-accent">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" /> Conflit détecté
              </div>
              <ul className="list-inside list-disc space-y-0.5">
                {conflicts.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {editing && (
                <Button variant="destructive" onClick={remove}>
                  <Trash2 className="mr-1 h-4 w-4" /> Supprimer
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={save}>{editing ? "Modifier" : "Ajouter"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
