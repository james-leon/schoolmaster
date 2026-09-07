import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Bus, Phone, Mail, Crown, Users, AlertTriangle } from "lucide-react";
import { usePlan } from "@/lib/usePlan";
import { PLAN_LIST, TRANSPORT_ADDON, INCLUDED_FEATURES, FEATURE_LABELS, WINTEK_CONTACT } from "@/lib/plans";
import { fcfa } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/mon-abonnement")({ component: MonAbonnementPage });

function MonAbonnementPage() {
  const { t } = useTranslation();
  const {
    plan, planId, planLabel, effectiveStatus, hasTransport,
    isTrial, daysLeftInTrial,
    subscriptionStart, subscriptionEnd, daysUntilExpiry,
    studentCount, maxStudents, isUnlimited, usagePct,
    atStudentLimit, nearStudentLimit,
    loading,
  } = usePlan();
  const navigate = useNavigate();

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";

  let expiryTone = "text-success";
  if (daysUntilExpiry != null) {
    if (daysUntilExpiry < 7) expiryTone = "text-destructive";
    else if (daysUntilExpiry <= 15) expiryTone = "text-accent";
  }

  let elapsedPct = 0;
  if (subscriptionStart && subscriptionEnd) {
    const start = new Date(subscriptionStart).getTime();
    const end = new Date(subscriptionEnd).getTime();
    elapsedPct = Math.max(0, Math.min(100, ((Date.now() - start) / (end - start)) * 100));
  }

  const total = plan.priceFcfa + (hasTransport ? TRANSPORT_ADDON.priceFcfa : 0);

  return (
    <AppLayout title="Mon abonnement">
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-accent" />
                  {t("pricing.currentTier")} : {planLabel}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {fcfa(total)} {t("pricing.perYear")}
                  {hasTransport && ` (${fcfa(plan.priceFcfa)} + ${fcfa(TRANSPORT_ADDON.priceFcfa)} Transport)`}
                </p>
              </div>
              <Badge variant={effectiveStatus === "active" ? "default" : "secondary"}>
                <span className={cn(
                  "mr-1.5 inline-block h-2 w-2 rounded-full",
                  effectiveStatus === "active" ? "bg-success" :
                  effectiveStatus === "trial" ? "bg-accent" : "bg-destructive",
                )} />
                {effectiveStatus === "trial" ? "Essai" : effectiveStatus === "active" ? "Actif" : effectiveStatus === "suspended" ? "Suspendu" : "Expiré"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-5">
              {isTrial && daysLeftInTrial != null && (
                <div className="rounded-md bg-accent/10 px-4 py-3 text-sm text-accent">
                  Période d'essai — {daysLeftInTrial} jour{daysLeftInTrial > 1 ? "s" : ""} restant{daysLeftInTrial > 1 ? "s" : ""}
                </div>
              )}

              {/* Student usage */}
              <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <Users className="h-4 w-4" /> {t("pricing.usage")}
                  </span>
                  <span className="font-semibold">
                    {isUnlimited
                      ? t("pricing.usageUnlimited", { count: studentCount })
                      : t("pricing.usageStudents", { count: studentCount, limit: maxStudents })}
                  </span>
                </div>
                {!isUnlimited && <Progress value={usagePct ?? 0} />}
                {(nearStudentLimit || atStudentLimit) && !isUnlimited && (
                  <div className="flex gap-2 rounded-md bg-accent/10 p-3 text-sm text-accent">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <div className="font-medium">
                        {atStudentLimit ? t("pricing.limitReachedTitle") : t("pricing.nearLimitTitle")}
                      </div>
                      <p className="mt-0.5">
                        {atStudentLimit
                          ? t("pricing.limitReachedBody", { limit: maxStudents })
                          : t("pricing.nearLimitBody", { count: studentCount, limit: maxStudents })}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {(subscriptionStart || subscriptionEnd) && (
                <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Début</div>
                      <div className="font-medium">{fmt(subscriptionStart)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Fin</div>
                      <div className="font-medium">{fmt(subscriptionEnd)}</div>
                    </div>
                  </div>
                  {daysUntilExpiry != null && (
                    <div className={cn("text-sm font-semibold", expiryTone)}>
                      {daysUntilExpiry < 0
                        ? `Expiré depuis ${Math.abs(daysUntilExpiry)} jour${Math.abs(daysUntilExpiry) > 1 ? "s" : ""}`
                        : daysUntilExpiry === 0
                        ? "Expire aujourd'hui"
                        : `${daysUntilExpiry} jour${daysUntilExpiry > 1 ? "s" : ""} restant${daysUntilExpiry > 1 ? "s" : ""}`}
                    </div>
                  )}
                  {subscriptionStart && subscriptionEnd && <Progress value={elapsedPct} />}
                  <p className="text-xs text-muted-foreground">
                    Renouvellement : Contactez Wintek — {WINTEK_CONTACT.phones} · {WINTEK_CONTACT.email}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transport add-on */}
          <Card className={cn(hasTransport && "border-primary/40")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bus className="h-5 w-5 text-primary" /> {t("pricing.transportAddon")}
              </CardTitle>
              <Badge variant={hasTransport ? "default" : "secondary"}>
                {hasTransport ? t("pricing.transportActive") : t("pricing.transportInactive")}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>{t("pricing.transportDesc")}</p>
              <p className="font-semibold text-foreground">
                {fcfa(TRANSPORT_ADDON.priceFcfa)} {t("pricing.perYear")}
              </p>
            </CardContent>
          </Card>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Paliers tarifaires</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {PLAN_LIST.map((p) => {
                const current = p.id === planId;
                return (
                  <Card key={p.id} className={cn(current && "border-primary ring-1 ring-primary")}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{t(`pricing.tiers.${p.id}`)}</CardTitle>
                        {current && <Badge>Actuel</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{t(`pricing.ranges.${p.id}`)}</p>
                      <p className="text-2xl font-bold">
                        {fcfa(p.priceFcfa)}
                        <span className="text-sm font-normal text-muted-foreground"> {t("pricing.perYear")}</span>
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm font-medium">
                        {Number.isFinite(p.maxStudents)
                          ? `Jusqu'à ${p.maxStudents} élèves`
                          : t("pricing.unlimitedStudents")}
                      </p>
                      <p className="text-xs text-muted-foreground">{t("pricing.allIncluded")}</p>
                      <ul className="mt-2 space-y-1.5">
                        {INCLUDED_FEATURES.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-xs">
                            <Check className="h-3.5 w-3.5 text-success" />
                            {FEATURE_LABELS[f]}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <Card className="border-accent/40 bg-accent/5">
            <CardContent className="flex flex-col items-start gap-3 py-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-semibold">Changer de palier ou activer le Transport</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Contactez Wintek (paiement par Mobile Money).
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> {WINTEK_CONTACT.phones}</span>
                  <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> {WINTEK_CONTACT.email}</span>
                </div>
              </div>
              <Button onClick={() => navigate({ to: "/dashboard" })}>Retour au tableau de bord</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
