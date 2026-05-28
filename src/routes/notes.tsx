import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useLoaded, TableSkeleton, EmptyState } from "@/components/shared";
import { useDB } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/notes")({
  component: NotesPage,
});

function NotesPage() {
  const db = useDB();
  const loaded = useLoaded();
  const [classId, setClassId] = useState(db.classes[0]?.id ?? "");

  const rows = useMemo(() => {
    const students = db.students.filter((s) => s.classId === classId);
    return students.map((s) => {
      const grades = db.grades.filter((g) => g.studentId === s.id);
      const avg = grades.length ? grades.reduce((sum, g) => sum + g.value, 0) / grades.length : 0;
      const subjects: Record<string, number> = {};
      grades.forEach((g) => (subjects[g.subject] = g.value));
      return { student: s, avg, subjects };
    }).sort((a, b) => b.avg - a.avg);
  }, [db, classId]);

  const allSubjects = Array.from(new Set(db.grades.map((g) => g.subject))).slice(0, 4);

  return (
    <AppLayout title="Notes & Bulletins">
      <div className="mb-4 max-w-xs">
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
          <SelectContent>
            {db.classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-4">
          {!loaded ? (
            <TableSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState icon={GraduationCap} title="Aucune note" description="Aucun élève ou note pour cette classe." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rang</TableHead>
                  <TableHead>Élève</TableHead>
                  {allSubjects.map((s) => (
                    <TableHead key={s}>{s}</TableHead>
                  ))}
                  <TableHead>Moyenne</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.student.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.student.firstName} {r.student.lastName}</TableCell>
                    {allSubjects.map((s) => (
                      <TableCell key={s}>{r.subjects[s] != null ? r.subjects[s].toFixed(1) : "—"}</TableCell>
                    ))}
                    <TableCell>
                      <Badge className={r.avg >= 10 ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>
                        {r.avg.toFixed(2)}/20
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
