import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDB } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fcfa, timeAgo } from "@/lib/format";
import { gradeValue, appreciationFor, deriveInvoiceStatus, type Grade, type Payment } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { Bell, Calendar, GraduationCap, Receipt, UserCircle, LogOut, Wallet, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/parent")({
  component: ParentPortal,
});

type TabKey = "enfant" | "notes" | "presences" | "paiements" | "messages";

const TABS: { key: TabKey; label: string; icon: typeof UserCircle }[] = [
  { key: "enfant", label: "Mon Enfant", icon: UserCircle },
  { key: "notes", label: "Notes", icon: GraduationCap },
  { key: "presences", label: "Présences", icon: Calendar },
  { key: "paiements", label: "Paiements", icon: Wallet },
  { key: "messages", label: "Messages", icon: MessageSquare },
];

function ParentPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const db = useDB();
  const [tab, setTab] = useState<TabKey>("enfant");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("currentUser");
    if (!stored) navigate({ to: "/login" });
    else if (user && user.role !== "parent") navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const student = useMemo(() => {
    const sid = user?.studentId ?? db.students[0]?.id;
    return db.students.find((s) => s.id === sid);
  }, [user, db.students]);

  if (!student) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground">Aucun élève associé à votre compte.</p>
      </div>
    );
  }

  const klass = db.classes.find((c) => c.id === student.classId);
  const initials = (student.firstName[0] + student.lastName[0]).toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Logo compact />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-success text-success-foreground">Parent</Badge>
              </div>
              <p className="text-sm font-medium">Bienvenue, {user?.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => { logout(); navigate({ to: "/login" }); }} aria-label="Déconnexion">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-5">
        {tab === "enfant" && <EnfantTab student={student} klass={klass} initials={initials} grades={db.grades} payments={db.payments} attendance={db.attendance} />}
        {tab === "notes" && <NotesTab studentId={student.id} grades={db.grades} classSubjects={db.classSubjects.filter((s) => s.classId === student.classId)} />}
        {tab === "presences" && <PresencesTab studentId={student.id} attendance={db.attendance} />}
        {tab === "paiements" && <PaiementsTab studentId={student.id} payments={db.payments} />}
        {tab === "messages" && <MessagesTab />}
      </main>

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card">
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground transition-colors",
                  active && "text-primary",
                )}
              >
                <t.icon className="h-5 w-5" />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function EnfantTab({ student, klass, initials, grades, payments, attendance }: {
  student: any; klass: any; initials: string; grades: Grade[]; payments: Payment[]; attendance: any[];
}) {
  const studentGrades = grades.filter((g) => g.studentId === student.id);
  const lastTerm = "1er trimestre";
  const termGrades = studentGrades.filter((g) => g.term === lastTerm);
  const moy = termGrades.length
    ? Math.round((termGrades.reduce((s, g) => s + gradeValue(g), 0) / termGrades.length) * 100) / 100
    : 0;

  const month = new Date().toISOString().slice(0, 7);
  const absencesMois = attendance.filter((a) => a.studentId === student.id && a.date.startsWith(month) && a.status === "absent").length;

  const studentInvoices = payments.filter((p) => p.studentId === student.id);
  const due = studentInvoices.reduce((s, p) => s + Math.max(0, p.amount - p.amountPaid), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold">{student.firstName} {student.lastName}</h2>
            <div className="mt-1 flex items-center justify-center gap-2">
              <Badge variant="outline">{klass?.name ?? "—"}</Badge>
              <span className="text-xs text-muted-foreground">{student.code}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Moyenne générale" value={moy ? `${moy}/20` : "—"} icon={GraduationCap} tone="bg-secondary/10 text-secondary" />
        <SummaryCard label="Absences ce mois" value={String(absencesMois)} icon={Calendar} tone="bg-accent/10 text-accent" />
        <SummaryCard label="Frais impayés" value={fcfa(due)} icon={Wallet} tone="bg-destructive/10 text-destructive" />
        <SummaryCard label="Prochain examen" value="Composition" icon={Bell} tone="bg-primary/10 text-primary" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Activité récente</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {studentGrades.slice(0, 3).map((g) => (
            <div key={g.id} className="flex items-center justify-between text-sm">
              <span>{g.subject} — {g.term}</span>
              <Badge variant="secondary">{gradeValue(g)}/20</Badge>
            </div>
          ))}
          {studentGrades.length === 0 && <p className="text-sm text-muted-foreground">Aucune note récente.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }: any) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-4">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function NotesTab({ studentId, grades, classSubjects }: { studentId: string; grades: Grade[]; classSubjects: any[] }) {
  const [term, setTerm] = useState("1er trimestre");
  const termGrades = grades.filter((g) => g.studentId === studentId && g.term === term);

  const bySubject = classSubjects.map((subj) => {
    const list = termGrades.filter((g) => g.subject === subj.name);
    const avg = list.length ? Math.round((list.reduce((s, g) => s + gradeValue(g), 0) / list.length) * 100) / 100 : null;
    return { name: subj.name, coefficient: subj.coefficient, avg };
  });

  const totalWeighted = bySubject.reduce((s, r) => s + (r.avg ?? 0) * r.coefficient, 0);
  const totalCoef = bySubject.filter((r) => r.avg != null).reduce((s, r) => s + r.coefficient, 0);
  const general = totalCoef ? Math.round((totalWeighted / totalCoef) * 100) / 100 : 0;

  return (
    <div className="space-y-4">
      <Tabs value={term} onValueChange={setTerm}>
        <TabsList>
          <TabsTrigger value="1er trimestre">T1</TabsTrigger>
          <TabsTrigger value="2e trimestre">T2</TabsTrigger>
          <TabsTrigger value="3e trimestre">T3</TabsTrigger>
        </TabsList>
        <TabsContent value={term} className="mt-3">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matière</TableHead>
                    <TableHead className="text-center">Coef.</TableHead>
                    <TableHead className="text-right">Moyenne</TableHead>
                    <TableHead>Appréciation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bySubject.map((r) => {
                    const app = r.avg != null ? appreciationFor(r.avg) : null;
                    return (
                      <TableRow key={r.name}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-center">{r.coefficient}</TableCell>
                        <TableCell className="text-right">{r.avg != null ? `${r.avg}/20` : "—"}</TableCell>
                        <TableCell>{app && <Badge className={app.cls}>{app.label}</Badge>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between rounded-lg bg-primary/10 px-4 py-3">
                <span className="text-sm font-semibold text-primary">Moyenne générale</span>
                <span className="text-lg font-bold text-primary">{general}/20</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PresencesTab({ studentId, attendance }: { studentId: string; attendance: any[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStr = now.toISOString().slice(0, 7);
  const records = attendance.filter((a) => a.studentId === studentId && a.date.startsWith(monthStr));
  const recMap = new Map(records.map((r) => [r.date, r.status]));
  const absences = records.filter((r) => r.status === "absent").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
            <div key={i} className="py-1 font-semibold text-muted-foreground">{d}</div>
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const status = recMap.get(date);
            const cls =
              status === "present" ? "bg-success/20 text-success" :
              status === "absent" ? "bg-destructive/20 text-destructive" :
              status === "retard" ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground";
            return (
              <div key={day} className={cn("aspect-square rounded-md p-1 text-sm font-medium", cls)}>
                {day}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-destructive/5 px-4 py-3">
          <span className="text-sm">Absences ce mois</span>
          <Badge variant="destructive">{absences}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function PaiementsTab({ studentId, payments }: { studentId: string; payments: Payment[] }) {
  const list = payments.filter((p) => p.studentId === studentId);
  const due = list.reduce((s, p) => s + Math.max(0, p.amount - p.amountPaid), 0);
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <span className="text-sm font-medium">Total impayé</span>
          <span className="text-xl font-bold text-destructive">{fcfa(due)}</span>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Facture</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((p) => {
                const st = deriveInvoiceStatus(p.amount, p.amountPaid, p.dueDate);
                const variant = st === "paye" ? "default" : st === "partiel" ? "secondary" : "destructive";
                const label = st === "paye" ? "Payée" : st === "partiel" ? "Partiel" : st === "retard" ? "En retard" : "En attente";
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.invoiceNumber}</TableCell>
                    <TableCell className="text-sm">{p.type}</TableCell>
                    <TableCell className="text-right text-sm">{fcfa(p.amount)}</TableCell>
                    <TableCell><Badge variant={variant as any}>{label}</Badge></TableCell>
                  </TableRow>
                );
              })}
              {list.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Aucune facture.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MessagesTab() {
  const [read, setRead] = useState<Record<string, boolean>>({});
  const messages = [
    { id: "m1", title: "Réunion parents-professeurs", body: "Samedi 15 juin à 9h00 dans la cour de l'école.", date: new Date().toISOString() },
    { id: "m2", title: "Vacances de Pâques", body: "L'école sera fermée du 10 au 24 avril.", date: new Date(Date.now() - 86400000 * 3).toISOString() },
    { id: "m3", title: "Composition du 2e trimestre", body: "Les compositions auront lieu du 5 au 12 mars.", date: new Date(Date.now() - 86400000 * 7).toISOString() },
  ];
  return (
    <div className="space-y-3">
      {messages.map((m) => (
        <Card key={m.id} className={cn(!read[m.id] && "border-primary/40")}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{m.title}</h3>
                  {!read[m.id] && <span className="h-2 w-2 rounded-full bg-primary" />}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{m.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">{timeAgo(m.date)}</p>
              </div>
              {!read[m.id] && (
                <Button size="sm" variant="ghost" onClick={() => setRead({ ...read, [m.id]: true })}>
                  Marquer lu
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
