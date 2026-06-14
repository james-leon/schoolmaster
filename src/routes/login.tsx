import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { friendlyConnectionMessage } from "@/lib/connection-friendly";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const schema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

function redirectFor(role: string) {
  if (role === "super_admin") return "/super-admin";
  if (role === "parent") return "/parent";
  return "/dashboard";
}

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const doLogin = async (em: string, pw: string) => {
    setErrors({});
    setLoading(true);
    try {
      const u = await login(em, pw);
      toast.success(`Bienvenue, ${u.name} !`);
      // First-login password change must take absolute priority over role routing.
      if (u.mustChangePassword) {
        navigate({ to: "/changer-mot-de-passe", replace: true });
      } else {
        navigate({ to: redirectFor(u.role), replace: true });
      }
    } catch (err) {
      const raw = (err as Error).message ?? "";
      const friendly = friendlyConnectionMessage(raw);
      if (friendly) {
        toast.warning(friendly, { duration: 6000 });
      } else {
        toast.error(raw);
      }
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    await doLogin(email, password);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4 py-8">
      <Card className="w-full max-w-md p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Logo compact />
          </div>
          <div>
            <h1 className="text-2xl font-bold">SchoolMaster</h1>
            <p className="text-sm text-muted-foreground">Gestion scolaire intelligente</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Adresse email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@ecole.cm" />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </Button>
        </form>

        <div className="mt-4 flex flex-col items-center gap-2 text-sm">
          <Link to="/forgot-password" className="text-secondary hover:underline">
            Mot de passe oublié ?
          </Link>
          <Link to="/confidentialite" className="mt-2 text-xs text-muted-foreground hover:text-foreground">
            Politique de confidentialité
          </Link>
        </div>
      </Card>
    </div>
  );
}
