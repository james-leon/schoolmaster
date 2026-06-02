import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { TrendingUp, Banknote, Users, Sparkles } from "lucide-react";
import { PLAN_CONFIG, PLAN_LIST, type PlanId } from "@/lib/plans";
import { fcfa } from "@/lib/format";
import type { PlatformSchool } from "@/lib/super-admin-api";

const PLAN_COLORS: Record<PlanId, string> = {
  starter: "hsl(174 60% 45%)",   // teal
  pro: "hsl(220 60% 35%)",       // navy
  "school+": "hsl(28 90% 55%)",  // orange
};

const MONTHS_FR = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

function planOf(s: PlatformSchool): PlanId | null {
  const p = s.subscription_plan;
  if (p === "starter" || p === "pro" || p === "school+") return p;
  return null;
}

function priceOf(s: PlatformSchool): number {
  const p = planOf(s);
  return p ? PLAN_CONFIG[p].priceFcfa : 0;
}

export function MrrAnalytics({ schools }: { schools: PlatformSchool[] }) {
  const data = useMemo(() => {
    const active = schools.filter((s) => s.status === "active");
    const mrr = active.reduce((sum, s) => sum + priceOf(s), 0);
    const arr = mrr * 12;
    const arpu = active.length > 0 ? Math.round(mrr / active.length) : 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = schools.filter(
      (s) => new Date(s.created_at) >= startOfMonth,
    ).length;

    // Last 12 months series
    const months: { key: string; label: string; mrr: number; schools: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      let monthMrr = 0;
      let monthSchools = 0;
      for (const s of schools) {
        const created = new Date(s.created_at);
        if (created > endOfMonth) continue;
        // Approximate: school counted if not suspended/expired today and existed in that month
        if (s.status === "suspended") continue;
        monthSchools++;
        if (s.status === "active") monthMrr += priceOf(s);
      }
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: `${MONTHS_FR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        mrr: monthMrr,
        schools: monthSchools,
      });
    }

    // Breakdown by plan
    const breakdown = PLAN_LIST.map((p) => {
      const count = active.filter((s) => planOf(s) === p.id).length;
      const revenue = count * p.priceFcfa;
      return {
        plan: p.id,
        label: p.label,
        count,
        revenue,
        pct: mrr > 0 ? (revenue / mrr) * 100 : 0,
        color: PLAN_COLORS[p.id],
      };
    });

    return { mrr, arr, arpu, newThisMonth, months, breakdown, activeCount: active.length };
  }, [schools]);

  return (
    <section className="mt-6 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MrrKpi
          tone="green" icon={Banknote} label="MRR actuel"
          value={fcfa(data.mrr)} hint="Revenu mensuel récurrent" big
        />
        <MrrKpi
          tone="navy" icon={TrendingUp} label="Projection annuelle"
          value={fcfa(data.arr)} hint="ARR — revenu annuel"
        />
        <MrrKpi
          tone="blue" icon={Users} label="Revenu moyen par école"
          value={fcfa(data.arpu)} hint="ARPU"
        />
        <MrrKpi
          tone="orange" icon={Sparkles} label="Croissance ce mois"
          value={`+${data.newThisMonth} école${data.newThisMonth > 1 ? "s" : ""}`}
          hint="Nouvelles inscriptions"
        />
      </div>

      {/* MRR evolution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Évolution du MRR (12 derniers mois)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.months} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))" fontSize={12}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip
                  formatter={(v: number) => [fcfa(v), "MRR"]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Line
                  type="monotone" dataKey="mrr" stroke="hsl(142 70% 40%)"
                  strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Revenue by plan + breakdown table + growth chart */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition du revenu par plan</CardTitle>
          </CardHeader>
          <CardContent>
            {data.mrr === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Aucune école active pour le moment.
              </p>
            ) : (
              <>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.breakdown.filter((b) => b.revenue > 0)}
                        dataKey="revenue"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {data.breakdown.filter((b) => b.revenue > 0).map((b) => (
                          <Cell key={b.plan} fill={b.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number, n) => [fcfa(v), n as string]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan</TableHead>
                      <TableHead className="text-right">Écoles</TableHead>
                      <TableHead className="text-right">Revenu mensuel</TableHead>
                      <TableHead className="text-right">% du MRR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.breakdown.map((b) => (
                      <TableRow key={b.plan}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: b.color }} />
                            <span className="font-medium">{b.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{b.count}</TableCell>
                        <TableCell className="text-right">{fcfa(b.revenue)}</TableCell>
                        <TableCell className="text-right">{b.pct.toFixed(1)} %</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Évolution du nombre d'écoles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.months} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    formatter={(v: number) => [v, "Écoles"]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Bar dataKey="schools" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function MrrKpi({
  tone, icon: Icon, label, value, hint, big,
}: {
  tone: "green" | "navy" | "blue" | "orange";
  icon: any; label: string; value: string; hint: string; big?: boolean;
}) {
  const toneCls: Record<string, string> = {
    green: "bg-success/10 text-success",
    navy: "bg-primary/10 text-primary",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    orange: "bg-accent/10 text-accent",
  };
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={`mt-1 truncate font-bold tracking-tight ${big ? "text-2xl md:text-3xl" : "text-xl md:text-2xl"}`}>
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneCls[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
