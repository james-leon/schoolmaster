import { Badge } from "@/components/ui/badge";
import { usePlan } from "@/lib/usePlan";
import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  teal: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  blue: "bg-primary/15 text-primary border-primary/30",
  orange: "bg-accent/15 text-accent border-accent/30",
};

export function PlanBadge({ className }: { className?: string }) {
  const { plan, planLabel, loading } = usePlan();
  if (loading) return null;
  return (
    <Badge variant="outline" className={cn("border", TONES[plan.tone], className)}>
      Plan {planLabel}
    </Badge>
  );
}
