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

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

const schema = z.object({
  schoolName: z.string().min(2, "Le nom de l'école est requis"),
  director: z.string().min(2, "Le nom du directeur est requis"),
  email: z.string().email("Adresse email invalide"),
  phone: z.string().min(6, "Numéro de téléphone invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  city: z.string().min(2, "La ville est requise"),
  country: z.string().min(2, "Le pays est requis"),
});

function RegisterPage() {
  const { registerSchool } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ schoolName: "", director: "", email: "", phone: "", password: "", city: "", country: "Cameroun" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await registerSchool(form);
      toast.success("École inscrite avec succès !");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fields: { k: keyof typeof form; label: string; type?: string }[] = [
    { k: "schoolName", label: "Nom de l'école" },
    { k: "director", label: "Nom du directeur" },
    { k: "email", label: "Adresse email", type: "email" },
    { k: "phone", label: "Téléphone" },
    { k: "city", label: "Ville" },
    { k: "country", label: "Pays" },
    { k: "password", label: "Mot de passe", type: "password" },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4 py-10">
      <Card className="w-full max-w-lg p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Logo compact />
          </div>
          <div>
            <h1 className="text-xl font-bold">Inscrire votre école</h1>
            <p className="text-sm text-muted-foreground">Créez votre espace de gestion scolaire</p>
          </div>
        </div>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.k} className={f.k === "schoolName" || f.k === "password" ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
              <Label htmlFor={f.k}>{f.label}</Label>
              <Input id={f.k} type={f.type ?? "text"} value={form[f.k]} onChange={(e) => set(f.k, e.target.value)} />
              {errors[f.k] && <p className="text-xs text-destructive">{errors[f.k]}</p>}
            </div>
          ))}
          <Button type="submit" className="w-full bg-primary sm:col-span-2" disabled={loading}>
            {loading ? "Création..." : "Créer mon école"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Déjà inscrit ?{" "}
          <Link to="/login" className="font-medium text-secondary hover:underline">
            Se connecter
          </Link>
        </p>
      </Card>
    </div>
  );
}
