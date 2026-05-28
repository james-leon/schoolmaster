import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useLoaded, TableSkeleton } from "@/components/shared";
import { useDB } from "@/lib/store";
import { fcfa } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Users } from "lucide-react";

export const Route = createFileRoute("/classes")({
  component: ClassesPage,
});

function ClassesPage() {
  const db = useDB();
  const loaded = useLoaded();

  if (!loaded)
    return (
      <AppLayout title="Classes">
        <TableSkeleton rows={4} cols={3} />
      </AppLayout>
    );

  return (
    <AppLayout title="Classes">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {db.classes.map((c) => {
          const count = db.students.filter((s) => s.classId === c.id).length;
          const teacher = db.teachers.find((t) => t.id === c.teacherId);
          return (
            <Card key={c.id} className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  {c.name}
                </CardTitle>
                <Badge variant="outline">{c.level}</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" /> {count} élève{count > 1 ? "s" : ""}
                </div>
                <div className="text-muted-foreground">
                  Enseignant : <span className="font-medium text-foreground">{teacher ? `${teacher.firstName} ${teacher.lastName}` : "—"}</span>
                </div>
                <div className="text-muted-foreground">
                  Frais : <span className="font-semibold text-foreground">{fcfa(c.fees)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppLayout>
  );
}
