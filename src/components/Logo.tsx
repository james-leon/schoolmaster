import { GraduationCap } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <GraduationCap className="h-5 w-5" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight">SchoolMaster</div>
          <div className="text-[10px] text-sidebar-foreground/60">Gestion scolaire</div>
        </div>
      )}
    </div>
  );
}
