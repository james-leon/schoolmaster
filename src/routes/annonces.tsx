import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useDB } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { usePlan } from "@/lib/usePlan";
import { requiredPlanFor } from "@/lib/plans";
import { LockedFeatureOverlay } from "@/components/UpgradePrompt";
import { visibleAnnouncements, formatDateFr, markAllSeen } from "@/lib/announcements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/annonces")({
  component: AnnoncesPage,
});

function AnnoncesPage() {
  const db = useDB();
  const { user } = useAuth();
  const { hasFeature, loading } = usePlan();
  const items = visibleAnnouncements(db.announcements, user?.role);

  useEffect(() => {
    markAllSeen();
  }, [items.length]);

  const locked = !loading && user?.role !== "super_admin" && !hasFeature("announcements");

  return (
    <AppLayout title="Annonces">
      {locked ? (
        <LockedFeatureOverlay
          requiredPlan={requiredPlanFor("announcements")}
          featureLabel="Les annonces"
        />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <Megaphone className="h-10 w-10 opacity-40" />
            <p>Aucune annonce pour le moment</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-base font-bold text-primary">{a.title}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateFr(a.createdAt)}</p>
                </div>
                <Badge variant="secondary">{a.audience}</Badge>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{a.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <div className="mt-6 text-center text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:underline">← Retour au tableau de bord</Link>
      </div>
    </AppLayout>
  );
}
