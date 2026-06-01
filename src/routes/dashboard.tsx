import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/shared";
import { useDB } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { fcfa, timeAgo } from "@/lib/format";
import { visibleAnnouncements, formatDateFr } from "@/lib/announcements";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, TrendingUp, AlertCircle, AlertTriangle, UserPlus, CreditCard,
  GraduationCap, CalendarCheck, FileText, BookOpen, ClipboardList, Megaphone,
  PieChart as PieChartIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";


export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

const LEVEL_GROUPS: Record<string, string> = {
  PS: "Maternelle", MS: "Maternelle",
  CP: "Primaire", CE1: "Primaire", CE2: "Primaire", CM1: "Primaire", CM2: "Primaire",
};

const pieColors = ["#1A6BB5", "#F58B1F", "#1A7A3C", "#0D2C54", "#C0392B", "#7B61FF", "#16A085"];

function DashboardPage() {
  const { user } = useAuth();
  if (user?.role === "teacher") return <TeacherDashboard />;
  return <AdminDashboard />;
}

function AnnoncesWidget() {
  const db = useDB();
  const { user } = useAuth();
  const items = visibleAnnouncements(db.announcements, user?.role).slice(0, 2);
  const href = "/annonces";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="h-4 w-4 text-secondary" /> Annonces récentes
        </CardTitle>
        <Link to={href} className="text-xs font-medium text-primary hover:underline">Voir tout</Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Aucune annonce pour le moment</p>}
        {items.map((a) => (
          <Link key={a.id} to={href} className="block rounded-md border border-border p-3 transition hover:border-accent hover:bg-muted/40">
            <div className="flex items-center justify-between gap-2">
              <p className="line-clamp-1 text-sm font-semibold text-primary">{a.title}</p>
              <span className="shrink-0 text-[10px] text-muted-foreground">{formatDateFr(a.createdAt)}</span>
            </div>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{a.content}</p>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function TeacherDashboard() {
  const db = useDB();
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  // Resolve "my classes" from assignedClasses (matches by name or level).
  const assigned = user?.assignedClasses ?? [];
  const myClasses = db.classes.filter((c) => assigned.some((a) => c.name === a || c.level === a));
  const myClassIds = new Set(myClasses.map((c) => c.id));
  const myStudents = db.students.filter((s) => myClassIds.has(s.classId));
  const myStudentIds = new Set(myStudents.map((s) => s.id));

  const absentToday = db.attendance.filter(
    (a) => a.date === today && a.status === "absent" && myStudentIds.has(a.studentId),
  ).length;

  // Pending evaluations: subjects×classes assigned to teacher that have no grades yet this term.
  const mySubjectsForClasses = db.classSubjects.filter(
    (cs) => myClassIds.has(cs.classId) && (!cs.teacherId || true),
  );
  const gradedKeys = new Set(
    db.grades.map((g) => `${g.classId ?? ""}|${g.subjectId ?? g.subject}`),
  );
  const pendingEvals = mySubjectsForClasses.filter(
    (cs) => !gradedKeys.has(`${cs.classId}|${cs.id}`) && !gradedKeys.has(`${cs.classId}|${cs.name}`),
  ).length;

  // Charts — scoped to teacher's classes
  const perClass = myClasses.map((c) => ({
    name: c.name,
    Élèves: db.students.filter((s) => s.classId === c.id).length,
  }));

  return (
    <AppLayout title="Tableau de bord">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Mes Élèves" value={String(myStudents.length)} icon={Users} tone="blue" />
        <StatCard label="Mes Classes" value={String(myClasses.length)} icon={BookOpen} tone="green" />
        <StatCard label="Absences aujourd'hui" value={String(absentToday)} icon={AlertCircle} tone="orange" />
        <StatCard label="Notes à saisir" value={String(pendingEvals)} icon={ClipboardList} tone="red" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Répartition de mes élèves par classe</CardTitle>
          </CardHeader>
          <CardContent>
            {perClass.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Aucune classe assignée.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={perClass}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                  <Bar dataKey="Élèves" fill="#1A6BB5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <AnnoncesWidget />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions rapides</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              { label: "Saisir notes", icon: GraduationCap, to: "/notes" as const },
              { label: "Prendre présence", icon: CalendarCheck, to: "/presences" as const },
              { label: "Mes élèves", icon: Users, to: "/eleves" as const },
              { label: "Mes classes", icon: BookOpen, to: "/classes" as const },
            ].map((q) => (
              <button
                key={q.label}
                onClick={() => navigate({ to: q.to })}
                className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 p-4 text-center text-sm font-medium transition-colors hover:border-accent hover:bg-accent/10"
              >
                <q.icon className="h-6 w-6 text-secondary" />
                {q.label}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mes classes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myClasses.length === 0 && <p className="text-sm text-muted-foreground">Aucune classe assignée.</p>}
            {myClasses.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  {db.students.filter((s) => s.classId === c.id).length} élèves
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

function AdminDashboard() {
  const db = useDB();
  const { user } = useAuth();
  const navigate = useNavigate();

  const today = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11
  const quarterStart = Math.floor(currentMonth / 3) * 3; // 0,3,6,9

  // Filter all data by current school (defensive — supabase-sync already scopes,
  // but if any legacy entry leaked in we exclude it).
  const schoolId = user?.schoolId;
  const studentIds = new Set(db.students.map((s) => s.id));
  const activeStudents = db.students.filter((s) => (s.status ?? "actif") === "actif");
  const totalStudents = activeStudents.length;

  // Financial KPIs
  const totalExpected = db.payments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalCollected = db.payments.reduce((s, p) => s + (p.amountPaid || 0), 0);
  const remaining = Math.max(0, totalExpected - totalCollected);
  const recoveryRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
  const recoveryColor =
    recoveryRate >= 80 ? "text-success" : recoveryRate >= 50 ? "text-accent" : "text-destructive";

  // Chiffre d'affaires this trimester (current calendar quarter)
  const trimesterCA = db.paymentRecords.reduce((sum, r) => {
    const d = new Date(r.date);
    if (isNaN(d.getTime())) return sum;
    if (d.getFullYear() !== currentYear) return sum;
    const m = d.getMonth();
    if (m < quarterStart || m >= quarterStart + 3) return sum;
    return sum + (r.amount || 0);
  }, 0);

  const absentToday = db.attendance.filter((a) => a.date === today && a.status === "absent" && studentIds.has(a.studentId)).length;

  // Fetch enrollment targets + toggle from the school record.
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [showTargets, setShowTargets] = useState(false);
  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    supabase.from("schools").select("enrollment_targets, show_enrollment_targets").eq("id", schoolId).maybeSingle().then(({ data }) => {
      if (cancelled) return;
      setTargets((data?.enrollment_targets ?? {}) as Record<string, number>);
      setShowTargets(Boolean((data as any)?.show_enrollment_targets));
    });
    return () => { cancelled = true; };
  }, [schoolId]);

  // Enrolled per month (current year)
  const enrolledByMonth = new Array(12).fill(0) as number[];
  for (const s of db.students) {
    if (!s.enrolledAt) continue;
    const d = new Date(s.enrolledAt);
    if (isNaN(d.getTime()) || d.getFullYear() !== currentYear) continue;
    enrolledByMonth[d.getMonth()] += 1;
  }
  const enrollData = MONTH_LABELS.map((m, i) => {
    const row: { name: string; Inscrits: number; Objectif?: number } = {
      name: m,
      Inscrits: enrolledByMonth[i],
    };
    if (showTargets) row.Objectif = Number(targets[String(i + 1)] ?? 0);
    return row;
  });

  // Recettes per month (current year) — sum of payment records
  const revenueByMonth = new Array(12).fill(0) as number[];
  for (const r of db.paymentRecords) {
    const d = new Date(r.date);
    if (isNaN(d.getTime()) || d.getFullYear() !== currentYear) continue;
    revenueByMonth[d.getMonth()] += r.amount || 0;
  }
  const revenueData = MONTH_LABELS.map((m, i) => ({ name: m, Recettes: revenueByMonth[i] }));

  // Yearly target total (for Card 1 helper)
  const totalTarget = showTargets
    ? Object.values(targets).reduce((s, v) => s + (Number(v) || 0), 0)
    : 0;
  const targetPct = totalTarget > 0 ? Math.min(100, Math.round((totalStudents / totalTarget) * 100)) : 0;

  const activityIcons = { student: UserPlus, payment: CreditCard, grade: GraduationCap, attendance: CalendarCheck };

  const overdueStudents = db.payments
    .filter((p) => p.status === "impaye")
    .slice(0, 5)
    .map((p) => db.students.find((s) => s.id === p.studentId))
    .filter(Boolean);

  return (
    <AppLayout title="Tableau de bord">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Élèves inscrits"
          value={String(totalStudents)}
          icon={Users}
          tone="blue"
          sub={showTargets && totalTarget > 0 ? `Objectif : ${totalTarget}` : undefined}
          progress={showTargets && totalTarget > 0 ? targetPct : undefined}
        />
        <KpiCard
          label="Chiffre d'affaires"
          value={fcfa(trimesterCA)}
          icon={TrendingUp}
          tone="green"
          sub="Ce trimestre"
        />
        <KpiCard
          label="Taux de recouvrement"
          value={`${recoveryRate} %`}
          valueClass={recoveryColor}
          icon={PieChartIcon}
          tone="orange"
          sub={`${fcfa(remaining)} restants`}
        />
        <KpiCard
          label="Absences aujourd'hui"
          value={String(absentToday)}
          icon={AlertCircle}
          tone="red"
          sub={`sur ${totalStudents} élèves`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Recettes par mois</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v: any) => fcfa(Number(v))} />
                <Bar dataKey="Recettes" fill="#1A7A3C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Évolution des inscriptions</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={enrollData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Legend />
                <Bar dataKey="Inscrits" fill="#1A6BB5" radius={[4, 4, 0, 0]} />
                {showTargets && <Bar dataKey="Objectif" fill="#F58B1F" radius={[4, 4, 0, 0]} />}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>



      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Activité récente</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {db.activities.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucune activité récente</p>
            ) : (
              db.activities.slice(0, 8).map((a) => {
                const Icon = activityIcons[a.type];
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-secondary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{a.text}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(a.date)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Actions rapides</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              { label: "Nouvel élève", icon: UserPlus, to: "/eleves" as const },
              { label: "Enregistrer paiement", icon: CreditCard, to: "/scolarite" as const },
              { label: "Saisir notes", icon: GraduationCap, to: "/notes" as const },
              { label: "Prendre présence", icon: CalendarCheck, to: "/presences" as const },
            ].map((q) => (
              <button
                key={q.label}
                onClick={() => navigate({ to: q.to })}
                className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 p-4 text-center text-sm font-medium transition-colors hover:border-accent hover:bg-accent/10"
              >
                <q.icon className="h-6 w-6 text-secondary" />
                {q.label}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Alertes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overdueStudents.length === 0 && <p className="text-sm text-muted-foreground">Aucune alerte.</p>}
            {overdueStudents.map((s) => (
              <div key={s!.id} className="flex items-center gap-3 rounded-md bg-destructive/5 p-2.5">
                <FileText className="h-4 w-4 text-destructive" />
                <div className="text-sm">
                  <span className="font-medium">{s!.firstName} {s!.lastName}</span> — facture impayée
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={() => navigate({ to: "/scolarite" })}>
              Voir tous les paiements
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <AnnoncesWidget />
      </div>
    </AppLayout>
  );
}

function KpiCard({
  label, value, icon: Icon, tone, sub, progress, valueClass,
}: {
  label: string;
  value: string;
  icon: typeof Users;
  tone: "blue" | "green" | "orange" | "red";
  sub?: string;
  progress?: number;
  valueClass?: string;
}) {
  const tones: Record<string, string> = {
    blue: "bg-secondary/10 text-secondary",
    green: "bg-success/10 text-success",
    orange: "bg-accent/15 text-accent",
    red: "bg-destructive/10 text-destructive",
  };
  return (
    <Card className="shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", tones[tone])}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn("truncate text-2xl font-bold tracking-tight", valueClass)}>{value}</div>
            <div className="truncate text-sm text-muted-foreground">{label}</div>
            {sub && <div className="mt-1 truncate text-xs text-muted-foreground">{sub}</div>}
            {typeof progress === "number" && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-secondary" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

