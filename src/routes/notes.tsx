import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useLoaded, TableSkeleton, EmptyState } from "@/components/shared";
import { useDB, updateDB } from "@/lib/store";
import { SUBJECTS, TERMS, computeMoyenne } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/notes")({ component: NotesPage });

type Cell = { devoir1: string; devoir2: string; composition: string };

function parseNum(v: string): number | undefined {
  if (v === "" || v === undefined) return undefined;
  const n = Number(v);
  if (Number.isNaN(n) || n < 0 || n > 20) return undefined;
  return n;
}

function NotesPage() {
  const db = useDB();
  const loaded = useLoaded();
  const [classId, setClassId] = useState(db.classes[0]?.id ?? "");
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [term, setTerm] = useState<string>(TERMS[0]);
  const [cells, setCells] = useState<Record<string, Cell>>({});

  const students = useMemo(() => db.students.filter((s) => s.classId === classId), [db.students, classId]);

  // Load existing grades when filters change
  useEffect(() => {
    const next: Record<string, Cell> = {};
    students.forEach((s) => {
      const g = db.grades.find((x) => x.studentId === s.id && x.subject === subject && x.term === term);
      next[s.id] = {
        devoir1: g?.devoir1 != null ? String(g.devoir1) : "",
        devoir2: g?.devoir2 != null ? String(g.devoir2) : "",
        composition: g?.composition != null ? String(g.composition) : "",
      };
    });
    setCells(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, subject, term, db.students.length]);

  const moyenneFor = (sid: string) => {
    const c = cells[sid];
    if (!c) return 0;
    return computeMoyenne({ devoir1: parseNum(c.devoir1), devoir2: parseNum(c.devoir2), composition: parseNum(c.composition) });
  };

  const classAverage = useMemo(() => {
    const vals = students.map((s) => moyenneFor(s.id)).filter((v) => v > 0);
    if (!vals.length) return 0;
    return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, students]);

  const setCell = (sid: string, k: keyof Cell, v: string) => {
    setCells((prev) => ({ ...prev, [sid]: { ...prev[sid], [k]: v } }));
  };

  const save = () => {
    updateDB((d) => {
      students.forEach((s) => {
        const c = cells[s.id];
        if (!c) return;
        const d1 = parseNum(c.devoir1);
        const d2 = parseNum(c.devoir2);
        const comp = parseNum(c.composition);
        const moy = computeMoyenne({ devoir1: d1, devoir2: d2, composition: comp });
        const existing = d.grades.find((g) => g.studentId === s.id && g.subject === subject && g.term === term);
        if (existing) {
          existing.devoir1 = d1;
          existing.devoir2 = d2;
          existing.composition = comp;
          existing.value = moy;
        } else if (d1 != null || d2 != null || comp != null) {
          d.grades.push({ id: "grade-" + Math.random().toString(36).slice(2, 9), studentId: s.id, subject, term, devoir1: d1, devoir2: d2, composition: comp, value: moy });
        }
      });
      d.activities.unshift({ id: "act-" + Math.random().toString(36).slice(2, 7), type: "grade", text: `Notes ${subject} enregistrées (${term})`, date: new Date().toISOString() });
    });
    toast.success("Notes enregistrées");
  };

  return (
    <AppLayout title="Notes & Bulletins">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>
            {db.classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger><SelectValue placeholder="Matière" /></SelectTrigger>
          <SelectContent>
            {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={term} onValueChange={setTerm}>
          <SelectTrigger><SelectValue placeholder="Trimestre" /></SelectTrigger>
          <SelectContent>
            {TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={save}><Save className="mr-1.5 h-4 w-4" /> Enregistrer</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {!loaded ? (
            <TableSkeleton />
          ) : students.length === 0 ? (
            <EmptyState icon={GraduationCap} title="Aucun élève" description="Aucun élève dans cette classe." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Élève</TableHead>
                    <TableHead className="w-28">Devoir 1</TableHead>
                    <TableHead className="w-28">Devoir 2</TableHead>
                    <TableHead className="w-28">Composition</TableHead>
                    <TableHead className="w-28">Moyenne</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => {
                    const moy = moyenneFor(s.id);
                    const c = cells[s.id] ?? { devoir1: "", devoir2: "", composition: "" };
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                        <TableCell><Input type="number" min={0} max={20} step={0.25} value={c.devoir1} onChange={(e) => setCell(s.id, "devoir1", e.target.value)} /></TableCell>
                        <TableCell><Input type="number" min={0} max={20} step={0.25} value={c.devoir2} onChange={(e) => setCell(s.id, "devoir2", e.target.value)} /></TableCell>
                        <TableCell><Input type="number" min={0} max={20} step={0.25} value={c.composition} onChange={(e) => setCell(s.id, "composition", e.target.value)} /></TableCell>
                        <TableCell>
                          <Badge className={moy >= 10 ? "bg-success text-success-foreground" : moy > 0 ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"}>
                            {moy.toFixed(2)}/20
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-end gap-3 border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">Moyenne de la classe :</span>
                <Badge className={classAverage >= 10 ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>
                  {classAverage.toFixed(2)}/20
                </Badge>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
