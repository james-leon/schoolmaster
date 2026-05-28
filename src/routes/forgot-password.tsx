import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = z.string().email("Adresse email invalide").safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError("");
    setSent(true);
    toast.success("Un lien de réinitialisation a été envoyé.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4">
      <Card className="w-full max-w-md p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Logo compact />
          </div>
          <div>
            <h1 className="text-xl font-bold">Mot de passe oublié</h1>
            <p className="text-sm text-muted-foreground">Recevez un lien de réinitialisation</p>
          </div>
        </div>
        {sent ? (
          <div className="space-y-4 text-center">
            <p className="rounded-md bg-success/10 p-4 text-sm text-success">
              Si un compte existe pour <b>{email}</b>, vous recevrez un email avec les instructions.
            </p>
            <Button asChild className="w-full bg-primary">
              <Link to="/login">Retour à la connexion</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Adresse email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@ecole.cm" />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <Button type="submit" className="w-full bg-primary">
              Envoyer le lien
            </Button>
            <p className="text-center text-sm">
              <Link to="/login" className="text-secondary hover:underline">
                Retour à la connexion
              </Link>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
