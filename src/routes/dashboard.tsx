import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/AppLayout";

import { useDB } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { fcfa, timeAgo } from "@/lib/format";
import { visibleAnnouncements, formatDateFr } from "@/lib/announcements";
import { supabase } from "@/integrations/supabase/client";
import { resolveTeacherClasses } from "@/lib/teacher-scope";
import {
  Users, TrendingUp, AlertCircle, AlertTriangle, UserPlus, CreditCard,
  GraduationCap, CalendarCheck, FileText, BookOpen, ClipboardList, Megaphone,
  PieChart as PieChartIcon, Plus, ArrowUp, ArrowDown, Minus, Receipt,
  Wallet, Briefcase, Shield, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";

const ADMIN_ACTIONS = [
  { label: "Inscrire un élève", to: "/eleves", icon: UserPlus, description: "Ajouter un nouvel élève à l'établissement" },
  { label: "Créer une facture", to: "/scolarite", icon: Receipt, description: "Éditer une facture de scolarité" },
  { label: "Enregistrer un paiement", to: "/scolarite", icon: CreditCard, description: "Saisir un paiement reçu" },
  { label: "Nouvelle dépense", to: "/comptabilite", icon: Wallet, description: "Enregistrer une dépense" },
  { label: "Publier une annonce", to: "/annonces", icon: Megaphone, description: "Communiquer avec les parents et enseignants" },
  { label: "Ajouter un personnel", to: "/personnel", icon: Briefcase, description: "Enregistrer un enseignant ou membre du personnel" },
];

const SUPER_ADMIN_ACTIONS = [
  { label: "Console plateforme", to: "/super-admin", icon: Shield, description: "Vue d'ensemble des écoles et abonnements" },
];

const SECRETARY_ACTIONS = [
  { label: "Inscrire un élève", to: "/eleves", icon: UserPlus, description: "Ajouter un nouvel élève à l'établissement" },
  { label: "Créer une facture", to: "/scolarite", icon: Receipt, description: "Éditer une facture de scolarité" },
  { label: "Enregistrer un paiement", to: "/scolarite", icon: CreditCard, description: "Saisir un paiement reçu" },
  { label: "Publier une annonce", to: "/annonces", icon: Megaphone, description: "Communiquer avec les parents et enseignants" },
];

const TEACHER_ACTIONS = [
  { label: "Saisir des notes", to: "/notes", icon: GraduationCap, description: "Enregistrer des évaluations" },
  { label: "Prendre les présences", to: "/presences", icon: CalendarCheck, description: "Faire l'appel du jour" },
  { label: "Mes classes", to: "/classes", icon: BookOpen, description: "Voir mes classes" },
  { label: "Mes élèves", to: "/eleves", icon: Users, description: "Voir la liste de mes élèves" },
];

function QuickActionsDropdown({ role }: { role?: string }) {
  const { t } = useTranslation();
  const actions =
    role === "teacher" ? TEACHER_ACTIONS
    : role === "secretary" ? SECRETARY_ACTIONS
    : role === "super_admin" ? [...ADMIN_ACTIONS, ...SUPER_ADMIN_ACTIONS]
    : ADMIN_ACTIONS;


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="h-11 rounded-xl bg-[#0D2C54] px-4 text-sm font-semibold text-white shadow-[0_8px_24px_-12px_rgba(13,44,84,0.5)] hover:bg-[#0A2447]"
        >
          <Plus className="mr-1.5 h-4 w-4" /> {t("dashboard.newAction")}
          <ChevronRight className="ml-1.5 h-4 w-4 rotate-90 transition-transform data-[state=open]:-rotate-180" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t("dashboard.quickActionsLabel")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem key={action.label} asChild className="cursor-pointer py-2.5">
              <Link to={action.to} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/10 text-[#2563EB]">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{action.label}</div>
                  <div className="line-clamp-1 text-xs text-muted-foreground">{action.description}</div>
                </div>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}



export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});





function DashboardPage() {
  const { user } = useAuth();
  if (user?.role === "teacher") return <TeacherDashboard />;
  return <AdminDashboard />;
}

function AnnoncesWidget() {
  const { t } = useTranslation();
  const db = useDB();
  const { user } = useAuth();
  const items = visibleAnnouncements(db.announcements, user?.role).slice(0, 2);
  const href = "/annonces";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="h-4 w-4 text-secondary" /> {t("dashboard.recentAnnouncements")}
        </CardTitle>
        <Link to={href} className="text-xs font-medium text-primary hover:underline">Voir tout</Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && <p className="text-sm text-muted-foreground">{t("dashboard.noAnnouncements")}</p>}
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

  const myClasses = resolveTeacherClasses(user, db);
  const myClassIds = new Set(myClasses.map((c) => c.id));
  const myStudents = db.students.filter((s) => myClassIds.has(s.classId));
  const myStudentIds = new Set(myStudents.map((s) => s.id));

  const absentToday = db.attendance.filter(
    (a) => a.date === today && a.status === "absent" && myStudentIds.has(a.studentId),
  ).length;

  const mySubjectsForClasses = db.classSubjects.filter(
    (cs) => myClassIds.has(cs.classId) && (!cs.teacherId || true),
  );
  const gradedKeys = new Set(
    db.grades.map((g) => `${g.classId ?? ""}|${g.subjectId ?? g.subject}`),
  );
  const pendingEvals = mySubjectsForClasses.filter(
    (cs) => !gradedKeys.has(`${cs.classId}|${cs.id}`) && !gradedKeys.has(`${cs.classId}|${cs.name}`),
  ).length;

  const perClass = myClasses.map((c) => ({
    name: c.name,
    Élèves: db.students.filter((s) => s.classId === c.id).length,
  }));

  const quickActions = [
    { label: "Saisir des notes", icon: GraduationCap, to: "/notes" as const, tone: "bg-[#2563EB]/10 text-[#2563EB]" },
    { label: "Prendre les présences", icon: CalendarCheck, to: "/presences" as const, tone: "bg-[#15A05A]/12 text-[#15A05A]" },
    { label: "Mes élèves", icon: Users, to: "/eleves" as const, tone: "bg-[#0E9384]/10 text-[#0E9384]" },
    { label: "Mes classes", icon: BookOpen, to: "/classes" as const, tone: "bg-[#F58B1F]/15 text-[#F58B1F]" },
  ];

  return (
    <AppLayout title="Tableau de bord">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-['Sora'] text-2xl font-bold tracking-tight text-foreground md:text-[28px]">
            Bonjour, {user?.name?.split(" ")[0] ?? ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Voici un aperçu de vos classes et de vos élèves.</p>
        </div>
        <QuickActionsDropdown role={user?.role} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Mes classes" value={String(myClasses.length)} icon={BookOpen} tone="blue" sub={myClasses.length === 0 ? "Aucune classe assignée" : "classes assignées"} />
        <KpiCard label="Mes élèves" value={String(myStudents.length)} icon={Users} tone="green" sub="dans mes classes" />
        <KpiCard label="Absences aujourd'hui" value={String(absentToday)} icon={AlertCircle} tone="orange" sub={`sur ${myStudents.length} élèves`} />
        <KpiCard label="Notes à saisir" value={String(pendingEvals)} icon={ClipboardList} tone="red" sub="évaluations en attente" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="rounded-2xl border-border shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] lg:col-span-3">
          <CardHeader>
            <CardTitle className="font-['Sora'] text-base font-semibold text-foreground">
              Mes élèves par classe
            </CardTitle>
          </CardHeader>
          <CardContent>
            {perClass.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Aucune classe assignée.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={perClass} barCategoryGap={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF4" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} stroke="#64748B" />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} stroke="#64748B" />
                  <Tooltip cursor={{ fill: "rgba(37,99,235,0.06)" }} contentStyle={{ borderRadius: 12, border: "1px solid #E8EDF4", boxShadow: "0 8px 24px -12px rgba(15,23,42,0.15)" }} />
                  <Bar dataKey="Élèves" fill="#2563EB" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-['Sora'] text-base font-semibold text-foreground">{t("dashboard.quickActions")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {quickActions.map((q) => (
              <button
                key={q.label}
                onClick={() => navigate({ to: q.to })}
                className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left text-sm font-medium text-foreground transition hover:border-[#2563EB] hover:shadow-[0_8px_24px_-12px_rgba(37,99,235,0.25)]"
              >
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", q.tone)}>
                  <q.icon className="h-[18px] w-[18px]" />
                </span>
                {q.label}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="rounded-2xl border-border shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="font-['Sora'] text-base font-semibold text-foreground">Mes classes</CardTitle>
            <Link to="/classes" className="text-xs font-semibold text-[#2563EB] hover:underline">Voir tout</Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {myClasses.length === 0 && <p className="text-sm text-muted-foreground">Aucune classe assignée.</p>}
            {myClasses.map((c) => {
              const count = db.students.filter((s) => s.classId === c.id).length;
              return (
                <Link
                  key={c.id}
                  to="/classes"
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm transition hover:border-[#2563EB] hover:shadow-[0_8px_24px_-12px_rgba(37,99,235,0.2)]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/10 text-[#2563EB]">
                      <BookOpen className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-foreground">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.level ?? "—"}</div>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
                    {count} élèves
                  </span>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <AnnoncesWidget />
        </div>
      </div>
    </AppLayout>
  );
}

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

function AdminDashboard() {
  const { t } = useTranslation();
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

  // Donut: répartition des recettes encaissées par type de facture.
  const invoiceById = useMemo(() => new Map(db.payments.map((p) => [p.id, p])), [db.payments]);
  const paymentBreakdown = useMemo(() => {
    const acc = new Map<string, number>();
    for (const r of db.paymentRecords) {
      const inv = invoiceById.get(r.invoiceId);
      const type = (inv?.type || "Autre").toString();
      acc.set(type, (acc.get(type) ?? 0) + (r.amount || 0));
    }
    return Array.from(acc, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [db.paymentRecords, invoiceById]);
  const donutTotal = paymentBreakdown.reduce((s, x) => s + x.value, 0);
  const DONUT_COLORS = ["#2563EB", "#F58B1F", "#0E9384", "#15A05A", "#7C3AED", "#0D2C54"];

  // Trends — real, simple comparisons against the prior period.
  const lastMonth = (currentMonth + 11) % 12;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const enrolledThisMonth = db.students.filter((s) => {
    const d = s.enrolledAt ? new Date(s.enrolledAt) : null;
    return d && !isNaN(d.getTime()) && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  }).length;
  const enrolledLastMonth = db.students.filter((s) => {
    const d = s.enrolledAt ? new Date(s.enrolledAt) : null;
    return d && !isNaN(d.getTime()) && d.getFullYear() === lastMonthYear && d.getMonth() === lastMonth;
  }).length;
  const studentsTrend = pctDelta(enrolledThisMonth, enrolledLastMonth);

  const prevQuarterStart = quarterStart === 0 ? 9 : quarterStart - 3;
  const prevQuarterYear = quarterStart === 0 ? currentYear - 1 : currentYear;
  const prevTrimesterCA = db.paymentRecords.reduce((sum, r) => {
    const d = new Date(r.date);
    if (isNaN(d.getTime())) return sum;
    if (d.getFullYear() !== prevQuarterYear) return sum;
    const m = d.getMonth();
    if (m < prevQuarterStart || m >= prevQuarterStart + 3) return sum;
    return sum + (r.amount || 0);
  }, 0);
  const caTrend = pctDelta(trimesterCA, prevTrimesterCA);

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const absentYesterday = db.attendance.filter((a) => a.date === yesterday && a.status === "absent" && studentIds.has(a.studentId)).length;
  const absencesTrend = pctDelta(absentToday, absentYesterday);

  return (
    <AppLayout title={t("nav.dashboard")}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-['Sora'] text-2xl font-bold tracking-tight text-foreground md:text-[28px]">
            {t("dashboard.hello", { name: user?.name?.split(" ")[0] ?? "" })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("dashboard.adminSubtitle")}
          </p>
        </div>
        <QuickActionsDropdown role={user?.role} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("dashboard.kpiStudents")}
          value={String(totalStudents)}
          icon={Users}
          tone="blue"
          sub={showTargets && totalTarget > 0 ? t("dashboard.kpiSeats", { total: totalTarget }) : undefined}
          progress={showTargets && totalTarget > 0 ? targetPct : undefined}
          trend={studentsTrend}
        />
        <KpiCard
          label={t("dashboard.kpiRevenue")}
          value={fcfa(trimesterCA)}
          icon={TrendingUp}
          tone="green"
          sub={t("dashboard.kpiRevenueSub")}
          trend={caTrend}
        />
        <KpiCard
          label={t("dashboard.kpiRecovery")}
          value={`${recoveryRate}%`}
          valueClass={recoveryColor}
          icon={PieChartIcon}
          tone="orange"
          sub={t("dashboard.kpiRecoverySub", { amount: fcfa(remaining) })}
        />
        <KpiCard
          label={t("dashboard.kpiAbsences")}
          value={String(absentToday)}
          icon={AlertCircle}
          tone="red"
          sub={t("dashboard.kpiAbsencesSub", { total: totalStudents })}
          trend={absencesTrend}
          trendInvert
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="rounded-2xl border-border shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] lg:col-span-3">
          <CardHeader>
            <CardTitle className="font-['Sora'] text-base font-semibold text-foreground">{t("dashboard.revenueChart")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData} barCategoryGap={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF4" vertical={false} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} stroke="#64748B" />
                <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="#64748B" tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip cursor={{ fill: "rgba(37,99,235,0.06)" }} formatter={(v: any) => fcfa(Number(v))} contentStyle={{ borderRadius: 12, border: "1px solid #E8EDF4", boxShadow: "0 8px 24px -12px rgba(15,23,42,0.15)" }} />
                <Bar dataKey="Recettes" radius={[8, 8, 0, 0]}>
                  {revenueData.map((d, i) => (
                    <Cell key={i} fill={d.name === MONTH_LABELS[currentMonth] ? "#F58B1F" : "#2563EB"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-['Sora'] text-base font-semibold text-foreground">{t("dashboard.paymentBreakdown")}</CardTitle>
          </CardHeader>
          <CardContent>
            {donutTotal === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">{t("dashboard.noPayments")}</p>
            ) : (
              <div className="flex w-full flex-col items-center gap-4 md:flex-row">
                <div className="relative h-[200px] w-[200px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentBreakdown} dataKey="value" innerRadius={56} outerRadius={84} paddingAngle={2} stroke="none">
                        {paymentBreakdown.map((_, i) => (
                          <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => fcfa(Number(v))} contentStyle={{ borderRadius: 12, border: "1px solid #E8EDF4" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="font-['Sora'] text-2xl font-bold text-foreground">{recoveryRate}%</div>
                    <div className="text-[11px] text-muted-foreground">{t("dashboard.recovered")}</div>
                  </div>
                </div>
                <ul className="w-full min-w-0 flex-1 space-y-2 text-sm">
                  {paymentBreakdown.map((d, i) => {
                    const pct = donutTotal ? Math.round((d.value / donutTotal) * 100) : 0;
                    return (
                      <li key={d.name} className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                        <span className="min-w-0 flex-1 truncate text-foreground" title={d.name}>{d.name}</span>
                        <span className="shrink-0 pl-2 text-right tabular-nums text-muted-foreground">{pct}%</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="rounded-2xl border-border shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="font-['Sora'] text-base font-semibold text-foreground">{t("dashboard.recentActivity")}</CardTitle>
            <Link to="/notifications" className="text-xs font-semibold text-[#2563EB] hover:underline">{t("common.viewAll")}</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {db.activities.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("dashboard.noActivity")}</p>
            ) : (
              db.activities.slice(0, 6).map((a) => {
                const Icon = activityIcons[a.type];
                const tone = a.type === "payment" ? "bg-[#15A05A]/10 text-[#15A05A]"
                  : a.type === "student" ? "bg-[#2563EB]/10 text-[#2563EB]"
                  : a.type === "grade" ? "bg-[#0E9384]/10 text-[#0E9384]"
                  : "bg-[#F58B1F]/15 text-[#F58B1F]";
                return (
                  <div key={a.id} className="flex items-start gap-3 rounded-xl px-1 py-1">
                    <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", tone)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-foreground">{a.text}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(a.date)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-['Sora'] text-base font-semibold text-foreground">{t("dashboard.quickActions")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              { label: "Nouvel élève", icon: UserPlus, to: "/eleves" as const },
              { label: "Enregistrer un paiement", icon: CreditCard, to: "/scolarite" as const },
              { label: "Saisir des notes", icon: GraduationCap, to: "/notes" as const },
              { label: "Prendre les présences", icon: CalendarCheck, to: "/presences" as const },
            ].map((q) => (
              <button
                key={q.label}
                onClick={() => navigate({ to: q.to })}
                className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left text-sm font-medium text-foreground transition hover:border-[#2563EB] hover:shadow-[0_8px_24px_-12px_rgba(37,99,235,0.25)]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563EB]/10 text-[#2563EB]">
                  <q.icon className="h-[18px] w-[18px]" />
                </span>
                {q.label}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-border shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-['Sora'] text-base font-semibold text-foreground">
              <AlertTriangle className="h-4 w-4 text-destructive" /> {t("dashboard.alerts")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overdueStudents.length === 0 && <p className="text-sm text-muted-foreground">{t("dashboard.noAlerts")}</p>}
            {overdueStudents.map((s) => (
              <div key={s!.id} className="flex items-center gap-3 rounded-xl bg-destructive/5 p-3">
                <FileText className="h-4 w-4 text-destructive" />
                <div className="text-sm">
                  <span className="font-medium">{s!.firstName} {s!.lastName}</span> — {t("dashboard.unpaidInvoice")}
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={() => navigate({ to: "/scolarite" })}>
              {t("dashboard.viewAllPayments")}
            </Button>
          </CardContent>
        </Card>

        <AnnoncesWidget />
      </div>
    </AppLayout>
  );
}

function pctDelta(current: number, previous: number): number | null {
  if (!previous && !current) return 0;
  if (!previous) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

function TrendPill({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return null;
  const isUp = value > 0;
  const isFlat = value === 0;
  // For metrics where down is good (e.g. absences), invert color logic.
  const positive = isFlat ? false : invert ? !isUp : isUp;
  const cls = isFlat
    ? "bg-muted text-muted-foreground"
    : positive
    ? "bg-[#15A05A]/12 text-[#15A05A]"
    : "bg-destructive/10 text-destructive";
  const Icon = isFlat ? Minus : isUp ? ArrowUp : ArrowDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold", cls)}>
      <Icon className="h-3 w-3" />
      {isFlat ? "stable" : `${Math.abs(value)}%`}
    </span>
  );
}

function KpiCard({
  label, value, icon: Icon, tone, sub, progress, valueClass, trend, trendInvert,
}: {
  label: string;
  value: string;
  icon: typeof Users;
  tone: "blue" | "green" | "orange" | "red";
  sub?: string;
  progress?: number;
  valueClass?: string;
  trend?: number | null;
  trendInvert?: boolean;
}) {
  const tones: Record<string, string> = {
    blue: "bg-[#2563EB]/10 text-[#2563EB]",
    green: "bg-[#15A05A]/12 text-[#15A05A]",
    orange: "bg-[#F58B1F]/15 text-[#F58B1F]",
    red: "bg-destructive/10 text-destructive",
  };
  return (
    <Card className="rounded-2xl border-border shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
          {trend !== undefined && <TrendPill value={trend ?? null} invert={trendInvert} />}
        </div>
        <div className="mt-4">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className={cn("mt-1 truncate font-['Sora'] text-[28px] font-bold tracking-tight text-foreground", valueClass)}>{value}</div>
          {sub && <div className="mt-1 truncate text-xs text-muted-foreground">{sub}</div>}
          {typeof progress === "number" && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


