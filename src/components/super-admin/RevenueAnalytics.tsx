import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Banknote, Building2, Users, CalendarClock } from "lucide-react";
import { PLAN_CONFIG, PLAN_LIST, normalizePlanId, type PlanId } from "@/lib/plans";
import { fcfa } from "@/lib/format";
import type { PlatformSchool } from "@/lib/super-admin-api";

const PLAN_COLORS: Record<PlanId, string> = {
  essentiel: "hsl(174 60% 45%)", // teal
  complet: "hsl(28 90% 55%)",    // orange
};

function planOf(s: PlatformSchool): PlanId | null {
  const p = s.subscription_plan;
  if (!p) return null;
  return normalizePlanId(p);
}

function priceOf(s: PlatformSchool): number {
  const p = planOf(s);
  return p ? PLAN_CONFIG[p].priceFcfa : 0;
}

export function RevenueAnalytics({ schools }: { schools: PlatformSchool[] }) {
  const { t } = useTranslation();
  const data = useMemo(() => {
    const active = schools.filter((s) => s.status === "active");
    const annual = active.reduce((sum, s) => sum + priceOf(s), 0);
    const avg = active.length > 0 ? Math.round(annual / active.length) : 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = schools.filter(
      (s) => new Date(s.created_at) >= startOfMonth,
    ).length;

    // Annual subscription revenue by renewal year (based on subscription_end).
    const byYearMap = new Map<number, { revenue: number; schools: number }>();
    for (const s of active) {
      const end = s.subscription_end;
      if (!end) continue;
      const y = new Date(end).getFullYear();
      if (Number.isNaN(y)) continue;
      const cur = byYearMap.get(y) ?? { revenue: 0, schools: 0 };
      cur.revenue += priceOf(s);
      cur.schools += 1;
      byYearMap.set(y, cur);
    }
    const byYear = [...byYearMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, v]) => ({ year: String(year), ...v }));

    // Breakdown by plan
    const breakdown = PLAN_LIST.map((p) => {
      const count = active.filter((s) => planOf(s) === p.id).length;
      const revenue = count * p.priceFcfa;
      return {
        plan: p.id,
        label: p.label,
        count,
        revenue,
        pct: annual > 0 ? (revenue / annual) * 100 : 0,
        color: PLAN_COLORS[p.id],
      };
    });

    // Upcoming renewals (next 90 days)
    const todayMs = Date.now();
    const upcoming = schools
      .filter((s) => s.status === "active" || s.status === "trial")
      .map((s) => {
        const end = s.subscription_end ?? s.trial_ends_at;
        if (!end) return null;
        const days = Math.ceil((new Date(end).getTime() - todayMs) / 86400000);
        return { school: s, end, days };
      })
      .filter((r): r is { school: PlatformSchool; end: string; days: number } =>
        r !== null && r.days >= 0 && r.days <= 90)
      .sort((a, b) => a.days - b.days)
      .slice(0, 8);

    return { annual, avg, newThisMonth, byYear, breakdown, upcoming, activeCount: active.length };
  }, [schools]);

  return (
    <section className="mt-6 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RevKpi
          tone="green" icon={Banknote} label={t("superAdmin.revenue.totalRevenue")}
          value={fcfa(data.annual)} hint={t("superAdmin.revenue.totalRevenueHint")} big
        />
        <RevKpi
          tone="navy" icon={Building2} label={t("superAdmin.revenue.subscribedSchools")}
          value={String(data.activeCount)} hint={t("superAdmin.revenue.subscribedSchoolsHint")}
        />
        <RevKpi
          tone="blue" icon={Users} label={t("superAdmin.revenue.avgRevenue")}
          value={fcfa(data.avg)} hint={t("superAdmin.revenue.avgRevenueHint")}
        />
        <RevKpi
          tone="orange" icon={CalendarClock} label={t("superAdmin.revenue.upcomingRenewals")}
          value={String(data.upcoming.length)} hint={t("superAdmin.revenue.upcomingRenewalsHint")}
        />
      </div>

      {/* Revenue by renewal year */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("superAdmin.revenue.byYearTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.byYear.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t("superAdmin.revenue.byYearEmpty")}
            </p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byYear} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))" fontSize={12}
                    tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                  />
                  <Tooltip
                    formatter={(v: number) => [fcfa(v), t("superAdmin.revenue.tooltipRevenue")]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Bar dataKey="revenue" fill="hsl(142 70% 40%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("superAdmin.revenue.breakdownTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.annual === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {t("superAdmin.revenue.breakdownEmpty")}
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
                      <TableHead>{t("superAdmin.revenue.breakdownColumns.plan")}</TableHead>
                      <TableHead className="text-right">{t("superAdmin.revenue.breakdownColumns.schools")}</TableHead>
                      <TableHead className="text-right">{t("superAdmin.revenue.breakdownColumns.revenue")}</TableHead>
                      <TableHead className="text-right">{t("superAdmin.revenue.breakdownColumns.pctOfTotal")}</TableHead>
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
            <CardTitle className="text-base">{t("superAdmin.revenue.upcomingTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcoming.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {t("superAdmin.revenue.upcomingEmpty")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("superAdmin.revenue.upcomingColumns.school")}</TableHead>
                    <TableHead>{t("superAdmin.revenue.upcomingColumns.dueDate")}</TableHead>
                    <TableHead className="text-right">{t("superAdmin.revenue.upcomingColumns.days")}</TableHead>
                    <TableHead className="text-right">{t("superAdmin.revenue.upcomingColumns.amountPerYear")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.upcoming.map((r) => (
                    <TableRow key={r.school.id}>
                      <TableCell className="font-medium">{r.school.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.end).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell className={`text-right text-sm ${r.days <= 15 ? "font-semibold text-destructive" : ""}`}>
                        {r.days} j
                      </TableCell>
                      <TableCell className="text-right text-sm">{fcfa(priceOf(r.school))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function RevKpi({
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
