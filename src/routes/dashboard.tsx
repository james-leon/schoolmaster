import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/shared";
import { useDB } from "@/lib/store";
import { fcfa, timeAgo } from "@/lib/format";
import { Users, TrendingUp, AlertCircle, AlertTriangle, UserPlus, CreditCard, GraduationCap, CalendarCheck, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

const LEVEL_GROUPS: Record<string, string> = {
  PS: "Maternelle",
  MS: "Maternelle",
  CP: "Primaire",
  CE1: "Primaire",
  CE2: "Primaire",
  CM1: "Primaire",
  CM2: "Primaire",
};

function DashboardPage() {
  const db = useDB();
  const navigate = useNavigate();

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);

  const totalStudents = db.students.length;
  const paymentsMonth = db.payments.filter((p) => p.date.startsWith(thisMonth)).reduce((s, p) => s + p.amount, 0);
  const monthPayments = db.payments.filter((p) => p.date.startsWith(thisMonth));
  const paymentsTotal = monthPayments.length ? monthPayments.reduce((s, p) => s + p.amount, 0) : db.payments.reduce((s, p) => s + p.amount, 0);
  const absentToday = db.attendance.filter((a) => a.date === today && a.status === "absent").length;
  const unpaid = db.payments.filter((p) => p.status === "impaye").length;

  // enrollments last 6 months
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin"];
  const enrollData = months.map((m, i) => ({
    name: m,
    Inscrits: 20 + Math.round(Math.sin(i) * 6) + i * 3,
    Objectif: 30 + i * 2,
  }));

  // level distribution
  const levelCount: Record<string, number> = { Maternelle: 0, Primaire: 0 };
  const detail: Record<string, number> = {};
  db.students.forEach((s) => {
    const cls = db.classes.find((c) => c.id === s.classId);
    if (cls) {
      detail[cls.level] = (detail[cls.level] || 0) + 1;
      levelCount[LEVEL_GROUPS[cls.level]]++;
    }
  });
  const pieData = Object.entries(detail).map(([name, value]) => ({ name, value }));
  const pieColors = ["#1A6BB5", "#F58B1F", "#1A7A3C", "#0D2C54", "#C0392B", "#7B61FF", "#16A085"];

  const activityIcons = { student: UserPlus, payment: CreditCard, grade: GraduationCap, attendance: CalendarCheck };

  const overdueStudents = db.payments
    .filter((p) => p.status === "impaye")
    .slice(0, 4)
    .map((p) => db.students.find((s) => s.id === p.studentId))
    .filter(Boolean);

  return (
    <AppLayout title="Tableau de bord">
      {/* Row 1 — KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Élèves" value={String(totalStudents)} icon={Users} tone="blue" />
        <StatCard label="Paiements du mois" value={fcfa(paymentsTotal)} icon={TrendingUp} tone="green" />
        <StatCard label="Absences aujourd'hui" value={String(absentToday)} icon={AlertCircle} tone="orange" />
        <StatCard label="Factures impayées" value={String(unpaid)} icon={AlertTriangle} tone="red" />
      </div>

      {/* Row 2 — charts */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Évolution des inscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={enrollData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Legend />
                <Bar dataKey="Inscrits" fill="#1A6BB5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Objectif" fill="#F58B1F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition par niveau</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 3 */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activité récente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {db.activities.slice(0, 8).map((a) => {
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
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions rapides</CardTitle>
          </CardHeader>
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
    </AppLayout>
  );
}
