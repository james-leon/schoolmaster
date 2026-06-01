import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export interface CredentialsInfo {
  name: string;
  email: string;
  tempPassword: string;
  role: "teacher" | "parent";
  schoolName?: string;
}

export function CredentialsModal({ info, onClose }: { info: CredentialsInfo | null; onClose: () => void }) {
  if (!info) return null;
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const roleLabel = info.role === "teacher" ? "enseignant" : "parent";
  const scopeLabel = info.role === "teacher" ? "vos classes" : "la scolarité";
  const subject = `Vos accès SchoolMaster — ${info.schoolName ?? ""}`.trim();
  const body =
`Bonjour ${info.name},

${info.schoolName ?? "Votre école"} vous a créé un compte sur SchoolMaster pour suivre ${scopeLabel}.

Vos identifiants de connexion :
Email : ${info.email}
Mot de passe temporaire : ${info.tempPassword}

Connectez-vous sur : ${appUrl}

Pour votre sécurité, changez votre mot de passe dès votre première connexion.

Cordialement,
L'équipe ${info.schoolName ?? "SchoolMaster"}`;

  const copyText = `Email: ${info.email}\nMot de passe: ${info.tempPassword}\nLien: ${appUrl}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      toast.success("Identifiants copiés");
    } catch {
      toast.error("Impossible de copier");
    }
  };

  const sendEmail = () => {
    const href = `mailto:${encodeURIComponent(info.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-[480px] max-h-[90vh] overflow-y-auto p-6 box-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            <span className="break-words">Compte {roleLabel} créé !</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm min-w-0">
          <div className="rounded-md border border-border bg-muted/40 p-4 space-y-2 w-full min-w-0">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Email</div>
              <div className="font-mono font-medium break-all">{info.email}</div>
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Mot de passe temporaire</div>
              <div className="font-mono font-semibold tracking-wider break-all">{info.tempPassword}</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground break-words">
            Transmettez ces identifiants à l'{roleLabel}. Il devra changer son mot de passe à la première connexion.
          </p>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2 flex-wrap">
          <Button variant="outline" onClick={copy} className="w-full sm:w-auto">
            <Copy className="mr-1.5 h-4 w-4" /> Copier
          </Button>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={sendEmail} className="w-full sm:w-auto">
              <Mail className="mr-1.5 h-4 w-4" /> Envoyer par email
            </Button>
            <Button onClick={onClose} className="w-full sm:w-auto">Fermer</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
