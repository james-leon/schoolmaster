import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS } from "@/lib/format";
import { toast } from "sonner";
import { KeyRound, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/mon-profil")({ component: MonProfilPage });

function MonProfilPage() {
  const { user, loading, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => { if (user) setFullName(user.name); }, [user]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  if (!user) return null;

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user.id);
      if (error) throw error;
      await refreshUser();
      toast.success("Profil mis à jour");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (pwd.length < 6) return toast.error("6 caractères minimum");
    if (pwd !== confirm) return toast.error("Les mots de passe ne correspondent pas");
    setSavingPwd(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expirée. Veuillez vous reconnecter.");
        navigate({ to: "/login", replace: true });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      setPwd(""); setConfirm("");
      toast.success("Mot de passe mis à jour");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <AppLayout title="Mon profil">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" /> Informations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nom complet</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user.email} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Rôle</Label>
              <Input value={ROLE_LABELS[user.role]} disabled />
            </div>
            <Button onClick={saveProfile} disabled={savingProfile || !fullName.trim()}>
              {savingProfile ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Changer mon mot de passe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Optionnel — laissez vide si vous ne souhaitez pas modifier votre mot de passe.
            </p>
            <div className="space-y-1.5">
              <Label>Nouveau mot de passe</Label>
              <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Confirmer le mot de passe</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button onClick={changePassword} disabled={savingPwd || !pwd}>
              {savingPwd ? "Enregistrement..." : "Enregistrer le nouveau mot de passe"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
