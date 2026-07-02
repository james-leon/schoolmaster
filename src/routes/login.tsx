import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { friendlyConnectionMessage } from "@/lib/connection-friendly";
import {
  GraduationCap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  FileText,
  Wallet,
  Bell,
} from "lucide-react";

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

const NAVY = "#0D2C54";
const ORANGE = "#F58B1F";

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [lockoutMessage, setLockoutMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("inactivity_logout_flag") === "1") {
        sessionStorage.removeItem("inactivity_logout_flag");
        toast.info("Vous avez été déconnecté après une période d'inactivité, pour protéger vos données.", { duration: 8000 });
      }
    } catch {}
  }, []);

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
    setLockoutMessage(null);
    setLoading(true);
    try {
      const u = await login(email, password);
      toast.success(`Bienvenue, ${u.name} !`);
      if (u.mustChangePassword) {
        navigate({ to: "/changer-mot-de-passe", replace: true });
      } else {
        navigate({ to: redirectFor(u.role), replace: true });
      }
    } catch (err) {
      const raw = (err as Error).message ?? "";
      if (raw.startsWith("Trop de tentatives")) {
        setLockoutMessage(raw);
      } else {
        const friendly = friendlyConnectionMessage(raw);
        if (friendly) toast.warning(friendly, { duration: 6000 });
        else toast.error(raw);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[#F7F9FC] text-[#0F172A] lg:grid lg:grid-cols-[52fr_48fr]"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* LEFT — brand panel */}
      <aside
        className="relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col xl:p-14"
        style={{
          background:
            "linear-gradient(160deg, #11315c 0%, #0D2C54 55%, #081c38 100%)",
        }}
      >
        {/* decorative blobs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-1/3 h-[420px] w-[420px] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-[360px] w-[360px] rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, #F58B1F 0%, transparent 70%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 right-10 h-[300px] w-[300px] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #2563EB 0%, transparent 70%)" }}
        />

        {/* logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl shadow-lg"
            style={{ background: ORANGE }}
          >
            <GraduationCap className="h-6 w-6 text-white" strokeWidth={2.4} />
          </div>
          <div className="leading-tight">
            <div
              className="text-xl font-bold tracking-tight"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              SchoolMaster
            </div>
            <div className="text-xs text-white/60">par Wintek — Winner Technology</div>
          </div>
        </div>

        {/* middle copy */}
        <div className="relative z-10 mt-16 max-w-xl">
          <div
            className="mb-5 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: ORANGE }}
          >
            Gestion scolaire intelligente
          </div>
          <h1
            className="text-[44px] font-bold leading-[1.05] tracking-tight xl:text-[52px]"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            Toute votre école,
            <br />
            dans une seule
            <br />
            application.
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-white/70">
            Élèves, bulletins, paiements, communication avec les parents. Conçu pour les
            écoles du Cameroun, propulsé par l'intelligence artificielle.
          </p>

          <ul className="mt-10 space-y-5">
            <Feature
              icon={<FileText className="h-4 w-4" />}
              title="Bulletins en un clic"
              text="Moyennes calculées et appréciations rédigées par l'IA."
            />
            <Feature
              icon={<Wallet className="h-4 w-4" />}
              title="Suivi des paiements"
              text="Mobile Money, reçus automatiques, taux de recouvrement en temps réel."
            />
            <Feature
              icon={<Bell className="h-4 w-4" />}
              title="Parents toujours informés"
              text="Notes, absences et annonces directement sur leur téléphone."
            />
          </ul>
        </div>

        <div className="relative z-10 mt-auto pt-10 text-xs text-white/50">
          © 2026 Wintek — Winner Technology · Douala, Cameroun
        </div>
      </aside>

      {/* RIGHT — form */}
      <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:min-h-0">
        <div className="w-full max-w-[400px]">
          {/* logo block */}
          <div className="mb-7 flex flex-col items-center text-center">
            <div
              className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl shadow-md"
              style={{ background: NAVY }}
            >
              <GraduationCap className="h-7 w-7" style={{ color: ORANGE }} strokeWidth={2.4} />
            </div>
            <h2
              className="text-[26px] font-bold tracking-tight"
              style={{ fontFamily: "'Sora', sans-serif", color: NAVY }}
            >
              Bon retour <span className="inline-block">👋</span>
            </h2>
            <p className="mt-1.5 text-sm text-[#64748B]">
              Connectez-vous à votre espace SchoolMaster
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-[#0F172A]">
                Adresse email
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@ecole.cm"
                  className="login-input h-12 rounded-xl border-[1.5px] border-[#E8EDF4] bg-white pl-10 pr-3 text-[15px] placeholder:text-[#94A3B8] focus-visible:border-[#2563EB] focus-visible:ring-0 focus-visible:outline-none"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-[#0F172A]">
                Mot de passe
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="login-input h-12 rounded-xl border-[1.5px] border-[#E8EDF4] bg-white pl-10 pr-11 text-[15px] placeholder:text-[#94A3B8] focus-visible:border-[#2563EB] focus-visible:ring-0 focus-visible:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  aria-label={showPwd ? "Masquer" : "Afficher"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-[#64748B] hover:text-[#0F172A]"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            {lockoutMessage && (
              <div
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
              >
                <div className="font-medium">{lockoutMessage}</div>
                <Link
                  to="/forgot-password"
                  className="mt-1 inline-block text-sm font-semibold text-amber-900 underline"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[#0F172A]">
                <Checkbox
                  checked={remember}
                  onCheckedChange={(v) => setRemember(!!v)}
                  className="h-4 w-4 rounded border-[#CBD5E1] data-[state=checked]:border-[#2563EB] data-[state=checked]:bg-[#2563EB]"
                />
                Se souvenir de moi
              </label>
              <Link
                to="/forgot-password"
                className="text-sm font-medium hover:underline"
                style={{ color: "#2563EB" }}
              >
                Mot de passe oublié ?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="group mt-2 h-12 w-full rounded-xl text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(13,44,84,0.55)] transition-all hover:-translate-y-[1px] hover:shadow-[0_12px_24px_-8px_rgba(13,44,84,0.65)]"
              style={{ background: NAVY }}
            >
              {loading ? (
                "Connexion..."
              ) : (
                <span className="inline-flex items-center justify-center gap-2">
                  Se connecter
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </Button>

            <div className="flex items-center justify-center gap-2 pt-1 text-xs text-[#64748B]">
              <ShieldCheck className="h-3.5 w-3.5" style={{ color: "#15A05A" }} />
              Connexion sécurisée · Données chiffrées
            </div>
          </form>

          <div className="mt-8 border-t border-[#E8EDF4] pt-5 text-center text-[11px] text-[#64748B]">
            En continuant, vous acceptez nos conditions.
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
              <Link to="/cgu" className="font-medium text-[#0F172A] hover:underline">
                CGU
              </Link>
              <span>·</span>
              <Link to="/confidentialite" className="font-medium text-[#0F172A] hover:underline">
                Politique de confidentialité
              </Link>
              <span>·</span>
              <span>Conforme à la loi n°2024/017 (Cameroun)</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className="flex items-start gap-4">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
        style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-white" style={{ fontFamily: "'Sora', sans-serif" }}>
          {title}
        </div>
        <div className="text-[13px] leading-relaxed text-white/65">{text}</div>
      </div>
    </li>
  );
}
