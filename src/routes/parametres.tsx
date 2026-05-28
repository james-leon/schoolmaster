import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useDB, resetDB } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { ROLE_LABELS } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/parametres")({
  component: ParametresPage,
});

function ParametresPage() {
  const db = useDB();
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const school = db.schools.find((s) => s.id === user?.schoolId) ?? db.schools[0];

  return (
    <AppLayout title="Paramètres">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations de l'école</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Nom de l'école", value: school?.name },
              { label: "Directeur", value: school?.director },
              { label: "Email", value: school?.email },
              { label: "Téléphone", value: school?.phone },
              { label: "Ville", value: school?.city },
              { label: "Pays", value: school?.country },
            ].map((f) => (
              <div key={f.label} className="space-y-1.5">
                <Label>{f.label}</Label>
                <Input defaultValue={f.value} />
              </div>
            ))}
            <Button onClick={() => toast.success("Informations enregistrées")}>Enregistrer</Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Nom</span><span className="font-medium">{user?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{user?.email}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Rôle</span><span className="font-medium">{user ? ROLE_LABELS[user.role] : ""}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Apparence</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Mode sombre</p>
                <p className="text-xs text-muted-foreground">Basculer entre clair et sombre</p>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={toggle} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Données de démonstration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">Réinitialiser toutes les données vers l'échantillon initial.</p>
              <Button
                variant="destructive"
                onClick={() => {
                  resetDB();
                  toast.success("Données réinitialisées");
                }}
              >
                Réinitialiser les données
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
