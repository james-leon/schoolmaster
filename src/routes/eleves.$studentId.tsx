import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useDB } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Mail, Phone, MessageCircle } from "lucide-react";
import { fcfa } from "@/lib/format";
import { TERMS, gradeValue, type StudentStatus, type Grade } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

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
  const db = useDB();
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
        </CardContent>
      </Card>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
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
            <Card>
              <CardHeader><CardTitle className="text-base">Parent / Tuteur</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Nom" value={student.parentName} />
                <Row label="Relation" value={student.parentRelation ?? "—"} />
                <Row label="Téléphone" value={<span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{student.parentPhone}</span>} />
                {student.parentEmail && <Row label="Email" value={<span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{student.parentEmail}</span>} />}
                {student.parentWhatsapp && <Row label="WhatsApp" value={<span className="inline-flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" />{student.parentWhatsapp}</span>} />}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-4">
          {TERMS.map((term) => {
            const list = grades.filter((g) => g.term === term);
            if (!list.length) return null;
            const avg = list.length ? Math.round((list.reduce((s, g) => s + (g.value || computeMoyenne(g)), 0) / list.length) * 100) / 100 : 0;
            return (
              <Card key={term}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{term}</CardTitle>
                  <Badge variant="secondary">Moyenne : {avg}/20</Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Matière</TableHead>
                        <TableHead className="text-right">Devoir 1</TableHead>
                        <TableHead className="text-right">Devoir 2</TableHead>
                        <TableHead className="text-right">Composition</TableHead>
                        <TableHead className="text-right">Moyenne</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((g) => (
                        <TableRow key={g.id}>
                          <TableCell className="font-medium">{g.subject}</TableCell>
                          <TableCell className="text-right">{g.devoir1 ?? "—"}</TableCell>
                          <TableCell className="text-right">{g.devoir2 ?? "—"}</TableCell>
                          <TableCell className="text-right">{g.composition ?? "—"}</TableCell>
                          <TableCell className="text-right font-semibold">{g.value || computeMoyenne(g)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
          {grades.length === 0 && <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Aucune note enregistrée.</CardContent></Card>}
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
