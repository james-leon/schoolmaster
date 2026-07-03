import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Wrench, Loader2 } from "lucide-react";

type Row = {
  maintenance_active: boolean;
  maintenance_message: string | null;
  maintenance_expected_return: string | null;
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DEFAULT_MSG =
  "Nous effectuons une maintenance pour améliorer votre expérience. Merci de votre patience.";

export function MaintenancePanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MSG);
  const [expected, setExpected] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("platform_settings")
      .select("maintenance_active, maintenance_message, maintenance_expected_return")
      .eq("id", true)
      .maybeSingle();
    if (!error && data) {
      const r = data as Row;
      setActive(!!r.maintenance_active);
      setMessage(r.maintenance_message || DEFAULT_MSG);
      setExpected(toLocalInput(r.maintenance_expected_return));
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const save = async (nextActive?: boolean) => {
    setSaving(true);
    try {
      const payload = {
        id: true,
        maintenance_active: nextActive ?? active,
        maintenance_message: message.trim() || null,
        maintenance_expected_return: expected ? new Date(expected).toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("platform_settings").upsert(payload, { onConflict: "id" });
      if (error) throw error;
      if (typeof nextActive === "boolean") setActive(nextActive);
      toast.success(
        (nextActive ?? active) ? "Mode maintenance activé" : "Mode maintenance désactivé",
      );
    } catch (e) {
      toast.error((e as Error).message || "Échec de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-6 border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className="h-4 w-4 text-primary" />
          Mode maintenance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div>
                <div className="text-sm font-medium">
                  {active ? "Maintenance ACTIVE" : "Plateforme opérationnelle"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {active
                    ? "Tous les utilisateurs (sauf super admin) voient l'écran de maintenance."
                    : "Activez pour afficher un écran de maintenance à tous les utilisateurs."}
                </div>
              </div>
              <Switch
                checked={active}
                onCheckedChange={(v) => save(v)}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maint-msg">Message affiché aux utilisateurs</Label>
              <Textarea
                id="maint-msg"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={DEFAULT_MSG}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maint-eta">Retour prévu (optionnel)</Label>
              <Input
                id="maint-eta"
                type="datetime-local"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => save()} disabled={saving} size="sm">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer le message
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
