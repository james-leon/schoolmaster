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

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const schema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@queenmary.cm");
  const [password, setPassword] = useState("password");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const u = await login(email, password);
      toast.success(`Bienvenue, ${u.name} !`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4">
      <Card className="w-full max-w-md p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Logo compact />
          </div>
          <div>
            <h1 className="text-xl font-bold">SchoolMaster</h1>
            <p className="text-sm text-muted-foreground">Connectez-vous à votre espace</p>
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
          <Button type="submit" className="w-full bg-primary" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
        <div className="mt-4 flex flex-col items-center gap-2 text-sm">
          <Link to="/forgot-password" className="text-secondary hover:underline">
            Mot de passe oublié ?
          </Link>
          <span className="text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link to="/register" className="font-medium text-secondary hover:underline">
              Inscrire une école
            </Link>
          </span>
        </div>
        <p className="mt-6 rounded-md bg-muted p-3 text-center text-xs text-muted-foreground">
          Démo : admin@queenmary.cm · prof@queenmary.cm · parent@queenmary.cm — mot de passe : <b>password</b>
        </p>
      </Card>
    </div>
  );
}
