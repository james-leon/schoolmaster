import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useLoaded, TableSkeleton } from "@/components/shared";
import { useDB } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone } from "lucide-react";

export const Route = createFileRoute("/enseignants")({
  component: EnseignantsPage,
});

function EnseignantsPage() {
  const db = useDB();
  const loaded = useLoaded();

  if (!loaded)
    return (
      <AppLayout title="Enseignants">
        <TableSkeleton rows={3} cols={3} />
      </AppLayout>
    );

  return (
    <AppLayout title="Enseignants">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {db.teachers.map((t) => {
          const classes = db.classes.filter((c) => c.teacherId === t.id);
          return (
            <Card key={t.id} className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <Avatar className="h-11 w-11">
                  <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
                    {t.firstName[0]}{t.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base">{t.firstName} {t.lastName}</CardTitle>
                  <p className="text-xs text-muted-foreground">{t.subject}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" /> <span className="truncate">{t.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" /> {t.phone}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {classes.length ? classes.map((c) => <Badge key={c.id} variant="secondary">{c.name}</Badge>) : <span className="text-xs text-muted-foreground">Aucune classe</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppLayout>
  );
}
