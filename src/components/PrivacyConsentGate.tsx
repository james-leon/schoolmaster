import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

/**
 * One-time data protection acknowledgment for school admins.
 * Reads schools.privacy_accepted_at; if null, shows a blocking modal.
 */
export function PrivacyConsentGate() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "school_admin" || !user.schoolId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("schools")
        .select("privacy_accepted_at")
        .eq("id", user.schoolId!)
        .maybeSingle();
      if (!cancelled && data && !(data as any).privacy_accepted_at) {
        setOpen(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.schoolId, user?.role]);

  const accept = async () => {
    if (!user?.schoolId || !checked) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("schools")
        .update({
          privacy_accepted_at: new Date().toISOString(),
          privacy_accepted_by: user.id,
        } as any)
        .eq("id", user.schoolId);
      if (error) throw error;
      toast.success("Merci, votre acceptation a été enregistrée.");
      setOpen(false);
    } catch (e) {
      toast.error("Erreur : " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* blocking */ }}>
      <DialogContent className="max-w-lg" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <DialogTitle>Protection des données — Acceptation requise</DialogTitle>
          <DialogDescription className="text-foreground">
            En utilisant SchoolMaster, vous reconnaissez être <strong>responsable du traitement</strong> des données de votre
            école et vous engagez à obtenir le consentement des parents pour le traitement des données de leurs enfants,
            conformément à la loi camerounaise n°2024/017 sur la protection des données à caractère personnel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Veuillez lire notre{" "}
            <Link to="/confidentialite" target="_blank" className="font-medium text-primary hover:underline">
              politique de confidentialité
            </Link>{" "}
            avant de continuer.
          </p>

          <label className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
            <Checkbox checked={checked} onCheckedChange={(v) => setChecked(!!v)} className="mt-0.5" />
            <span>J'ai lu et j'accepte la politique de confidentialité.</span>
          </label>
        </div>

        <DialogFooter>
          <Button onClick={accept} disabled={!checked || saving}>
            {saving ? "Enregistrement..." : "Accepter et continuer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
