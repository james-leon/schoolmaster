import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, Crown } from "lucide-react";
import { WINTEK_CONTACT } from "@/lib/plans";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
}

export function UpgradeModal({ open, onClose, title, message }: UpgradeModalProps) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Crown className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">{title ?? "Limite de votre palier atteinte"}</DialogTitle>
          <DialogDescription className="text-center">
            {message}
            <span className="mt-3 block rounded-md bg-muted p-3 text-sm">
              {WINTEK_CONTACT.phones} · {WINTEK_CONTACT.email}
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button variant="outline" onClick={onClose}>Plus tard</Button>
          <Button onClick={() => { onClose(); navigate({ to: "/mon-abonnement" }); }}>
            Voir mon abonnement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Inline overlay shown over the Transport module when the add-on is not
 * active. Transport is the ONLY paid add-on — nothing else is ever locked.
 */
export function LockedFeatureOverlay({ featureLabel }: { featureLabel?: string }) {
  const navigate = useNavigate();
  return (
    <div className="relative">
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-background shadow">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold">
          {featureLabel ?? "Le module Transport"} nécessite l'option Transport
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          L'option Transport coûte 60 000 FCFA / an. Contactez Wintek pour l'activer
          {" "}— {WINTEK_CONTACT.phones} · {WINTEK_CONTACT.email}
        </p>
        <Button className="mt-4" onClick={() => navigate({ to: "/mon-abonnement" })}>
          Voir mon abonnement
        </Button>
      </div>
    </div>
  );
}
