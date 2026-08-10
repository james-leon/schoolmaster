import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Rocket, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSetupChecklist, isSetupDismissed, setSetupDismissed } from "@/lib/setup-checklist";

interface Props {
  /** "dashboard" hides itself once complete+dismissed; "help" always shows. */
  variant?: "dashboard" | "help";
}

export function SetupChecklist({ variant = "dashboard" }: Props) {
  const { t } = useTranslation();
  const { steps, doneCount, total, complete, schoolId } = useSetupChecklist();
  const [dismissed, setDismissed] = useState(() => isSetupDismissed(schoolId));

  if (total === 0) return null;
  if (variant === "dashboard" && complete && dismissed) return null;

  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  if (variant === "dashboard" && complete) {
    return (
      <Card className="mt-6 border-success/30 bg-success/5">
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            <div>
              <p className="font-['Sora'] text-sm font-semibold text-foreground">
                {t("setup.completeTitle")}
              </p>
              <p className="text-xs text-muted-foreground">{t("setup.completeText")}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("common.close")}
            onClick={() => {
              setSetupDismissed(schoolId, true);
              setDismissed(true);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(variant === "dashboard" && "mt-6", "border-primary/25")}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Rocket className="h-4 w-4" />
            </span>
            <div>
              <CardTitle className="font-['Sora'] text-base font-semibold text-foreground">
                {t("setup.title")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t("setup.subtitle")}</p>
            </div>
          </div>
          <span className="text-sm font-semibold text-primary">
            {t("setup.progress", { done: doneCount, total })}
          </span>
        </div>
        <Progress value={pct} className="mt-3 h-2" />
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {steps.map((step, i) => (
          <div
            key={step.id}
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-lg border p-3",
              step.done ? "border-success/30 bg-success/5" : "border-border bg-card",
            )}
          >
            {step.done ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  step.done ? "text-muted-foreground line-through" : "text-foreground",
                )}
              >
                {i + 1}. {t(`setup.steps.${step.id}.title`)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(`setup.steps.${step.id}.why`)}
              </p>
            </div>
            <Button asChild size="sm" variant={step.done ? "ghost" : "default"}>
              <Link to={step.to}>
                {step.done ? t("setup.review") : t("setup.go")}
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
