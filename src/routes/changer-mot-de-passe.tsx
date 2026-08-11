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
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/changer-mot-de-passe")({ component: ChangePasswordPage });

function ChangePasswordPage() {
  const { t } = useTranslation();
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
    if (pwd.length < 6) return toast.error(t("profile.minChars"));
    if (pwd !== confirm) return toast.error(t("profile.mismatch"));
    setSubmitting(true);
    try {
      // Make sure we have an active session before calling updateUser —
      // otherwise Supabase throws "Auth session missing".
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const refreshed = await supabase.auth.refreshSession();
        session = refreshed.data.session;
      }
      if (!session) {
        toast.error(t("profile.sessionExpired"));
        await logout();
        navigate({ to: "/login", replace: true });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      // must_change_password is a protected column at the RLS level — clear it
      // via the SECURITY DEFINER RPC, which only succeeds when the auth
      // password was actually changed recently.
      const { error: pErr } = await supabase.rpc("clear_must_change_password");
      if (pErr) throw pErr;
      await refreshUser();
      toast.success(t("profile.passwordUpdated"));
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
          <CardTitle>{t("profile.changePasswordPageTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("profile.changePasswordPageDesc")}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("profile.newPassword")}</Label>
            <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>{t("profile.confirmPassword")}</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button className="w-full" onClick={submit} disabled={submitting}>
            {submitting ? t("profile.saving") : t("profile.savePassword")}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => logout().then(() => navigate({ to: "/login" }))}>
            {t("profile.logout")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
