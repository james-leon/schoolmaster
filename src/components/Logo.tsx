import { GraduationCap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useDB } from "@/lib/store";

export function Logo({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const db = useDB();
  const school = db.schools.find((s) => s.id === user?.schoolId);
  const logoUrl = school?.logo;
  const schoolName = school?.name ?? "SchoolMaster";

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-accent text-accent-foreground">
        {logoUrl ? (
          <img src={logoUrl} alt={`Logo ${schoolName}`} className="h-full w-full object-cover" />
        ) : (
          <GraduationCap className="h-5 w-5" />
        )}
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="max-w-[160px] truncate text-sm font-bold tracking-tight">{schoolName}</div>
          <div className="text-[10px] text-sidebar-foreground/60">Gestion scolaire</div>
        </div>
      )}
    </div>
  );
}
