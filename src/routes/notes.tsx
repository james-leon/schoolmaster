import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/AppLayout";
import { useLoaded, TableSkeleton, EmptyState } from "@/components/shared";
import { useDB, updateDB, getDB } from "@/lib/store";
import {
  TERMS,
  SEQUENCES_BY_TERM,
  type Sequence,
  appreciationFor,
  mentionFor,
  gradeValue,
  legacyToSequence,
  getSequenceCoefficients,
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
import { GraduationCap, Save, Download, Printer, FileText, Eye, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { csvRow } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { resolveTeacherClasses } from "@/lib/teacher-scope";
import { useServerFn } from "@tanstack/react-start";
import { generateAppreciation, generateAppreciationBulk } from "@/lib/ai-appreciation.functions";
import { EmptySelectHint, QuickSubjectDialog } from "@/components/QuickCreate";
import { EmptyStateBlock } from "@/components/states";

const APPRECIATION_KEY = "bulletin_appreciations_v1";
function loadAppreciations(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(APPRECIATION_KEY) || "{}"); } catch { return {}; }
}
function saveAppreciation(key: string, text: string) {
  if (typeof window === "undefined") return;
  const all = loadAppreciations();
  all[key] = text;
  localStorage.setItem(APPRECIATION_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event("appreciations:updated"));
}
function appreciationKey(studentId: string, term: string) {
  return `${studentId}::${term}`;
}

export const Route = createFileRoute("/notes")({ component: NotesPage });

function NotesPage() {
  const { t } = useTranslation();
  return (
    <AppLayout title={t("grades.title")}>
      <Tabs defaultValue="saisie">
        <TabsList>
          <TabsTrigger value="saisie">{t("grades.tabInput")}</TabsTrigger>
          <TabsTrigger value="overview">{t("grades.tabOverview")}</TabsTrigger>
          <TabsTrigger value="bulletins">{t("grades.tabReports")}</TabsTrigger>
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
  const coefs = getSequenceCoefficients();
  let sumW = 0, sumC = 0;
  list.forEach((g) => {
    const v = gradeValue(g);
    const seq = legacyToSequence(g.evaluationType, term);
    const c = seq ? (coefs[seq] ?? 1) : 1;
    sumW += v * c; sumC += c;
  });
  if (!sumC) return null;
  return Math.round((sumW / sumC) * 100) / 100;
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

type SeqCell = { grade: string };
type RowCells = { seq: Record<string, SeqCell>; comment: string };

function SaisieTab() {
  const db = useDB();
  const loaded = useLoaded();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<Record<string, RowCells>>({});
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [subjectDialog, setSubjectDialog] = useState(false);

  const visibleClasses = useMemo(
    () => (user?.role === "teacher" ? resolveTeacherClasses(user, db) : db.classes),
    [db, user],
  );

  const subjects = useMemo(() => {
    const list = db.classSubjects.filter((s) => s.classId === classId);
    if (user?.role === "teacher" && user.assignedSubjects?.length) {
      return list.filter((s) => user.assignedSubjects!.includes(s.name));
    }
    return list;
  }, [db.classSubjects, classId, user]);

  const canManageSubjects = user?.role !== "teacher" && user?.role !== "parent";
  const currentClassName = useMemo(
    () => db.classes.find((c) => c.id === classId)?.name ?? "",
    [db.classes, classId],
  );
  const schoolSubjectNames = useMemo(() => {
    const set = new Map<string, string>();
    for (const cs of db.classSubjects) {
      const n = (cs.name ?? "").trim();
      if (n && !set.has(n.toLowerCase())) set.set(n.toLowerCase(), n);
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "fr"));
  }, [db.classSubjects]);
  const students = useMemo(
    () => db.students.filter((s) => s.classId === classId).sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [db.students, classId]
  );

  const termSequences: Sequence[] = useMemo(() => SEQUENCES_BY_TERM[term] ?? [], [term]);
  const ready = !!(classId && subject && term);

  const [coefs, setCoefs] = useState<Record<string, number>>(() => getSequenceCoefficients());
  useEffect(() => {
    const onUpd = () => setCoefs(getSequenceCoefficients());
    if (typeof window !== "undefined") {
      window.addEventListener("sequence-coefs:updated", onUpd);
      return () => window.removeEventListener("sequence-coefs:updated", onUpd);
    }
  }, []);

  // load existing grades for all sequences of this term
  useEffect(() => {
    if (!ready) return;
    const next: Record<string, RowCells> = {};
    students.forEach((s) => {
      const seq: Record<string, SeqCell> = {};
      let comment = "";
      termSequences.forEach((seqName) => {
        const g = db.grades.find(
          (x) =>
            x.studentId === s.id &&
            norm(x.subject) === norm(subject) &&
            norm(x.term) === norm(term) &&
            legacyToSequence(x.evaluationType, term) === seqName
        );
        seq[seqName] = { grade: g?.grade != null ? String(g.grade) : "" };
        if (!comment && g?.comment) comment = g.comment;
      });
      next[s.id] = { seq, comment };
    });
    setRows(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, subject, term, db.grades.length, students.length]);

  const parsed = (v: string): number | null => {
    if (v === "") return null;
    const n = Number(v);
    if (Number.isNaN(n) || n < 0 || n > 20) return null;
    return n;
  };

  const studentAvg = (sid: string): number | null => {
    const row = rows[sid];
    if (!row) return null;
    let sumW = 0, sumC = 0;
    termSequences.forEach((seqName) => {
      const v = parsed(row.seq[seqName]?.grade ?? "");
      if (v == null) return;
      const c = coefs[seqName] ?? 1;
      sumW += v * c; sumC += c;
    });
    if (!sumC) return null;
    return Math.round((sumW / sumC) * 100) / 100;
  };

  const avgs = students.map((s) => studentAvg(s.id)).filter((v): v is number => v != null);
  const avg = avgs.length ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 100) / 100 : 0;
  const hi = avgs.length ? Math.max(...avgs) : 0;
  const lo = avgs.length ? Math.min(...avgs) : 0;

  const setSeqCell = (sid: string, seqName: string, v: string) =>
    setRows((p) => ({
      ...p,
      [sid]: {
        comment: p[sid]?.comment ?? "",
        seq: { ...(p[sid]?.seq ?? {}), [seqName]: { grade: v } },
      },
    }));
  const setComment = (sid: string, v: string) =>
    setRows((p) => ({ ...p, [sid]: { seq: p[sid]?.seq ?? {}, comment: v } }));

  const existsAny = () => {
    if (!ready) return false;
    return db.grades.some(
      (g) =>
        g.classId === classId &&
        norm(g.subject) === norm(subject) &&
        norm(g.term) === norm(term) &&
        legacyToSequence(g.evaluationType, term) != null
    );
  };

  const trySave = () => {
    if (!ready) return;
    if (existsAny()) { setConfirmReplace(true); return; }
    doSave();
  };

  const doSave = () => {
    updateDB((d) => {
      // remove existing entries belonging to this class/subject/term/sequences
      d.grades = d.grades.filter(
        (g) =>
          !(
            g.classId === classId &&
            norm(g.subject) === norm(subject) &&
            norm(g.term) === norm(term) &&
            legacyToSequence(g.evaluationType, term) != null
          )
      );
      const subjEntity = getDB().classSubjects.find((s) => s.classId === classId && s.name === subject);
      students.forEach((s) => {
        const row = rows[s.id];
        if (!row) return;
        termSequences.forEach((seqName) => {
          const n = parsed(row.seq[seqName]?.grade ?? "");
          if (n == null) return;
          d.grades.push({
            id: crypto.randomUUID(),
            studentId: s.id,
            classId,
            subject,
            subjectId: subjEntity?.id,
            term,
            evaluationType: seqName,
            grade: n,
            comment: row.comment || undefined,
            createdAt: new Date().toISOString(),
            value: n,
          });
        });
      });
      d.activities.unshift({
        id: crypto.randomUUID(),
        type: "grade",
        text: `Notes ${subject} enregistrées — ${term}`,
        date: new Date().toISOString(),
      });
    });
    const cls = db.classes.find((c) => c.id === classId)?.name ?? "";
    toast.success(t("grades.gradesSavedFor", { subject, class: cls }));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <Select value={classId} onValueChange={(v) => { setClassId(v); setSubject(""); }}>
            <SelectTrigger><SelectValue placeholder={t("grades.classLabel")} /></SelectTrigger>
            <SelectContent>{visibleClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          {classId && subjects.length === 0 && canManageSubjects ? (
            <EmptySelectHint
              message={
                schoolSubjectNames.length === 0
                  ? t("quickCreate.noSchoolSubjects")
                  : t("quickCreate.noClassSubjects", { class: currentClassName })
              }
              actionLabel={
                schoolSubjectNames.length === 0
                  ? t("quickCreate.createSubject")
                  : t("quickCreate.assignSubjects")
              }
              onAction={() => setSubjectDialog(true)}
            />
          ) : (
            <Select value={subject} onValueChange={setSubject} disabled={!classId}>
              <SelectTrigger><SelectValue placeholder={t("grades.subjectLabel")} /></SelectTrigger>
              <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger><SelectValue placeholder={t("grades.termLabel")} /></SelectTrigger>
            <SelectContent>{TERMS.map((tm) => <SelectItem key={tm} value={tm}>{tm}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      <QuickSubjectDialog
        open={subjectDialog}
        onOpenChange={setSubjectDialog}
        classId={classId}
        className={currentClassName}
        availableSubjects={schoolSubjectNames}
        mode={schoolSubjectNames.length === 0 ? "create" : "assign"}
        onDone={(n: string) => setSubject(n)}
      />

      {!ready ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          {t("grades.selectPromptSaisie")}
        </CardContent></Card>
      ) : !loaded ? (
        <Card><CardContent className="p-4"><TableSkeleton /></CardContent></Card>
      ) : students.length === 0 ? (
        <EmptyState icon={GraduationCap} title={t("grades.noStudents")} description={t("grades.noStudentsDesc")} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">{t("grades.colNumber")}</TableHead>
                  <TableHead>{t("grades.colName")}</TableHead>
                  {termSequences.map((seqName) => (
                    <TableHead key={seqName} className="w-32 text-center">
                      {seqName}
                      <div className="text-xs font-normal text-muted-foreground">coef {coefs[seqName] ?? 1}</div>
                    </TableHead>
                  ))}
                  <TableHead className="w-28 text-center">{t("grades.colAverage")}</TableHead>
                  <TableHead className="w-36">{t("grades.colAppreciation")}</TableHead>
                  <TableHead>{t("grades.colComment")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s, i) => {
                  const row = rows[s.id] ?? { seq: {}, comment: "" };
                  const ma = studentAvg(s.id);
                  const app = ma != null ? appreciationFor(ma) : null;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                      {termSequences.map((seqName) => {
                        const c = row.seq[seqName] ?? { grade: "" };
                        const n = parsed(c.grade);
                        const over = c.grade !== "" && (Number(c.grade) > 20 || Number(c.grade) < 0 || Number.isNaN(Number(c.grade)));
                        return (
                          <TableCell key={seqName}>
                            <Input
                              type="number" min={0} max={20} step={0.25}
                              value={c.grade}
                              onChange={(e) => setSeqCell(s.id, seqName, e.target.value)}
                              className={cn(
                                over && "border-destructive focus-visible:ring-destructive",
                                !over && n != null && n >= 10 && "border-success focus-visible:ring-success",
                                !over && n != null && n < 10 && "border-destructive focus-visible:ring-destructive"
                              )}
                            />
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-semibold">
                        {ma != null ? ma.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell>
                        {app ? <Badge className={app.cls + " border-0"}>{app.label}</Badge> : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>
                      <TableCell>
                        <Input placeholder={t("grades.optionalPlaceholder")} value={row.comment} onChange={(e) => setComment(s.id, e.target.value)} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4 text-sm">
              <div className="flex flex-wrap gap-4">
                <span><span className="text-muted-foreground">{t("grades.classAveragePrefix")}</span> <strong>{avg.toFixed(2)}/20</strong></span>
                <span><span className="text-muted-foreground">{t("grades.maxPrefix")}</span> <strong className="text-success">{hi.toFixed(2)}</strong></span>
                <span><span className="text-muted-foreground">{t("grades.minPrefix")}</span> <strong className="text-destructive">{lo.toFixed(2)}</strong></span>
              </div>
              <Button onClick={trySave}><Save className="mr-1.5 h-4 w-4" /> {t("grades.saveGradesBtn")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("grades.existingGrades")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("grades.existingGradesDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmReplace(false); doSave(); }}>{t("common.replace")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ───────────────────────── Overview ───────────────────────── */

function OverviewTab() {
  const { t } = useTranslation();
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
    const header = [t("fees.studentLabel"), ...subjects.map((s) => s.name), t("grades.colGeneralAvg"), t("grades.colRank")];
    const lines = [csvRow(header)];
    rows.forEach((r) => {
      lines.push(csvRow([
        `${r.student.firstName} ${r.student.lastName}`,
        ...r.subjAvgs.map((v) => (v == null ? "" : v.toFixed(2))),
        r.gen != null ? r.gen.toFixed(2) : "",
        r.rank || "",
      ]));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const clsName = db.classes.find((c) => c.id === classId)?.name ?? "classe";
    a.href = url;
    a.download = `notes_${clsName}_${term}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("fees.csvExportedToast"));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-48"><SelectValue placeholder={t("grades.classLabel")} /></SelectTrigger>
            <SelectContent>{db.classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger className="w-48"><SelectValue placeholder={t("grades.termLabel")} /></SelectTrigger>
            <SelectContent>{TERMS.map((tm) => <SelectItem key={tm} value={tm}>{tm}</SelectItem>)}</SelectContent>
          </Select>
          <div className="ml-auto">
            <Button variant="outline" onClick={exportCSV} disabled={!rows.length}>
              <Download className="mr-1.5 h-4 w-4" /> {t("common.exportCsv")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {!subjects.length || !students.length ? (
            <EmptyStateBlock titleKey={!subjects.length ? "emptySubjects" : "emptyStudents"} className="border-0" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fees.studentLabel")}</TableHead>
                  {subjects.map((s) => (
                    <TableHead key={s.id} className="text-center">{s.name}<div className="text-xs font-normal text-muted-foreground">{t("grades.coef")} {s.coefficient}</div></TableHead>
                  ))}
                  <TableHead className="text-center">{t("grades.colGeneralAvg")}</TableHead>
                  <TableHead className="text-center">{t("grades.colRank")}</TableHead>
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
                      {r.rank ? <Badge variant="secondary">{r.rank === 1 ? t("grades.st1") : t("grades.stNth", { n: r.rank })}</Badge> : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40">
                  <TableCell className="font-semibold">{t("grades.classAverage")}</TableCell>
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
  const { t } = useTranslation();
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
    const container = document.querySelector(".print-all-only");
    if (!container) {
      toast.error(t("grades.printAllNone"));
      return;
    }
    const clone = container.cloneNode(true) as HTMLElement;
    // Strip editable controls so the printed copy stays clean
    clone.querySelectorAll("textarea").forEach((ta) => {
      const p = document.createElement("div");
      p.style.minHeight = "60px";
      p.style.borderBottom = "1px solid #999";
      p.style.whiteSpace = "pre-wrap";
      p.textContent = (ta as HTMLTextAreaElement).value || "";
      ta.replaceWith(p);
    });
    clone.querySelectorAll("button, [role='tooltip']").forEach((el) => el.remove());
    const sheets = Array.from(clone.querySelectorAll(".bulletin-sheet"))
      .map((s) => `<section class="bulletin-page">${(s as HTMLElement).outerHTML}</section>`)
      .join("");
    if (!sheets) {
      toast.error(t("grades.printAllNone"));
      return;
    }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      toast.error(t("grades.popupBlocked"));
      return;
    }
    const htmlLang = document.documentElement.lang || "fr";
    win.document.write(`<!DOCTYPE html><html lang="${htmlLang}"><head><meta charset="UTF-8"><title>${t("grades.printTitleAll")}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #000; background: #fff; }
  h1, h2, h3 { font-weight: bold; }
  .bulletin-page { padding: 15mm; page-break-after: always; break-after: page; }
  .bulletin-page:last-child { page-break-after: auto; break-after: auto; }
  .bulletin-sheet { box-shadow: none !important; border: none !important; padding: 0 !important; max-width: 100% !important; background: #fff !important; color: #000 !important; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 11px; }
  thead tr { background: #0D2C54 !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  thead th { color: #fff !important; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: center; }
  td:first-child, th:first-child { text-align: left; }
  tbody tr:nth-child(even) { background: #f8f9fa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  img { max-width: 80px; max-height: 80px; }
  .no-print, button, [role="tooltip"] { display: none !important; }
  @page { size: A4 portrait; margin: 0; }
</style></head><body>${sheets}</body></html>`);
    win.document.close();
    const doPrint = () => {
      win.focus();
      win.print();
      setTimeout(() => { try { win.close(); } catch { /* noop */ } }, 300);
    };
    win.onload = doPrint;
    setTimeout(() => { if (!win.closed) doPrint(); }, 800);
  };

  const handlePrintBulletin = () => {
    const node = document.querySelector(".bulletin-print-content");
    if (!node) return;
    // Strip the editable textarea so the printed copy stays clean
    const clone = node.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("textarea").forEach((ta) => {
      const p = document.createElement("div");
      p.style.minHeight = "60px";
      p.style.borderBottom = "1px solid #999";
      p.textContent = (ta as HTMLTextAreaElement).value || "";
      ta.replaceWith(p);
    });
    const content = clone.innerHTML;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    const htmlLang = document.documentElement.lang || "fr";
    win.document.write(`<!DOCTYPE html><html lang="${htmlLang}"><head><meta charset="UTF-8"><title>${t("grades.printTitleOne")}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #000; background: #fff; padding: 15mm; }
  h1, h2, h3 { font-weight: bold; }
  .bulletin-sheet { box-shadow: none !important; border: none !important; padding: 0 !important; max-width: 100% !important; background: #fff !important; color: #000 !important; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 11px; }
  thead tr { background: #0D2C54 !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  thead th { color: #fff !important; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: center; }
  td:first-child, th:first-child { text-align: left; }
  tbody tr:nth-child(even) { background: #f8f9fa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  img { max-width: 80px; max-height: 80px; }
  .no-print, button, [role="tooltip"] { display: none !important; }
  textarea, input { border: none !important; background: transparent !important; resize: none !important; outline: none !important; padding: 0 !important; font-family: inherit !important; font-size: inherit !important; color: #000 !important; }
  @page { size: A4 portrait; margin: 0; }
  @media print { body { padding: 15mm; } }
</style></head><body>${content}</body></html>`);
    win.document.close();
    const doPrint = () => {
      win.focus();
      win.print();
      setTimeout(() => win.close(), 300);
    };
    win.onload = doPrint;
    setTimeout(() => { if (!win.closed) doPrint(); }, 800);
  };

  return (
    <div className="space-y-4">
      <Card className="no-print">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-48"><SelectValue placeholder={t("grades.classLabel")} /></SelectTrigger>
            <SelectContent>{db.classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger className="w-48"><SelectValue placeholder={t("grades.termLabel")} /></SelectTrigger>
            <SelectContent>{TERMS.map((tm) => <SelectItem key={tm} value={tm}>{tm}</SelectItem>)}</SelectContent>
          </Select>
          <div className="ml-auto flex flex-wrap gap-2">
            <BulkGenerateButton
              classId={classId}
              term={term}
              subjects={subjects}
              students={students}
            />
            <Button variant="outline" onClick={printAll} disabled={!students.length}>
              <Printer className="mr-1.5 h-4 w-4" /> {t("grades.printAll", { count: students.length })}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="no-print">
        <CardContent className="p-0">
          {!students.length ? (
            <EmptyState icon={FileText} title={t("grades.emptyReports")} description={t("grades.emptyReportsDesc")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fees.studentLabel")}</TableHead>
                  <TableHead className="text-right">{t("grades.colAverage")}</TableHead>
                  <TableHead className="text-right">{t("grades.colRank")}</TableHead>
                  <TableHead>{t("grades.colMention")}</TableHead>
                  <TableHead className="w-40 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.student.id}>
                    <TableCell className="font-medium">{r.student.firstName} {r.student.lastName}</TableCell>
                    <TableCell className="text-right">{r.gen != null ? r.gen.toFixed(2) + "/20" : "—"}</TableCell>
                    <TableCell className="text-right">{r.rank ? (r.rank === 1 ? t("grades.st1") : t("grades.stNth", { n: r.rank })) : "—"}</TableCell>
                    <TableCell>{r.gen != null ? mentionFor(r.gen) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setPreviewId(r.student.id)}>
                        <Eye className="mr-1.5 h-4 w-4" /> {t("common.preview")}
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
            <DialogTitle>{t("grades.previewBulletin")}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 print:overflow-visible print:p-0">
            {previewId && (
              <div className="bulletin-print-content bulletin-content">
                <BulletinSheet studentId={previewId} classId={classId} term={term} />
              </div>
            )}
          </div>
          <DialogFooter className="no-print flex-shrink-0 flex-col gap-2 border-t border-border bg-background p-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setPreviewId(null)} className="min-h-11 w-full sm:w-auto">{t("common.close")}</Button>
            <Button onClick={handlePrintBulletin} className="min-h-11 w-full sm:w-auto">
              <Printer className="mr-1.5 h-4 w-4" /> {t("common.print")}
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
        .no-print, [role="dialog"] > button[aria-label], button, [role="tooltip"] { display: none !important; }
        .bulletin-sheet textarea, .bulletin-sheet input {
          border: none !important;
          background: transparent !important;
          resize: none !important;
          outline: none !important;
          padding: 0 !important;
          font-family: inherit !important;
          font-size: inherit !important;
          color: #000 !important;
        }
        .bulletin-sheet { box-shadow: none !important; border: none !important; page-break-after: always; }
        .bulletin-sheet:last-child { page-break-after: auto; }
      }
    `}</style>
  );
}

function BulkGenerateButton({
  classId,
  term,
  subjects,
  students,
}: {
  classId: string;
  term: string;
  subjects: { id: string; name: string; coefficient: number }[];
  students: { id: string; firstName: string }[];
}) {
  const { t } = useTranslation();
  const db = useDB();
  const cls = db.classes.find((c) => c.id === classId);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 });
  const callAiBulk = useServerFn(generateAppreciationBulk);

  const run = async () => {
    if (!students.length || !cls) return;
    setRunning(true);
    setProgress({ done: 0, total: students.length, errors: 0 });

    // Precompute per-student payload on the client.
    const allRanks = students.map((st) => ({
      id: st.id,
      g: weightedAverage(db.grades, st.id, subjects.map((x) => ({ name: x.name, coefficient: x.coefficient })), term),
    })).sort((a, b) => (b.g ?? -1) - (a.g ?? -1));

    const items = students.map((s) => {
      const subjData = subjects.map((sub) => ({
        name: sub.name,
        average: subjectAverage(db.grades, s.id, sub.name, term, sub.id),
      }));
      const gen = weightedAverage(db.grades, s.id, subjects.map((x) => ({ name: x.name, coefficient: x.coefficient })), term);
      const rank = allRanks.findIndex((r) => r.id === s.id) + 1;
      const stAtt = db.attendance.filter((a) => a.studentId === s.id);
      return {
        studentId: s.id,
        firstName: s.firstName,
        classLevel: cls.level,
        term,
        generalAverage: gen,
        rank: rank > 0 ? rank : null,
        totalStudents: students.length,
        subjects: subjData,
        absences: stAtt.filter((a) => a.status === "absent").length,
        retards: stAtt.filter((a) => a.status === "retard").length,
      };
    });

    // Chunk to stay under the bulk validator cap (80) and keep individual
    // failures scoped. Each chunk = 1 rate-limit slot.
    const chunks: typeof items[] = [];
    for (let i = 0; i < items.length; i += 60) chunks.push(items.slice(i, i + 60));

    let done = 0;
    let errors = 0;
    for (const chunk of chunks) {
      try {
        const { results } = await callAiBulk({ data: { items: chunk } });
        for (const r of results) {
          if (r.text) saveAppreciation(appreciationKey(r.studentId, term), r.text);
          else errors++;
          done++;
          setProgress({ done, total: students.length, errors });
        }
      } catch (e) {
        errors += chunk.length;
        done += chunk.length;
        setProgress({ done, total: students.length, errors });
        console.error("[bulk-appreciation]", e);
      }
    }
    setRunning(false);
    if (errors === 0) toast.success(t("grades.allAppreciationsGenerated", { count: students.length }));
    else toast.warning(t("grades.partialAppreciationsGenerated", { done: students.length - errors, total: students.length, errors }));
  };

  return (
    <Button variant="outline" onClick={run} disabled={running || !students.length}>
      {running ? (
        <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> {progress.done}/{progress.total}…</>
      ) : (
        <><Sparkles className="mr-1.5 h-4 w-4" /> {t("grades.generateAllAppreciations")}</>
      )}
    </Button>
  );
}



function BulletinSheet({ studentId, classId, term }: { studentId: string; classId: string; term: string }) {
  const { t } = useTranslation();
  const db = useDB();
  const student = db.students.find((s) => s.id === studentId);
  const cls = db.classes.find((c) => c.id === classId);
  const school = db.schools[0];
  const subjects = db.classSubjects.filter((s) => s.classId === classId);
  const key = appreciationKey(studentId, term);
  const [appreciation, setAppreciation] = useState<string>(() => loadAppreciations()[key] ?? "");
  const [aiLoading, setAiLoading] = useState(false);
  const callAi = useServerFn(generateAppreciation);

  useEffect(() => {
    setAppreciation(loadAppreciations()[key] ?? "");
    const onUpdate = () => setAppreciation(loadAppreciations()[key] ?? "");
    window.addEventListener("appreciations:updated", onUpdate);
    return () => window.removeEventListener("appreciations:updated", onUpdate);
  }, [key]);

  const onChangeAppreciation = (v: string) => {
    setAppreciation(v);
    saveAppreciation(key, v);
  };

  if (!student || !cls) return null;

  const termSequences: Sequence[] = SEQUENCES_BY_TERM[term] ?? [];
  const rowsData = subjects.map((sub) => {
    const list = db.grades.filter(
      (g) => g.studentId === studentId && matchSubject(g, sub.name, sub.id) && norm(g.term) === norm(term)
    );
    const seqVal = (seqName: Sequence): number | undefined => {
      const f = list.find((g) => legacyToSequence(g.evaluationType, term) === seqName);
      const v = f?.grade ?? (f as Grade | undefined)?.value;
      return v != null && !Number.isNaN(Number(v)) ? Number(v) : undefined;
    };
    const moy = subjectAverage(db.grades, studentId, sub.name, term, sub.id);
    const seqs = termSequences.map(seqVal);
    return { sub, seqs, moy };
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
        <p className="text-xs">{t("common.phone")}: {school?.phone ?? ""}</p>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-4 border-b border-gray-300 pb-3">
        <div>
          <h2 className="text-base font-bold">{t("grades.reportCard")}</h2>
          <p className="text-sm">{term}</p>
          <p className="text-sm">{t("grades.schoolYear")} : 2025-2026</p>
        </div>
        <div className="flex items-start gap-3 text-sm">
          {student.photo ? (
            <img src={student.photo} alt="" className="h-20 w-20 rounded border border-gray-300 object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded border border-gray-300 bg-gray-100 text-xl font-bold">{initials}</div>
          )}
          <div>
            <p><strong>{t("grades.labelName")} :</strong> {student.lastName} {student.firstName}</p>
            <p><strong>{t("grades.labelClass")} :</strong> {cls.name}</p>
            <p><strong>{t("grades.labelStudentNo")} :</strong> {student.code ?? "—"}</p>
          </div>
        </div>
      </div>

      <h3 className="mt-4 mb-2 text-sm font-bold uppercase">{t("grades.results")}</h3>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 p-1 text-left">{t("grades.colSubject")}</th>
            <th className="border border-gray-400 p-1">{t("grades.colCoef")}</th>
            {termSequences.map((seqName, i) => (
              <th key={seqName} className="border border-gray-400 p-1">{t("grades.sequenceShort", { n: i + 1 + (term === "2e trimestre" ? 2 : term === "3e trimestre" ? 4 : 0) })}</th>
            ))}
            <th className="border border-gray-400 p-1">{t("grades.colMoy")}</th>
          </tr>
        </thead>
        <tbody>
          {rowsData.map(({ sub, seqs, moy }) => (
            <tr key={sub.id}>
              <td className="border border-gray-400 p-1">{sub.name}</td>
              <td className="border border-gray-400 p-1 text-center">{sub.coefficient}</td>
              {seqs.map((v, i) => (
                <td key={i} className="border border-gray-400 p-1 text-center">{v != null ? v.toFixed(2) : "—"}</td>
              ))}
              <td className="border border-gray-400 p-1 text-center font-bold">{moy != null ? moy.toFixed(2) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 space-y-1 border-y border-gray-400 py-2 text-sm">
        <p><strong>{t("grades.overallAverage")} :</strong> {gen != null ? gen.toFixed(2) : "—"} / 20</p>
        <p><strong>{t("grades.classRank")} :</strong> {rank > 0 ? `${rank}${rank === 1 ? "er" : "ème"} / ${totalStudents}` : "—"}</p>
        <p><strong>{t("grades.mention")} :</strong> {gen != null ? mentionFor(gen) : "—"}</p>
      </div>

      <div className="mt-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">{t("grades.directorAppreciation")} :</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="no-print h-7 px-2 text-xs"
            disabled={aiLoading}
            onClick={async () => {
              setAiLoading(true);
              try {
                const res = await callAi({
                  data: {
                    firstName: student.firstName,
                    classLevel: cls.level,
                    term,
                    generalAverage: gen,
                    rank: rank > 0 ? rank : null,
                    totalStudents,
                    subjects: rowsData.map((r) => ({ name: r.sub.name, average: r.moy ?? null })),
                    absences,
                    retards,
                  },
                });
                onChangeAppreciation(res.text);
                toast.success(t("grades.appreciationGenerated"));
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : t("grades.appreciationGenFailed");
                toast.error(msg || t("grades.appreciationGenFailedShort"));
              } finally {
                setAiLoading(false);
              }
            }}
          >
            {aiLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : (appreciation ? <RefreshCw className="mr-1 h-3 w-3" /> : <Sparkles className="mr-1 h-3 w-3" />)}
            {appreciation ? t("grades.regenerateAppreciation") : t("grades.generateAppreciation")}
          </Button>
        </div>
        <textarea
          className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
          rows={3}
          value={appreciation}
          onChange={(e) => onChangeAppreciation(e.target.value)}
          placeholder={t("grades.appreciationPlaceholder")}
        />
      </div>

      <div className="mt-2 border-y border-gray-300 py-2 text-sm">
        <strong>{t("grades.absences")} :</strong> {absences} | <strong>{t("grades.latenesses")} :</strong> {retards}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-6 pt-4 text-sm">
        <div>
          <p className="mb-8">{t("grades.parentSignature")}</p>
          <div className="border-t border-black" />
        </div>
        <div>
          <p className="mb-8">{t("grades.directorSignature")}</p>
          <div className="border-t border-black" />
        </div>
      </div>
    </div>
  );
}
