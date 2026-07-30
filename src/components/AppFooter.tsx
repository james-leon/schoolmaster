import { Link } from "@tanstack/react-router";
import { ShieldCheck, FileText } from "lucide-react";
import { WINTEK_CONTACT } from "@/lib/plans";

export function AppFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={"flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-4 text-xs text-muted-foreground " + className}>
      <Link to="/cgu" className="inline-flex items-center gap-1 hover:text-foreground">
        <FileText className="h-3.5 w-3.5" />
        CGU
      </Link>
      <span className="hidden sm:inline">•</span>
      <Link to="/confidentialite" className="inline-flex items-center gap-1 hover:text-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Politique de confidentialité
      </Link>
      <span className="hidden sm:inline">•</span>
      <span>Conforme à la loi n°2024/017 (Cameroun)</span>
      <span className="hidden sm:inline">•</span>
      <span>Support Wintek : {WINTEK_CONTACT.phones} — {WINTEK_CONTACT.email}</span>
    </footer>
  );
}
