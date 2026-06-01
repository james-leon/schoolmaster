import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, X, Phone, Mail, Crown } from "lucide-react";
import { usePlan } from "@/lib/usePlan";
import { PLAN_LIST, FEATURE_LABELS, WINTEK_CONTACT, type FeatureId } from "@/lib/plans";
import { fcfa } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/mon-abonnement")({ component: MonAbonnementPage });

const ALL_FEATURES: FeatureId[] = [
  "students", "classes", "grades", "bulletins", "fees", "payments", "attendance",
  "sms", "parent_portal", "announcements",
  "multi_campus", "advanced_reports", "priority_support",
];

function MonAbonnementPage() {
  const {
    plan, planId, effectiveStatus,
    studentCount, teacherCount, limits,
    isTrial, daysLeftInTrial,
    subscriptionStart, subscriptionEnd, daysUntilExpiry,
    loading,
  } = usePlan();
  const navigate = useNavigate();

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";

  let expiryTone = "text-success";
  if (daysUntilExpiry != null) {
    if (daysUntilExpiry < 7) expiryTone = "text-destructive";
    else if (daysUntilExpiry <= 15) expiryTone = "text-accent";
  }

  // Progress through subscription period
  let elapsedPct = 0;
  if (subscriptionStart && subscriptionEnd) {
    const start = new Date(subscriptionStart).getTime();
    const end = new Date(subscriptionEnd).getTime();
    const now = Date.now();
    elapsedPct = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
  }


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
                  Plan actuel : {plan.label.toUpperCase()}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{fcfa(plan.priceFcfa)} / mois</p>
              </div>
              <Badge variant={effectiveStatus === "active" ? "default" : "secondary"} className="capitalize">
                <span className={cn(
                  "mr-1.5 inline-block h-2 w-2 rounded-full",
                  effectiveStatus === "active" ? "bg-success" :
                  effectiveStatus === "trial" ? "bg-accent" :
                  "bg-destructive"
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
                  {subscriptionStart && subscriptionEnd && (
                    <Progress value={elapsedPct} />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Renouvellement : Contactez Wintek — {WINTEK_CONTACT.phone}
                  </p>
                </div>
              )}

              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>Élèves utilisés</span>
                  <span className="font-medium">{studentCount} / {limits.maxStudents >= 999_999 ? "∞" : limits.maxStudents}</span>
                </div>
                <Progress value={limits.maxStudents >= 999_999 ? 5 : Math.min(100, (studentCount / limits.maxStudents) * 100)} />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>Enseignants utilisés</span>
                  <span className="font-medium">{teacherCount} / {limits.maxTeachers >= 999_999 ? "∞" : limits.maxTeachers}</span>
                </div>
                <Progress value={limits.maxTeachers >= 999_999 ? 5 : Math.min(100, (teacherCount / limits.maxTeachers) * 100)} />
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Comparer les plans</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {PLAN_LIST.map((p) => {
                const current = p.id === planId;
                return (
                  <Card key={p.id} className={cn(current && "border-primary ring-1 ring-primary")}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{p.label}</CardTitle>
                        {current && <Badge>Actuel</Badge>}
                      </div>
                      <p className="text-2xl font-bold">{fcfa(p.priceFcfa)}<span className="text-sm font-normal text-muted-foreground"> /mois</span></p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Jusqu'à <strong>{p.maxStudents >= 999_999 ? "illimité" : p.maxStudents}</strong> élèves
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Jusqu'à <strong>{p.maxTeachers >= 999_999 ? "illimité" : p.maxTeachers}</strong> enseignants
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {ALL_FEATURES.map((f) => {
                          const has = p.features.includes(f);
                          return (
                            <li key={f} className={cn("flex items-center gap-2 text-xs", !has && "text-muted-foreground/60")}>
                              {has ? <Check className="h-3.5 w-3.5 text-success" /> : <X className="h-3.5 w-3.5" />}
                              {FEATURE_LABELS[f]}
                            </li>
                          );
                        })}
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
                <h3 className="font-semibold">Mettre à niveau votre plan</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Contactez Wintek pour activer un nouveau plan (paiement par Mobile Money).
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> {WINTEK_CONTACT.phone}</span>
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
