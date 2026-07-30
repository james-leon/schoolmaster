import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, Crown } from "lucide-react";
import type { PlanConfig } from "@/lib/plans";
import { WINTEK_CONTACT } from "@/lib/plans";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  requiredPlan?: PlanConfig;
}

export function UpgradeModal({ open, onClose, title, message, requiredPlan }: UpgradeModalProps) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Crown className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">{title ?? "Limite de votre plan atteinte"}</DialogTitle>
          <DialogDescription className="text-center">
            {message}
            {requiredPlan && (
              <div className="mt-3 rounded-md bg-muted p-3 text-sm">
                Passez au plan <strong>{requiredPlan.label}</strong> pour débloquer cette fonctionnalité.
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button variant="outline" onClick={onClose}>Plus tard</Button>
          <Button
            onClick={() => { onClose(); navigate({ to: "/mon-abonnement" }); }}
          >
            Voir les plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Inline overlay shown over a locked section. */
export function LockedFeatureOverlay({
  requiredPlan,
  featureLabel,
}: {
  requiredPlan?: PlanConfig;
  featureLabel?: string;
}) {
  const navigate = useNavigate();
  const heading = `${featureLabel ?? "Cette fonctionnalité"} nécessite le plan ${requiredPlan?.label ?? "Complet"}`;
  return (
    <div className="relative">
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-background shadow">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold">{heading}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Contactez Wintek pour mettre à niveau votre abonnement
          {" "}— {WINTEK_CONTACT.phone} · {WINTEK_CONTACT.email}
        </p>
        <Button className="mt-4" onClick={() => navigate({ to: "/mon-abonnement" })}>
          Voir les plans
        </Button>
      </div>
    </div>
  );
}
