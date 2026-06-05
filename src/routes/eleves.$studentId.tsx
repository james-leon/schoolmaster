import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useDB } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, ShieldCheck } from "lucide-react";
import { fcfa } from "@/lib/format";
import { TERMS, gradeValue, type StudentStatus, type Grade } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ParentsTuteursTab } from "@/components/ParentsTuteursTab";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/eleves/$studentId")({
  component: StudentDetailPage,
});

function statusBadge(s?: StudentStatus) {
  const map: Record<StudentStatus, { label: string; cls: string }> = {
    actif: { label: "Actif", cls: "bg-success/15 text-success" },
    inactif: { label: "Inactif", cls: "bg-muted text-muted-foreground" },
    transfere: { label: "Transféré", cls: "bg-accent/20 text-accent" },
  };
  const v = map[s ?? "actif"];
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", v.cls)}>{v.label}</span>;
}

function StudentDetailPage() {
  const { studentId } = useParams({ from: "/eleves/$studentId" });
  const { user } = useAuth();
  const db = useDB();
  const school = db.schools.find((s) => s.id === user?.schoolId);
  const student = db.students.find((s) => s.id === studentId);
  const cls = student ? db.classes.find((c) => c.id === student.classId) : null;

  const grades = useMemo(() => db.grades.filter((g) => g.studentId === studentId), [db.grades, studentId]);
  const payments = useMemo(() => db.payments.filter((p) => p.studentId === studentId), [db.payments, studentId]);
  const attendance = useMemo(() => db.attendance.filter((a) => a.studentId === studentId), [db.attendance, studentId]);

  if (!student) {
    return (
      <AppLayout title="Élève introuvable">
        <Card><CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Cet élève n'existe pas.</p>
          <Button asChild className="mt-4"><Link to="/eleves">Retour à la liste</Link></Button>
        </CardContent></Card>
      </AppLayout>
    );
  }

  const initials = (student.firstName[0] ?? "").toUpperCase() + (student.lastName[0] ?? "").toUpperCase();

  // attendance calendar — last 30 days
  const calendar = useMemo(() => {
    const days: { date: string; status?: "present" | "absent" | "retard" }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const rec = attendance.find((a) => a.date === iso);
      days.push({ date: iso, status: rec?.status });
    }
    return days;
  }, [attendance]);

  const dayCls = (s?: string) =>
    s === "present" ? "bg-success/20 text-success" :
    s === "absent" ? "bg-destructive/20 text-destructive" :
    s === "retard" ? "bg-accent/20 text-accent" :
    "bg-muted text-muted-foreground";
  const dayLabel = (s?: string) => (s === "present" ? "P" : s === "absent" ? "A" : s === "retard" ? "R" : "·");

  return (
    <AppLayout title={`${student.firstName} ${student.lastName}`}>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/eleves"><ArrowLeft className="mr-1.5 h-4 w-4" /> Retour</Link>
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
          {student.photo ? (
            <img src={student.photo} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
              {initials}
            </div>
          )}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">{student.firstName} {student.lastName}</h2>
              {statusBadge(student.status)}
              {student.consentGiven ? (
                <Badge variant="outline" className="border-success/40 text-success">
                  <ShieldCheck className="mr-1 h-3 w-3" /> Consentement OK
                </Badge>
              ) : (
                <Badge variant="outline" className="border-accent/50 text-accent">Consentement à recueillir</Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{cls?.name ?? "—"}</Badge>
              <span>{student.code ?? "—"}</span>
              <span>•</span>
              <span>{student.gender === "M" ? "Garçon" : "Fille"}</span>
              <span>•</span>
              <span>Né(e) le {student.birthDate}</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const payload = {
                  exportedAt: new Date().toISOString(),
                  school: school?.name,
                  student,
                  classe: cls,
                  grades,
                  payments,
                  attendance,
                  parents: db.parents.filter((p) => p.studentId === student.id),
                };
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `donnees-${student.lastName}-${student.firstName}-${student.id.slice(0, 8)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="mr-1.5 h-4 w-4" /> Exporter les données
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="parents">Parents &amp; Tuteurs</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="paiements">Paiements</TabsTrigger>
          <TabsTrigger value="presences">Présences</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Identité</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Code élève" value={student.code ?? "—"} />
                <Row label="Prénom" value={student.firstName} />
                <Row label="Nom" value={student.lastName} />
                <Row label="Genre" value={student.gender === "M" ? "Masculin" : "Féminin"} />
                <Row label="Date de naissance" value={student.birthDate} />
                <Row label="Classe" value={cls?.name ?? "—"} />
                <Row label="Inscrit le" value={student.enrolledAt} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="parents" className="mt-4">
          <ParentsTuteursTab studentId={studentId} schoolName={school?.name} />
        </TabsContent>


        <TabsContent value="notes" className="mt-4 space-y-4">
          <NotesTab studentId={studentId} grades={grades} classId={student.classId} />
        </TabsContent>

        <TabsContent value="paiements" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">Aucune facture.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead className="text-right">Payé</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.type}</TableCell>
                        <TableCell className="text-muted-foreground">{p.date}</TableCell>
                        <TableCell className="text-right">{fcfa(p.amount)}</TableCell>
                        <TableCell className="text-right">{fcfa(p.amountPaid)}</TableCell>
                        <TableCell className="text-muted-foreground">{p.mode ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === "paye" ? "default" : p.status === "partiel" ? "secondary" : "destructive"}>
                            {p.status === "paye" ? "Payée" : p.status === "partiel" ? "Partiel" : p.status === "retard" ? "En retard" : "En attente"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="presences" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Présences — 30 derniers jours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2 sm:grid-cols-10">
                {calendar.map((d) => (
                  <div key={d.date} className={cn("flex flex-col items-center rounded-md p-2 text-xs", dayCls(d.status))}>
                    <span className="font-mono">{d.date.slice(5)}</span>
                    <span className="mt-1 text-base font-bold">{dayLabel(d.status)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-success/40" /> Présent (P)</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-destructive/40" /> Absent (A)</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-accent/40" /> Retard (R)</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function NotesTab({ studentId, grades, classId }: { studentId: string; grades: Grade[]; classId: string }) {
  const db = useDB();
  const subjects = db.classSubjects.filter((s) => s.classId === classId);

  const termData = TERMS.map((term) => {
    const subjAvgs = subjects.map((sub) => {
      const list = grades.filter((g) => g.subject === sub.name && g.term === term);
      if (!list.length) return { sub, avg: null as number | null, entries: list };
      const vals = list.map(gradeValue);
      const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
      return { sub, avg, entries: list };
    });
    let sumW = 0, sumC = 0;
    subjAvgs.forEach(({ sub, avg }) => { if (avg != null) { sumW += avg * sub.coefficient; sumC += sub.coefficient; } });
    const gen = sumC ? Math.round((sumW / sumC) * 100) / 100 : null;

    // rank
    const all = db.students.filter((s) => s.classId === classId).map((s) => {
      const gs = db.grades.filter((g) => g.studentId === s.id && g.term === term);
      let w = 0, c = 0;
      subjects.forEach((sub) => {
        const l = gs.filter((g) => g.subject === sub.name);
        if (!l.length) return;
        const v = l.map(gradeValue);
        const a = v.reduce((x, y) => x + y, 0) / v.length;
        w += a * sub.coefficient; c += sub.coefficient;
      });
      return { id: s.id, g: c ? w / c : null };
    }).sort((a, b) => (b.g ?? -1) - (a.g ?? -1));
    const rank = gen != null ? all.findIndex((x) => x.id === studentId) + 1 : 0;

    return { term, subjAvgs, gen, rank };
  });

  const chartData = termData.map((t) => ({ name: t.term.replace("trimestre", "T."), moyenne: t.gen ?? 0 }));
  const hasAny = termData.some((t) => t.gen != null);

  return (
    <>
      <Tabs defaultValue={TERMS[0]}>
        <TabsList>
          {TERMS.map((t) => <TabsTrigger key={t} value={t}>{t}</TabsTrigger>)}
        </TabsList>
        {termData.map((td) => (
          <TabsContent key={td.term} value={td.term} className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{td.term}</CardTitle>
                <div className="flex gap-2">
                  {td.gen != null && <Badge variant="secondary">Moyenne : {td.gen.toFixed(2)}/20</Badge>}
                  {td.rank > 0 && <Badge>Rang : {td.rank === 1 ? "1er" : `${td.rank}ème`}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matière</TableHead>
                      <TableHead className="text-center">Coef</TableHead>
                      <TableHead className="text-center">Dev 1</TableHead>
                      <TableHead className="text-center">Dev 2</TableHead>
                      <TableHead className="text-center">Comp</TableHead>
                      <TableHead className="text-center">Oral</TableHead>
                      <TableHead className="text-right">Moyenne</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {td.subjAvgs.map(({ sub, avg, entries }) => {
                      const find = (et: string) => entries.find((e) => e.evaluationType === et)?.grade;
                      const d1 = find("Devoir 1") ?? entries.find((e) => !e.evaluationType)?.devoir1;
                      const d2 = find("Devoir 2") ?? entries.find((e) => !e.evaluationType)?.devoir2;
                      const comp = find("Composition") ?? entries.find((e) => !e.evaluationType)?.composition;
                      const oral = find("Oral");
                      return (
                        <TableRow key={sub.id}>
                          <TableCell className="font-medium">{sub.name}</TableCell>
                          <TableCell className="text-center">{sub.coefficient}</TableCell>
                          <TableCell className="text-center">{d1 ?? "—"}</TableCell>
                          <TableCell className="text-center">{d2 ?? "—"}</TableCell>
                          <TableCell className="text-center">{comp ?? "—"}</TableCell>
                          <TableCell className="text-center">{oral ?? "—"}</TableCell>
                          <TableCell className="text-right font-semibold">{avg != null ? avg.toFixed(2) : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {hasAny && (
        <Card>
          <CardHeader><CardTitle className="text-base">Évolution de la moyenne générale</CardTitle></CardHeader>
          <CardContent>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis domain={[0, 20]} className="text-xs" />
                  <Tooltip />
                  <Line type="monotone" dataKey="moyenne" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasAny && <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Aucune note enregistrée.</CardContent></Card>}
    </>
  );
}
