import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDB, updateDB, getDB } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fcfa } from "@/lib/format";
import { gradeValue, appreciationFor, deriveInvoiceStatus, type Grade, type Payment, type Student, type Classe } from "@/lib/types";
import { Logo } from "@/components/Logo";
import {
  Bell, Calendar, GraduationCap, UserCircle, LogOut, Wallet, MessageSquare,
  CheckCircle2, Inbox, BookOpen, CalendarCheck,
} from "lucide-react";
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

/** Ensures the parent has a linked student. Falls back to first student or
 *  creates a deterministic demo student if the DB has none. */
function ensureParentStudent(preferredId?: string): Student {
  const db = getDB();
  if (preferredId) {
    const found = db.students.find((s) => s.id === preferredId);
    if (found) return found;
  }
  if (db.students.length > 0) return db.students[0];

  // Create a demo student + matching class if needed.
  let classId = db.classes.find((c) => c.name === "CE1")?.id;
  if (!classId) {
    classId = "class-demo-ce1";
    updateDB((d) => {
      d.classes.push({
        id: classId!,
        name: "CE1",
        level: "CE1",
        teacherId: d.teachers[0]?.id ?? "teacher-demo",
        fees: 160000,
        capacity: 30,
      });
    });
  }
  const demo: Student = {
    id: "student-001",
    code: "EL-2026-001",
    firstName: "Arielle",
    lastName: "Ekane",
    gender: "F",
    classId: classId!,
    birthDate: "2018-03-15",
    parentName: "Marcel Ekane",
    parentPhone: "+237 677 111 222",
    parentEmail: "parent.ekane@gmail.com",
    parentRelation: "Père",
    status: "actif",
    enrolledAt: new Date().toISOString(),
  };
  updateDB((d) => {
    d.students.push(demo);
  });
  return demo;
}

function ParentPortal() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const db = useDB();
  const [tab, setTab] = useState<TabKey>("enfant");

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (user.role !== "parent") navigate({ to: "/dashboard", replace: true });
  }, [user, loading, isAuthenticated, navigate]);


  const student = useMemo(() => ensureParentStudent(user?.studentId), [user, db.students.length]);

  const klass = db.classes.find((c) => c.id === student.classId);
  const initials = (student.firstName[0] + student.lastName[0]).toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-24">
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

function EmptyState({ icon: Icon, message, tone = "muted" }: { icon: any; message: string; tone?: "muted" | "success" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full",
        tone === "success" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
      )}>
        <Icon className="h-6 w-6" />
      </div>
      <p className={cn("text-sm", tone === "success" ? "font-medium text-success" : "text-muted-foreground")}>{message}</p>
    </div>
  );
}

function EnfantTab({ student, klass, initials, grades, payments, attendance }: {
  student: Student; klass: Classe | undefined; initials: string; grades: Grade[]; payments: Payment[]; attendance: any[];
}) {
  const studentGrades = grades.filter((g) => g.studentId === student.id);
  const lastTerm = "1er trimestre";
  const termGrades = studentGrades.filter((g) => g.term === lastTerm);
  const moy = termGrades.length
    ? Math.round((termGrades.reduce((s, g) => s + gradeValue(g), 0) / termGrades.length) * 100) / 100
    : null;

  const month = new Date().toISOString().slice(0, 7);
  const absencesMois = attendance.filter((a) => a.studentId === student.id && a.date.startsWith(month) && a.status === "absent").length;

  const studentInvoices = payments.filter((p) => p.studentId === student.id);
  const due = studentInvoices.reduce((s, p) => s + Math.max(0, p.amount - p.amountPaid), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          {student.photo ? (
            <img src={student.photo} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">{initials}</AvatarFallback>
            </Avatar>
          )}
          <div>
            <h2 className="text-xl font-bold">{student.firstName} {student.lastName}</h2>
            <div className="mt-1 flex items-center justify-center gap-2">
              <Badge variant="outline">{klass?.name ?? "—"}</Badge>
              <span className="text-xs text-muted-foreground">{student.code ?? "—"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Moyenne générale" value={moy != null ? `${moy}/20` : "—"} icon={GraduationCap} tone="bg-secondary/10 text-secondary" />
        <SummaryCard label="Absences ce mois" value={String(absencesMois)} icon={Calendar} tone="bg-accent/10 text-accent" />
        <SummaryCard
          label="Frais impayés"
          value={fcfa(due)}
          icon={Wallet}
          tone={due > 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}
        />
        <SummaryCard label="Prochain cours" value="Lundi 08h00" icon={Bell} tone="bg-primary/10 text-primary" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Activité récente</CardTitle></CardHeader>
        <CardContent>
          {studentGrades.length === 0 ? (
            <EmptyState icon={Inbox} message="Aucune activité récente" />
          ) : (
            <div className="space-y-3">
              {studentGrades.slice(0, 3).map((g) => (
                <div key={g.id} className="flex items-center justify-between text-sm">
                  <span>{g.subject} — {g.term}</span>
                  <Badge variant="secondary">{gradeValue(g)}/20</Badge>
                </div>
              ))}
            </div>
          )}
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

  if (termGrades.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Tabs value={term} onValueChange={setTerm}>
            <TabsList>
              <TabsTrigger value="1er trimestre">T1</TabsTrigger>
              <TabsTrigger value="2e trimestre">T2</TabsTrigger>
              <TabsTrigger value="3e trimestre">T3</TabsTrigger>
            </TabsList>
          </Tabs>
          <EmptyState icon={BookOpen} message="Les notes ne sont pas encore disponibles pour ce trimestre" />
        </CardContent>
      </Card>
    );
  }

  const bySubject = classSubjects.map((subj) => {
    const list = termGrades.filter((g) => g.subject === subj.name);
    const avg = list.length ? Math.round((list.reduce((s, g) => s + gradeValue(g), 0) / list.length) * 100) / 100 : null;
    return { name: subj.name, coefficient: subj.coefficient, avg };
  });

  const totalWeighted = bySubject.reduce((s, r) => s + (r.avg ?? 0) * r.coefficient, 0);
  const totalCoef = bySubject.filter((r) => r.avg != null).reduce((s, r) => s + r.coefficient, 0);
  const general = totalCoef ? Math.round((totalWeighted / totalCoef) * 100) / 100 : 0;

  return (
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
        <CardTitle className="text-base capitalize">
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
        {records.length === 0 ? (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-success/10 px-4 py-3 text-success">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Aucune absence enregistrée ce mois-ci</span>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-destructive/5 px-4 py-3">
            <span className="text-sm">Absences ce mois</span>
            <Badge variant="destructive">{absences}</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PaiementsTab({ studentId, payments }: { studentId: string; payments: Payment[] }) {
  const list = payments.filter((p) => p.studentId === studentId);
  const due = list.reduce((s, p) => s + Math.max(0, p.amount - p.amountPaid), 0);

  if (list.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState icon={CheckCircle2} message="Aucune facture en attente" tone="success" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <span className="text-sm font-medium">Total impayé</span>
          <span className={cn("text-xl font-bold", due > 0 ? "text-destructive" : "text-success")}>{fcfa(due)}</span>
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
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MessagesTab() {
  return (
    <Card>
      <CardContent className="pt-6">
        <EmptyState icon={MessageSquare} message="Aucun message de l'école pour le moment" />
      </CardContent>
    </Card>
  );
}
