import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

/**
 * One-time data protection acknowledgment for school admins.
 * Reads schools.privacy_accepted_at; if null, shows a blocking modal.
 */
export function PrivacyConsentGate() {
  const { t } = useTranslation();
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
      toast.success(t("parentPortal.privacyConsent.saveSuccess"));
      setOpen(false);
    } catch (e) {
      toast.error(t("parentPortal.privacyConsent.saveError", { message: (e as Error).message }));
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
          <DialogTitle>{t("parentPortal.privacyConsent.title")}</DialogTitle>
          <DialogDescription className="text-foreground">
            {t("parentPortal.privacyConsent.description").replace(/<\/?strong>/g, "")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {t("parentPortal.privacyConsent.readPolicyPrefix")}{" "}
            <Link to="/confidentialite" target="_blank" className="font-medium text-primary hover:underline">
              {t("parentPortal.privacyConsent.readPolicyLink")}
            </Link>{" "}
            {t("parentPortal.privacyConsent.readPolicySuffix")}
          </p>

          <label className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
            <Checkbox checked={checked} onCheckedChange={(v) => setChecked(!!v)} className="mt-0.5" />
            <span>{t("parentPortal.privacyConsent.checkboxLabel")}</span>
          </label>
        </div>

        <DialogFooter>
          <Button onClick={accept} disabled={!checked || saving}>
            {saving ? t("parentPortal.privacyConsent.saving") : t("parentPortal.privacyConsent.accept")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
