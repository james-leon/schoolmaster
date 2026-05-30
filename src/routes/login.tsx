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
import { Shield, GraduationCap, Users as UsersIcon } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const schema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

const DEMOS = [
  { key: "admin", label: "Admin", icon: Shield, email: "admin@queenmary.cm", password: "admin123", tone: "bg-primary text-primary-foreground" },
  { key: "teacher", label: "Prof", icon: GraduationCap, email: "prof.martin@queenmary.cm", password: "prof123", tone: "bg-secondary text-secondary-foreground" },
  { key: "parent", label: "Parent", icon: UsersIcon, email: "parent.ekane@gmail.com", password: "parent123", tone: "bg-success text-success-foreground" },
];

function redirectFor(role: string) {
  if (role === "parent") return "/parent";
  return "/dashboard";
}

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@queenmary.cm");
  const [password, setPassword] = useState("admin123");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const doLogin = async (em: string, pw: string) => {
    setErrors({});
    setLoading(true);
    try {
      const u = await login(em, pw);
      toast.success(`Bienvenue, ${u.name} !`);
      navigate({ to: redirectFor(u.role) });
    } catch (err) {
      toast.error((err as Error).message);
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

        <div className="mt-6">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Connexion rapide (Démo)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DEMOS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.password);
                  toast.info(`Identifiants ${d.label} pré-remplis`);
                }}
                className={`flex flex-col items-center gap-1 rounded-md border border-border p-3 text-xs font-medium transition-colors hover:bg-muted ${''}`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${d.tone}`}>
                  <d.icon className="h-4 w-4" />
                </span>
                {d.label}
              </button>
            ))}
          </div>
        </div>

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
      </Card>
    </div>
  );
}
