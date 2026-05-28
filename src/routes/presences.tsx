import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useLoaded, TableSkeleton, StatCard } from "@/components/shared";
import { useDB, updateDB } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarCheck, Check, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/presences")({
  component: PresencesPage,
});

type Status = "present" | "absent" | "retard";

function PresencesPage() {
  const db = useDB();
  const loaded = useLoaded();
  const today = new Date().toISOString().slice(0, 10);
  const [classId, setClassId] = useState(db.classes[0]?.id ?? "");

  const students = useMemo(() => db.students.filter((s) => s.classId === classId), [db.students, classId]);

  const statusOf = (studentId: string): Status => {
    const rec = db.attendance.find((a) => a.studentId === studentId && a.date === today);
    return (rec?.status as Status) ?? "present";
  };

  const setStatus = (studentId: string, status: Status) => {
    updateDB((d) => {
      const existing = d.attendance.find((a) => a.studentId === studentId && a.date === today);
      if (existing) existing.status = status;
      else d.attendance.push({ id: "att-" + Math.random().toString(36).slice(2, 9), studentId, date: today, status });
    });
  };

  const save = () => {
    updateDB((d) => {
      d.activities.unshift({ id: "act-" + Math.random().toString(36).slice(2, 7), type: "attendance", text: `Présences enregistrées (${db.classes.find((c) => c.id === classId)?.name})`, date: new Date().toISOString() });
    });
    toast.success("Présences enregistrées");
  };

  const presentCount = students.filter((s) => statusOf(s.id) === "present").length;
  const absentCount = students.filter((s) => statusOf(s.id) === "absent").length;
  const lateCount = students.filter((s) => statusOf(s.id) === "retard").length;

  return (
    <AppLayout title="Présences">
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Présents" value={String(presentCount)} icon={Check} tone="green" />
        <StatCard label="Absents" value={String(absentCount)} icon={X} tone="red" />
        <StatCard label="Retards" value={String(lateCount)} icon={Clock} tone="orange" />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xs flex-1">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
            <SelectContent>
              {db.classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={save}>Enregistrer les présences</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {!loaded ? (
            <TableSkeleton cols={2} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead className="text-right">Statut ({today})</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => {
                  const st = statusOf(s.id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1.5">
                          {([
                            { v: "present", label: "Présent", cls: "bg-success text-success-foreground" },
                            { v: "absent", label: "Absent", cls: "bg-destructive text-destructive-foreground" },
                            { v: "retard", label: "Retard", cls: "bg-accent text-accent-foreground" },
                          ] as const).map((opt) => (
                            <button
                              key={opt.v}
                              onClick={() => setStatus(s.id, opt.v)}
                              className={cn(
                                "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                                st === opt.v ? opt.cls + " border-transparent" : "border-border text-muted-foreground hover:bg-muted",
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {loaded && students.length === 0 && (
            <div className="flex flex-col items-center py-12 text-center text-muted-foreground">
              <CalendarCheck className="mb-2 h-8 w-8" />
              Aucun élève dans cette classe.
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
