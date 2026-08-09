import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { EmptyStateBlock } from "@/components/states";
import { useLoaded, TableSkeleton, StatCard } from "@/components/shared";
import { useDB, updateDB } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarCheck, Check, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { resolveTeacherClasses } from "@/lib/teacher-scope";

export const Route = createFileRoute("/presences")({ component: PresencesPage });

type Status = "present" | "absent" | "retard";

function PresencesPage() {
  const db = useDB();
  const loaded = useLoaded();
  const { user } = useAuth();
  const visibleClasses = useMemo(
    () => (user?.role === "teacher" ? resolveTeacherClasses(user, db) : db.classes),
    [db, user],
  );
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [classId, setClassId] = useState(visibleClasses[0]?.id ?? "");

  const students = useMemo(() => db.students.filter((s) => s.classId === classId), [db.students, classId]);

  const statusOf = (studentId: string): Status => {
    const rec = db.attendance.find((a) => a.studentId === studentId && a.date === date);
    return (rec?.status as Status) ?? "present";
  };

  const setStatus = (studentId: string, status: Status) => {
    updateDB((d) => {
      const existing = d.attendance.find((a) => a.studentId === studentId && a.date === date);
      if (existing) existing.status = status;
      else d.attendance.push({ id: crypto.randomUUID(), studentId, date, status });
    });
  };

  const save = () => {
    updateDB((d) => {
      d.activities.unshift({ id: crypto.randomUUID(), type: "attendance", text: `Présences enregistrées (${db.classes.find((c) => c.id === classId)?.name}) - ${date}`, date: new Date().toISOString() });
    });
    toast.success("Présences enregistrées avec succès");
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

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:flex-1">
          <div className="space-y-1.5">
            <Label>Classe</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
              <SelectContent>
                {visibleClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <Button onClick={save}>Enregistrer</Button>
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
                  <TableHead className="text-right">Statut</TableHead>
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
                            { v: "present", label: "P", title: "Présent", cls: "bg-success text-success-foreground" },
                            { v: "absent", label: "A", title: "Absent", cls: "bg-destructive text-destructive-foreground" },
                            { v: "retard", label: "R", title: "Retard", cls: "bg-accent text-accent-foreground" },
                          ] as const).map((opt) => (
                            <button
                              key={opt.v}
                              title={opt.title}
                              onClick={() => setStatus(s.id, opt.v)}
                              className={cn(
                                "h-9 w-9 rounded-md border text-sm font-bold transition-colors",
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
            <EmptyStateBlock icon={CalendarCheck} titleKey="emptyStudents" description="Aucun élève dans cette classe." />
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
