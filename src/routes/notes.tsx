import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useLoaded, TableSkeleton, EmptyState } from "@/components/shared";
import { useDB, updateDB, getDB } from "@/lib/store";
import {
  TERMS,
  EVALUATION_TYPES,
  type EvaluationType,
  appreciationFor,
  mentionFor,
  gradeValue,
  type Grade,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { GraduationCap, Save, Download, Printer, FileText, Eye } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/notes")({ component: NotesPage });

function NotesPage() {
  return (
    <AppLayout title="Notes & Bulletins">
      <Tabs defaultValue="saisie">
        <TabsList>
          <TabsTrigger value="saisie">Saisie des notes</TabsTrigger>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="bulletins">Bulletins</TabsTrigger>
        </TabsList>
        <TabsContent value="saisie" className="mt-4"><SaisieTab /></TabsContent>
        <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
        <TabsContent value="bulletins" className="mt-4"><BulletinsTab /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

function norm(s: string | undefined | null): string {
  return (s ?? "").toString().trim().toLowerCase();
}

function matchSubject(g: Grade, subjectName: string, subjectId?: string): boolean {
  if (subjectId && g.subjectId && g.subjectId === subjectId) return true;
  return norm(g.subject) === norm(subjectName);
}

function subjectAverage(grades: Grade[], studentId: string, subject: string, term: string, subjectId?: string): number | null {
  const list = grades.filter((g) => g.studentId === studentId && matchSubject(g, subject, subjectId) && norm(g.term) === norm(term));
  if (!list.length) return null;
  const vals = list.map(gradeValue);
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100;
}

function weightedAverage(
  grades: Grade[],
  studentId: string,
  subjects: { name: string; coefficient: number }[],
  term: string
): number | null {
  let sumW = 0;
  let sumC = 0;
  subjects.forEach((s) => {
    const a = subjectAverage(grades, studentId, s.name, term);
    if (a == null) return;
    sumW += a * s.coefficient;
    sumC += s.coefficient;
  });
  if (!sumC) return null;
  return Math.round((sumW / sumC) * 100) / 100;
}

function cellTone(n: number | null): string {
  if (n == null) return "bg-muted/40 text-muted-foreground";
  if (n >= 14) return "bg-success/15 text-success font-semibold";
  if (n >= 10) return "bg-accent/15 text-accent font-medium";
  return "bg-destructive/15 text-destructive font-medium";
}

/* ───────────────────────── Saisie ───────────────────────── */

type Cell = { grade: string; comment: string };

function SaisieTab() {
  const db = useDB();
  const loaded = useLoaded();
  const { user } = useAuth();
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [term, setTerm] = useState("");
  const [evalType, setEvalType] = useState<EvaluationType | "">("");
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [confirmReplace, setConfirmReplace] = useState(false);

  const visibleClasses = useMemo(() => {
    if (user?.role === "teacher" && user.assignedClasses?.length) {
      return db.classes.filter((c) => user.assignedClasses!.some((a: string) => c.name === a || c.level === a));
    }
    return db.classes;
  }, [db.classes, user]);

  const subjects = useMemo(() => {
    const list = db.classSubjects.filter((s) => s.classId === classId);
    if (user?.role === "teacher" && user.assignedSubjects?.length) {
      return list.filter((s) => user.assignedSubjects!.includes(s.name));
    }
    return list;
  }, [db.classSubjects, classId, user]);
  const students = useMemo(
    () => db.students.filter((s) => s.classId === classId).sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [db.students, classId]
  );

  const ready = classId && subject && term && evalType;

  // load existing
  useEffect(() => {
    if (!ready) return;
    const next: Record<string, Cell> = {};
    students.forEach((s) => {
      const g = db.grades.find(
        (x) =>
          x.studentId === s.id &&
          x.subject === subject &&
          x.term === term &&
          x.evaluationType === evalType
      );
      next[s.id] = { grade: g?.grade != null ? String(g.grade) : "", comment: g?.comment ?? "" };
    });
    setCells(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, subject, term, evalType, db.grades.length, students.length]);

  const parsed = (v: string): number | null => {
    if (v === "") return null;
    const n = Number(v);
    if (Number.isNaN(n) || n < 0 || n > 20) return null;
    return n;
  };

  const noteValues = students
    .map((s) => parsed(cells[s.id]?.grade ?? ""))
    .filter((v): v is number => v != null);
  const avg = noteValues.length ? Math.round((noteValues.reduce((a, b) => a + b, 0) / noteValues.length) * 100) / 100 : 0;
  const hi = noteValues.length ? Math.max(...noteValues) : 0;
  const lo = noteValues.length ? Math.min(...noteValues) : 0;

  const setCell = (sid: string, k: keyof Cell, v: string) =>
    setCells((p) => ({ ...p, [sid]: { ...(p[sid] ?? { grade: "", comment: "" }), [k]: v } }));

  const existsAny = () => {
    if (!ready) return false;
    return db.grades.some(
      (g) =>
        g.classId === classId &&
        g.subject === subject &&
        g.term === term &&
        g.evaluationType === evalType
    );
  };

  const trySave = () => {
    if (!ready) return;
    if (existsAny()) {
      setConfirmReplace(true);
      return;
    }
    doSave();
  };

  const doSave = () => {
    updateDB((d) => {
      // remove old entries for this combo
      d.grades = d.grades.filter(
        (g) =>
          !(
            g.classId === classId &&
            g.subject === subject &&
            g.term === term &&
            g.evaluationType === evalType
          )
      );
      const subjEntity = getDB().classSubjects.find((s) => s.classId === classId && s.name === subject);
      students.forEach((s) => {
        const c = cells[s.id];
        const n = parsed(c?.grade ?? "");
        if (n == null) return;
        d.grades.push({
          id: "grade-" + Math.random().toString(36).slice(2, 9),
          studentId: s.id,
          classId,
          subject,
          subjectId: subjEntity?.id,
          term,
          evaluationType: evalType as EvaluationType,
          grade: n,
          comment: c?.comment || undefined,
          createdAt: new Date().toISOString(),
          value: n,
        });
      });
      d.activities.unshift({
        id: "act-" + Math.random().toString(36).slice(2, 7),
        type: "grade",
        text: `Notes ${subject} (${evalType}) enregistrées — ${term}`,
        date: new Date().toISOString(),
      });
    });
    const cls = db.classes.find((c) => c.id === classId)?.name ?? "";
    toast.success(`Notes enregistrées pour ${subject} — ${cls}`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-4">
          <Select value={classId} onValueChange={(v) => { setClassId(v); setSubject(""); }}>
            <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
            <SelectContent>{visibleClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={subject} onValueChange={setSubject} disabled={!classId}>
            <SelectTrigger><SelectValue placeholder="Matière" /></SelectTrigger>
            <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger><SelectValue placeholder="Trimestre" /></SelectTrigger>
            <SelectContent>{TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={evalType} onValueChange={(v) => setEvalType(v as EvaluationType)}>
            <SelectTrigger><SelectValue placeholder="Type d'évaluation" /></SelectTrigger>
            <SelectContent>{EVALUATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!ready ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Sélectionnez classe, matière, trimestre et type d'évaluation pour saisir les notes.
        </CardContent></Card>
      ) : !loaded ? (
        <Card><CardContent className="p-4"><TableSkeleton /></CardContent></Card>
      ) : students.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Aucun élève" description="Aucun élève dans cette classe." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">N°</TableHead>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Nom complet</TableHead>
                  <TableHead className="w-28">Note /20</TableHead>
                  <TableHead className="w-36">Appréciation</TableHead>
                  <TableHead>Commentaire</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s, i) => {
                  const c = cells[s.id] ?? { grade: "", comment: "" };
                  const n = parsed(c.grade);
                  const over = c.grade !== "" && (Number(c.grade) > 20 || Number(c.grade) < 0 || Number.isNaN(Number(c.grade)));
                  const initials = (s.firstName[0] ?? "") + (s.lastName[0] ?? "");
                  const app = n != null ? appreciationFor(n) : null;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        {s.photo ? (
                          <img src={s.photo} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials.toUpperCase()}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          step={0.25}
                          value={c.grade}
                          onChange={(e) => setCell(s.id, "grade", e.target.value)}
                          className={cn(
                            over && "border-destructive focus-visible:ring-destructive",
                            !over && n != null && n >= 10 && "border-success focus-visible:ring-success",
                            !over && n != null && n < 10 && "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        {over && <p className="mt-1 text-xs text-destructive">Note entre 0 et 20</p>}
                      </TableCell>
                      <TableCell>
                        {app ? <Badge className={app.cls + " border-0"}>{app.label}</Badge> : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>
                      <TableCell>
                        <Input placeholder="Optionnel" value={c.comment} onChange={(e) => setCell(s.id, "comment", e.target.value)} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4 text-sm">
              <div className="flex flex-wrap gap-4">
                <span><span className="text-muted-foreground">Moyenne classe :</span> <strong>{avg.toFixed(2)}/20</strong></span>
                <span><span className="text-muted-foreground">Max :</span> <strong className="text-success">{hi.toFixed(2)}</strong></span>
                <span><span className="text-muted-foreground">Min :</span> <strong className="text-destructive">{lo.toFixed(2)}</strong></span>
              </div>
              <Button onClick={trySave}><Save className="mr-1.5 h-4 w-4" /> Enregistrer les notes</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notes existantes</AlertDialogTitle>
            <AlertDialogDescription>
              Des notes existent déjà pour cette matière, ce trimestre et ce type d'évaluation. Voulez-vous les remplacer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmReplace(false); doSave(); }}>Remplacer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ───────────────────────── Overview ───────────────────────── */

function OverviewTab() {
  const db = useDB();
  const [classId, setClassId] = useState(db.classes[0]?.id ?? "");
  const [term, setTerm] = useState<string>(TERMS[0]);

  const subjects = useMemo(() => db.classSubjects.filter((s) => s.classId === classId), [db.classSubjects, classId]);
  const students = useMemo(
    () => db.students.filter((s) => s.classId === classId).sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [db.students, classId]
  );

  const rows = useMemo(() => {
    const r = students.map((s) => {
      const subjAvgs = subjects.map((sub) => subjectAverage(db.grades, s.id, sub.name, term));
      const gen = weightedAverage(db.grades, s.id, subjects.map((x) => ({ name: x.name, coefficient: x.coefficient })), term);
      return { student: s, subjAvgs, gen };
    });
    const ranked = [...r].sort((a, b) => (b.gen ?? -1) - (a.gen ?? -1));
    const rankMap = new Map<string, number>();
    ranked.forEach((x, i) => rankMap.set(x.student.id, x.gen != null ? i + 1 : 0));
    return r.map((x) => ({ ...x, rank: rankMap.get(x.student.id) ?? 0 }));
  }, [db.grades, students, subjects, term]);

  const classBySubject = subjects.map((sub) => {
    const idx = subjects.findIndex((s) => s.id === sub.id);
    const vals = rows.map((r) => r.subjAvgs[idx]).filter((v): v is number => v != null);
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  });

  const exportCSV = () => {
    const header = ["Élève", ...subjects.map((s) => s.name), "Moy. Générale", "Rang"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      const row = [
        `"${r.student.firstName} ${r.student.lastName}"`,
        ...r.subjAvgs.map((v) => (v == null ? "" : v.toFixed(2))),
        r.gen != null ? r.gen.toFixed(2) : "",
        r.rank || "",
      ];
      lines.push(row.join(","));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const clsName = db.classes.find((c) => c.id === classId)?.name ?? "classe";
    a.href = url;
    a.download = `notes_${clsName}_${term}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Classe" /></SelectTrigger>
            <SelectContent>{db.classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Trimestre" /></SelectTrigger>
            <SelectContent>{TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <div className="ml-auto">
            <Button variant="outline" onClick={exportCSV} disabled={!rows.length}>
              <Download className="mr-1.5 h-4 w-4" /> Exporter CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {!subjects.length || !students.length ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Aucune donnée à afficher.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élève</TableHead>
                  {subjects.map((s) => (
                    <TableHead key={s.id} className="text-center">{s.name}<div className="text-xs font-normal text-muted-foreground">coef {s.coefficient}</div></TableHead>
                  ))}
                  <TableHead className="text-center">Moy. Gén.</TableHead>
                  <TableHead className="text-center">Rang</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.student.id}>
                    <TableCell className="font-medium">{r.student.firstName} {r.student.lastName}</TableCell>
                    {r.subjAvgs.map((v, i) => (
                      <TableCell key={i} className="p-1 text-center">
                        <div className={cn("rounded px-2 py-1 text-sm", cellTone(v))}>{v == null ? "—" : v.toFixed(2)}</div>
                      </TableCell>
                    ))}
                    <TableCell className="text-center"><div className={cn("rounded px-2 py-1 font-bold", cellTone(r.gen))}>{r.gen == null ? "—" : r.gen.toFixed(2)}</div></TableCell>
                    <TableCell className="text-center">
                      {r.rank ? <Badge variant="secondary">{r.rank === 1 ? "1er" : `${r.rank}ème`}</Badge> : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40">
                  <TableCell className="font-semibold">Moyenne classe</TableCell>
                  {classBySubject.map((v, i) => (
                    <TableCell key={i} className="text-center font-medium">{v == null ? "—" : v.toFixed(2)}</TableCell>
                  ))}
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────────────── Bulletins ───────────────────────── */

function BulletinsTab() {
  const db = useDB();
  const [classId, setClassId] = useState(db.classes[0]?.id ?? "");
  const [term, setTerm] = useState<string>(TERMS[0]);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const subjects = useMemo(() => db.classSubjects.filter((s) => s.classId === classId), [db.classSubjects, classId]);
  const students = useMemo(
    () => db.students.filter((s) => s.classId === classId).sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [db.students, classId]
  );

  const rows = useMemo(() => {
    const r = students.map((s) => ({
      student: s,
      gen: weightedAverage(db.grades, s.id, subjects.map((x) => ({ name: x.name, coefficient: x.coefficient })), term),
    }));
    const ranked = [...r].sort((a, b) => (b.gen ?? -1) - (a.gen ?? -1));
    const rankMap = new Map<string, number>();
    ranked.forEach((x, i) => rankMap.set(x.student.id, x.gen != null ? i + 1 : 0));
    return r.map((x) => ({ ...x, rank: rankMap.get(x.student.id) ?? 0 }));
  }, [db.grades, students, subjects, term]);

  const printAll = () => {
    document.body.classList.add("print-all-bulletins");
    setTimeout(() => {
      window.print();
      document.body.classList.remove("print-all-bulletins");
    }, 200);
  };

  const handlePrintBulletin = () => {
    document.body.classList.add("printing-bulletin");
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove("printing-bulletin"), 100);
    }, 100);
  };

  return (
    <div className="space-y-4">
      <Card className="no-print">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Classe" /></SelectTrigger>
            <SelectContent>{db.classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Trimestre" /></SelectTrigger>
            <SelectContent>{TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={printAll} disabled={!students.length}>
              <Printer className="mr-1.5 h-4 w-4" /> Imprimer tous ({students.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="no-print">
        <CardContent className="p-0">
          {!students.length ? (
            <EmptyState icon={FileText} title="Aucun bulletin" description="Aucun élève dans cette classe." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead className="text-right">Moyenne</TableHead>
                  <TableHead className="text-right">Rang</TableHead>
                  <TableHead>Mention</TableHead>
                  <TableHead className="w-40 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.student.id}>
                    <TableCell className="font-medium">{r.student.firstName} {r.student.lastName}</TableCell>
                    <TableCell className="text-right">{r.gen != null ? r.gen.toFixed(2) + "/20" : "—"}</TableCell>
                    <TableCell className="text-right">{r.rank ? (r.rank === 1 ? "1er" : `${r.rank}ème`) : "—"}</TableCell>
                    <TableCell>{r.gen != null ? mentionFor(r.gen) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setPreviewId(r.student.id)}>
                        <Eye className="mr-1.5 h-4 w-4" /> Aperçu
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Hidden bulletins for print-all */}
      <div className="hidden print-all-only">
        {rows.map((r) => (
          <BulletinSheet key={r.student.id} studentId={r.student.id} classId={classId} term={term} />
        ))}
      </div>

      <Dialog open={!!previewId} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogContent
          className="flex max-h-[90vh] w-[min(800px,95vw)] max-w-[min(800px,95vw)] flex-col gap-0 p-0 print:max-h-none print:w-full print:max-w-none print:border-0"
        >
          <DialogHeader className="no-print flex-shrink-0 border-b border-border p-4">
            <DialogTitle>Aperçu du bulletin</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 print:overflow-visible print:p-0">
            {previewId && (
              <div className="bulletin-print-content bulletin-content">
                <BulletinSheet studentId={previewId} classId={classId} term={term} />
              </div>
            )}
          </div>
          <DialogFooter className="no-print flex-shrink-0 flex-col gap-2 border-t border-border bg-background p-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setPreviewId(null)} className="min-h-11 w-full sm:w-auto">Fermer</Button>
            <Button onClick={handlePrintBulletin} className="min-h-11 w-full sm:w-auto">
              <Printer className="mr-1.5 h-4 w-4" /> Imprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulletinPrintStyles />
    </div>
  );
}

function BulletinPrintStyles() {
  return (
    <style>{`
      .bulletin-content {
        width: 100%;
        max-width: 750px;
        margin: 0 auto;
        font-size: clamp(11px, 2vw, 14px);
      }
      .bulletin-content table { width: 100%; table-layout: fixed; word-wrap: break-word; }
      .bulletin-content table th:nth-child(1), .bulletin-content table td:nth-child(1) { width: 36%; }
      .bulletin-content table th:nth-child(2), .bulletin-content table td:nth-child(2) { width: 10%; }
      .bulletin-content table th:nth-child(3), .bulletin-content table td:nth-child(3) { width: 12%; }
      .bulletin-content table th:nth-child(4), .bulletin-content table td:nth-child(4) { width: 12%; }
      .bulletin-content table th:nth-child(5), .bulletin-content table td:nth-child(5) { width: 14%; }
      .bulletin-content table th:nth-child(6), .bulletin-content table td:nth-child(6) { width: 16%; }
      body:not(.print-all-bulletins) .print-all-only { display: none !important; }
      body.printing-bulletin { margin: 0 !important; padding: 0 !important; }
      body.printing-bulletin * { visibility: hidden !important; }
      body.printing-bulletin .bulletin-print-content,
      body.printing-bulletin .bulletin-print-content * { visibility: visible !important; }
      body.printing-bulletin .bulletin-print-content {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        width: 100vw !important;
        margin: 0 !important;
        padding: 10mm !important;
        background: white !important;
        z-index: 99999 !important;
      }
      @media print {
        @page { size: A4 portrait; margin: 0; }
        html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
        body * { visibility: hidden !important; }
        .bulletin-print-content, .bulletin-print-content *,
        body.print-all-bulletins .print-all-only,
        body.print-all-bulletins .print-all-only * { visibility: visible !important; }
        .bulletin-print-content {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 10mm !important;
          background: white !important;
          z-index: 99999 !important;
        }
        body.print-all-bulletins .print-all-only { display: block !important; position: static !important; }
        .no-print, [role="dialog"] > button[aria-label] { display: none !important; }
        .bulletin-sheet { box-shadow: none !important; border: none !important; page-break-after: always; }
        .bulletin-sheet:last-child { page-break-after: auto; }
      }
    `}</style>
  );
}

function BulletinSheet({ studentId, classId, term }: { studentId: string; classId: string; term: string }) {
  const db = useDB();
  const student = db.students.find((s) => s.id === studentId);
  const cls = db.classes.find((c) => c.id === classId);
  const school = db.schools[0];
  const subjects = db.classSubjects.filter((s) => s.classId === classId);
  const [appreciation, setAppreciation] = useState("");

  if (!student || !cls) return null;

  const rowsData = subjects.map((sub) => {
    const list = db.grades.filter(
      (g) => g.studentId === studentId && matchSubject(g, sub.name, sub.id) && norm(g.term) === norm(term)
    );
    const get = (et: string) => {
      const f = list.find((g) => norm(g.evaluationType) === norm(et));
      const v = f?.grade ?? (f as Grade | undefined)?.value;
      return v != null && !Number.isNaN(Number(v)) ? Number(v) : undefined;
    };
    const moy = subjectAverage(db.grades, studentId, sub.name, term, sub.id);
    return { sub, d1: get("Devoir 1"), d2: get("Devoir 2"), comp: get("Composition"), moy };
  });

  const gen = weightedAverage(db.grades, studentId, subjects.map((x) => ({ name: x.name, coefficient: x.coefficient })), term);
  const allStudents = db.students.filter((s) => s.classId === classId);
  const ranks = allStudents.map((s) => ({
    id: s.id,
    g: weightedAverage(db.grades, s.id, subjects.map((x) => ({ name: x.name, coefficient: x.coefficient })), term),
  })).sort((a, b) => (b.g ?? -1) - (a.g ?? -1));
  const rank = ranks.findIndex((r) => r.id === studentId) + 1;
  const totalStudents = allStudents.length;

  const stAttendance = db.attendance.filter((a) => a.studentId === studentId);
  const absences = stAttendance.filter((a) => a.status === "absent").length;
  const retards = stAttendance.filter((a) => a.status === "retard").length;

  const initials = ((student.firstName[0] ?? "") + (student.lastName[0] ?? "")).toUpperCase();

  return (
    <div className="bulletin-sheet mx-auto max-w-3xl rounded-lg border border-border bg-white p-6 text-black shadow-sm" style={{ colorScheme: "light" }}>
      <div className="border-b-2 border-black pb-3 text-center">
        <h1 className="text-lg font-bold uppercase">{school?.name ?? "École"}</h1>
        <p className="text-sm">{school?.city ?? ""}{school?.country ? ` — ${school.country}` : ""}</p>
        <p className="text-xs">Tél: {school?.phone ?? ""}</p>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-4 border-b border-gray-300 pb-3">
        <div>
          <h2 className="text-base font-bold">BULLETIN DE NOTES</h2>
          <p className="text-sm">{term}</p>
          <p className="text-sm">Année scolaire : 2025-2026</p>
        </div>
        <div className="flex items-start gap-3 text-sm">
          {student.photo ? (
            <img src={student.photo} alt="" className="h-20 w-20 rounded border border-gray-300 object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded border border-gray-300 bg-gray-100 text-xl font-bold">{initials}</div>
          )}
          <div>
            <p><strong>Nom :</strong> {student.lastName} {student.firstName}</p>
            <p><strong>Classe :</strong> {cls.name}</p>
            <p><strong>N° Élève :</strong> {student.code ?? "—"}</p>
          </div>
        </div>
      </div>

      <h3 className="mt-4 mb-2 text-sm font-bold uppercase">Résultats</h3>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 p-1 text-left">Matière</th>
            <th className="border border-gray-400 p-1">Coef</th>
            <th className="border border-gray-400 p-1">Dev 1</th>
            <th className="border border-gray-400 p-1">Dev 2</th>
            <th className="border border-gray-400 p-1">Comp</th>
            <th className="border border-gray-400 p-1">Moy</th>
          </tr>
        </thead>
        <tbody>
          {rowsData.map(({ sub, d1, d2, comp, moy }) => (
            <tr key={sub.id}>
              <td className="border border-gray-400 p-1">{sub.name}</td>
              <td className="border border-gray-400 p-1 text-center">{sub.coefficient}</td>
              <td className="border border-gray-400 p-1 text-center">{d1 != null ? d1.toFixed(2) : "—"}</td>
              <td className="border border-gray-400 p-1 text-center">{d2 != null ? d2.toFixed(2) : "—"}</td>
              <td className="border border-gray-400 p-1 text-center">{comp != null ? comp.toFixed(2) : "—"}</td>
              <td className="border border-gray-400 p-1 text-center font-bold">{moy != null ? moy.toFixed(2) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 space-y-1 border-y border-gray-400 py-2 text-sm">
        <p><strong>Moyenne générale :</strong> {gen != null ? gen.toFixed(2) : "—"} / 20</p>
        <p><strong>Rang dans la classe :</strong> {rank > 0 ? `${rank}${rank === 1 ? "er" : "ème"} / ${totalStudents}` : "—"}</p>
        <p><strong>Mention :</strong> {gen != null ? mentionFor(gen) : "—"}</p>
      </div>

      <div className="mt-3 text-sm">
        <p className="font-semibold">Appréciation du directeur :</p>
        <textarea
          className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
          rows={2}
          value={appreciation}
          onChange={(e) => setAppreciation(e.target.value)}
          placeholder="Saisir une appréciation avant impression…"
        />
      </div>

      <div className="mt-2 border-y border-gray-300 py-2 text-sm">
        <strong>Absences :</strong> {absences} | <strong>Retards :</strong> {retards}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-6 pt-4 text-sm">
        <div>
          <p className="mb-8">Signature des Parents</p>
          <div className="border-t border-black" />
        </div>
        <div>
          <p className="mb-8">Cachet & Signature Direction</p>
          <div className="border-t border-black" />
        </div>
      </div>
    </div>
  );
}
