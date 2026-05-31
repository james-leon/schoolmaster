import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export const Route = createFileRoute("/changer-mot-de-passe")({ component: ChangePasswordPage });

function ChangePasswordPage() {
  const { user, loading, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && !user) {
    navigate({ to: "/login", replace: true });
    return null;
  }

  const submit = async () => {
    if (pwd.length < 6) return toast.error("6 caractères minimum");
    if (pwd !== confirm) return toast.error("Les mots de passe ne correspondent pas");
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      const { error: pErr } = await supabase.from("profiles").update({ must_change_password: false }).eq("id", user!.id);
      if (pErr) throw pErr;
      await refreshUser();
      toast.success("Mot de passe mis à jour");
      const dest = user?.role === "parent" ? "/parent" : "/dashboard";
      navigate({ to: dest, replace: true });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Changer votre mot de passe</CardTitle>
          <p className="text-sm text-muted-foreground">
            Pour votre sécurité, choisissez un nouveau mot de passe avant de continuer.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nouveau mot de passe</Label>
            <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Confirmer le mot de passe</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button className="w-full" onClick={submit} disabled={submitting}>
            {submitting ? "Enregistrement..." : "Enregistrer le nouveau mot de passe"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => logout().then(() => navigate({ to: "/login" }))}>
            Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
