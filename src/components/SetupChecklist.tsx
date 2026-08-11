import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Rocket, X, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSetupChecklist, useSetupDismissal, type SetupStep } from "@/lib/setup-checklist";

interface Props {
  /** "dashboard" is compact + dismissible; "help" always shows, expanded. */
  variant?: "dashboard" | "help";
}

function StepRow({ step, index, t }: { step: SetupStep; index: number; t: (k: string) => string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2",
        step.done ? "border-success/30 bg-success/5" : "border-border bg-card",
      )}
    >
      {step.done ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium",
            step.done ? "text-muted-foreground line-through" : "text-foreground",
          )}
        >
          {index}. {t(`setup.steps.${step.id}.title`)}
        </p>
        <p className="text-xs text-muted-foreground">{t(`setup.steps.${step.id}.why`)}</p>
      </div>
      <Button asChild size="sm" variant={step.done ? "ghost" : "default"}>
        <Link to={step.to}>
          {step.done ? t("setup.review") : t("setup.go")}
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}

export function SetupChecklist({ variant = "dashboard" }: Props) {
  const { t } = useTranslation();
  const { essentialSteps, optionalSteps, doneCount, total, complete } = useSetupChecklist();
  const { dismissed, setDismissed } = useSetupDismissal();
  const isHelp = variant === "help";
  const [open, setOpen] = useState(isHelp);
  const [celebrated, setCelebrated] = useState(false);

  // Auto-disappear once every essential step is done: show a short
  // confirmation on the dashboard, then hide for good.
  useEffect(() => {
    if (isHelp || !complete || dismissed || celebrated) return;
    const id = window.setTimeout(() => {
      setCelebrated(true);
      setDismissed(true);
    }, 6000);
    return () => window.clearTimeout(id);
  }, [isHelp, complete, dismissed, celebrated, setDismissed]);

  if (total === 0) return null;
  if (!isHelp && dismissed) return null;

  if (!isHelp && complete) {
    return (
      <Card className="mt-6 border-success/30 bg-success/5">
        <CardContent className="flex items-center justify-between gap-3 py-3">
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
            aria-label={t("setup.hide")}
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <Card className={cn(!isHelp && "mt-6", "border-primary/25")}>
      <CardContent className="p-3">
        {/* Compact summary line */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Rocket className="h-3.5 w-3.5" />
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            aria-expanded={open}
          >
            <span className="font-['Sora'] truncate text-sm font-semibold text-foreground">
              {t("setup.title")}
            </span>
            <span className="text-xs font-semibold text-primary">
              {t("setup.progress", { done: doneCount, total })}
            </span>
            <Progress value={pct} className="hidden h-1.5 max-w-[140px] flex-1 sm:block" />
          </button>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? t("setup.collapse") : t("setup.expand")}
              {open ? (
                <ChevronUp className="ml-1 h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              )}
            </Button>
            {!isHelp && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => setDismissed(true)}
              >
                {t("setup.hide")}
              </Button>
            )}
          </div>
        </div>
        <Progress value={pct} className="mt-2 h-1.5 sm:hidden" />

        {open && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">{t("setup.subtitle")}</p>
            {essentialSteps.map((step, i) => (
              <StepRow key={step.id} step={step} index={i + 1} t={t} />
            ))}

            {optionalSteps.length > 0 && (
              <div className="pt-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("setup.optionalTitle")}
                </p>
                <div className="space-y-2">
                  {optionalSteps.map((step, i) => (
                    <StepRow key={step.id} step={step} index={i + 1} t={t} />
                  ))}
                </div>
              </div>
            )}

            {isHelp && dismissed && (
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => setDismissed(false)}
              >
                {t("setup.resume")}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
