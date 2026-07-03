import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useDB, updateDB } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { ROLE_LABELS } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Upload, Image as ImageIcon, KeyRound, UserX, UserCheck, UserPlus, Lock } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { CredentialsModal, type CredentialsInfo } from "@/components/CredentialsModal";
import { usePlan } from "@/lib/usePlan";
import { WINTEK_CONTACT } from "@/lib/plans";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { SEQUENCES, SEQUENCE_TERM, getSequenceCoefficients, setSequenceCoefficients, type Sequence } from "@/lib/types";
import { getSchoolSubjects } from "@/lib/subjects";

export const Route = createFileRoute("/parametres")({
  component: ParametresPage,
});

function ParametresPage() {
  const db = useDB();
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const school = db.schools.find((s) => s.id === user?.schoolId) ?? db.schools[0];
  const isAdmin = user?.role === "school_admin" || user?.role === "super_admin";


  const [form, setForm] = useState({
    name: "", director: "", email: "", phone: "",
    city: "", country: "", address: "", logo: "",
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (school) {
      setForm({
        name: school.name ?? "",
        director: school.director ?? "",
        email: school.email ?? "",
        phone: school.phone ?? "",
        city: school.city ?? "",
        country: school.country ?? "",
        address: school.address ?? "",
        logo: school.logo ?? "",
      });
    }
  }, [school?.id]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const saveSchool = () => {
    if (!school) return;
    updateDB((d) => {
      const idx = d.schools.findIndex((s) => s.id === school.id);
      if (idx >= 0) {
        d.schools[idx] = { ...d.schools[idx], ...form };
      }
    });
    toast.success("Informations enregistrées");
  };

  const uploadLogo = async (file: File) => {
    const schoolId = user?.schoolId ?? school?.id;
    if (!schoolId) {
      toast.error("École introuvable");
      return;
    }
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Format non supporté (PNG, JPG, SVG, WEBP uniquement)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 2 Mo)");
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
      // Folder = schoolId so the storage RLS policy (folder must equal the
      // signed-in admin's school_id) accepts the upload.
      const path = `${schoolId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("school-logos")
        .upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("school-logos").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      // Persist to schools.logo_url so every device/user sees the new logo.
      const { error: dbErr } = await supabase
        .from("schools")
        .update({ logo_url: publicUrl })
        .eq("id", schoolId);
      if (dbErr) throw dbErr;
      set("logo", publicUrl);
      updateDB((d) => {
        const idx = d.schools.findIndex((s) => s.id === schoolId);
        if (idx >= 0) d.schools[idx] = { ...d.schools[idx], logo: publicUrl };
      });
      toast.success("Logo mis à jour");
    } catch (err) {
      toast.error("Erreur lors du téléchargement: " + (err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppLayout title="Paramètres">
      <Tabs defaultValue="ecole">
        <TabsList>
          <TabsTrigger value="ecole">École</TabsTrigger>
          <TabsTrigger value="objectifs">Objectifs</TabsTrigger>
          <TabsTrigger value="evaluations">Évaluations</TabsTrigger>
          <TabsTrigger value="matieres">Matières</TabsTrigger>
          <TabsTrigger value="utilisateurs">Utilisateurs</TabsTrigger>
          <TabsTrigger value="confidentialite">Confidentialité</TabsTrigger>
          {isAdmin && <TabsTrigger value="journal">Journal d'activité</TabsTrigger>}
          <TabsTrigger value="compte">Compte</TabsTrigger>
        </TabsList>


        <TabsContent value="ecole" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informations de l'école</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Logo</Label>
                  <div className="flex items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                      {form.logo ? (
                        <img src={form.logo} alt="logo" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                      />
                      <Button asChild variant="outline" disabled={uploading}>
                        <span className="cursor-pointer">
                          <Upload className="mr-2 h-4 w-4" />
                          {uploading ? "Téléchargement..." : "Changer le logo"}
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
                {[
                  { k: "name", label: "Nom de l'école" },
                  { k: "director", label: "Directeur" },
                  { k: "email", label: "Email" },
                  { k: "phone", label: "Téléphone" },
                  { k: "address", label: "Adresse" },
                  { k: "city", label: "Ville" },
                  { k: "country", label: "Pays" },
                ].map((f) => (
                  <div key={f.k} className="space-y-1.5">
                    <Label>{f.label}</Label>
                    <Input
                      value={form[f.k as keyof typeof form] as string}
                      onChange={(e) => set(f.k as keyof typeof form, e.target.value)}
                    />
                  </div>
                ))}
                <Button onClick={saveSchool}>Enregistrer</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Apparence</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Mode sombre</p>
                  <p className="text-xs text-muted-foreground">Basculer entre clair et sombre</p>
                </div>
                <Switch checked={theme === "dark"} onCheckedChange={toggle} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="objectifs" className="mt-4">
          <EnrollmentTargetsPanel schoolId={school?.id} />
        </TabsContent>

        <TabsContent value="evaluations" className="mt-4">
          <SequenceCoefficientsPanel />
        </TabsContent>

        <TabsContent value="matieres" className="mt-4">
          <SubjectsPanel />
        </TabsContent>



        <TabsContent value="utilisateurs" className="mt-4">
          <UsersPanel schoolId={school?.id} schoolName={school?.name} currentUserId={user?.id} />
        </TabsContent>

        <TabsContent value="confidentialite" className="mt-4">
          <PrivacyPanel schoolId={school?.id} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="journal" className="mt-4">
            <AuditLogPanel schoolId={school?.id} />
          </TabsContent>
        )}



        <TabsContent value="compte" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Nom</span><span className="font-medium">{user?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{user?.email}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Rôle</span><span className="font-medium">{user ? ROLE_LABELS[user.role] : ""}</span></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function SequenceCoefficientsPanel() {
  const [coefs, setCoefs] = useState<Record<string, number>>(() => getSequenceCoefficients());

  const set = (seq: Sequence, v: string) => {
    const n = Math.max(0, Number(v) || 0);
    setCoefs((p) => ({ ...p, [seq]: n }));
  };
  const save = () => {
    setSequenceCoefficients(coefs as Record<Sequence, number>);
    toast.success("Coefficients enregistrés");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Types d'évaluation — Séquences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Le système camerounais comporte 6 séquences réparties sur 3 trimestres. Les coefficients par défaut sont à 1 mais restent modifiables ci-dessous.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SEQUENCES.map((seq) => (
            <div key={seq} className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">{seq}</p>
                <p className="text-xs text-muted-foreground">{SEQUENCE_TERM[seq]}</p>
              </div>
              <div className="w-24">
                <Label className="text-xs">Coef.</Label>
                <Input
                  type="number" min={0} step={0.5}
                  value={coefs[seq] ?? 1}
                  onChange={(e) => set(seq, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={save}>Enregistrer</Button>
        </div>
      </CardContent>
    </Card>
  );
}


const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function EnrollmentTargetsPanel({ schoolId }: { schoolId?: string }) {
  const [values, setValues] = useState<number[]>(() => new Array(12).fill(30));
  const [showTargets, setShowTargets] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    setLoading(true);
    supabase.from("schools").select("enrollment_targets, show_enrollment_targets").eq("id", schoolId).maybeSingle().then(({ data, error }) => {
      if (cancelled) return;
      if (error) toast.error("Erreur lors du chargement: " + error.message);
      const raw = (data?.enrollment_targets ?? {}) as Record<string, number>;
      const next = new Array(12).fill(30).map((d, i) => Number(raw[String(i + 1)] ?? d));
      setValues(next);
      setShowTargets(Boolean((data as any)?.show_enrollment_targets));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [schoolId]);

  const setMonth = (idx: number, v: string) => {
    const n = Math.max(0, Math.floor(Number(v) || 0));
    setValues((arr) => arr.map((x, i) => (i === idx ? n : x)));
  };

  const toggleShow = async (v: boolean) => {
    if (!schoolId) return;
    setShowTargets(v);
    const { error } = await supabase.from("schools").update({ show_enrollment_targets: v } as any).eq("id", schoolId);
    if (error) {
      toast.error("Erreur: " + error.message);
      setShowTargets(!v);
      return;
    }
    toast.success(v ? "Objectifs affichés sur le tableau de bord" : "Objectifs masqués");
  };

  const save = async () => {
    if (!schoolId) return;
    setSaving(true);
    const payload: Record<string, number> = {};
    values.forEach((v, i) => { payload[String(i + 1)] = v; });
    const { error } = await supabase.from("schools").update({ enrollment_targets: payload }).eq("id", schoolId);
    setSaving(false);
    if (error) {
      toast.error("Erreur: " + error.message);
      return;
    }
    toast.success("Objectifs enregistrés");
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="text-base">Objectifs d'inscription mensuels</CardTitle>
        <p className="text-xs text-muted-foreground">Définissez vos objectifs d'élèves inscrits par mois.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Afficher les objectifs d'inscription</p>
            <p className="text-xs text-muted-foreground">Affiche l'objectif sur le tableau de bord et le graphique des inscriptions.</p>
          </div>
          <Switch checked={showTargets} onCheckedChange={toggleShow} disabled={loading} />
        </div>
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Chargement...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MONTHS_FR.map((m, i) => (
                <div key={m} className="flex items-center gap-3">
                  <Label className="w-24 shrink-0">{m}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={values[i]}
                    onChange={(e) => setMonth(i, e.target.value)}
                    disabled={!showTargets}
                  />
                </div>
              ))}
            </div>
            <Button onClick={save} disabled={saving || !showTargets}>
              {saving ? "Enregistrement..." : "Enregistrer les objectifs"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}


function UsersPanel({ schoolId, schoolName, currentUserId }: { schoolId?: string; schoolName?: string; currentUserId?: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialsInfo | null>(null);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, is_active, last_sign_in_at, must_change_password")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [schoolId]);

  const reset = async (u: any) => {
    setBusy(u.id);
    try {
      const res = await adminApi.resetPassword(u.id);
      setCredentials({ name: u.full_name ?? u.email, email: u.email, tempPassword: res.tempPassword, role: u.role === "parent" ? "parent" : "teacher", schoolName });
      await load();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const toggleActive = async (u: any) => {
    setBusy(u.id);
    try {
      await adminApi.setActive(u.id, !u.is_active);
      toast.success(u.is_active ? "Compte désactivé" : "Compte réactivé");
      await load();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const del = async () => {
    if (!confirmDel) return;
    setBusy(confirmDel.id);
    try {
      await adminApi.delete(confirmDel.id);
      toast.success("Compte supprimé");
      setConfirmDel(null);
      await load();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [creating, setCreating] = useState(false);

  const createSecretary = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast.error("Prénom, nom et email requis"); return;
    }
    setCreating(true);
    try {
      const res = await adminApi.createSecretary({
        firstName: form.firstName.trim(), lastName: form.lastName.trim(),
        email: form.email.trim(), phone: form.phone.trim() || undefined,
      });
      setCredentials({
        name: `${form.firstName} ${form.lastName}`, email: form.email,
        tempPassword: res.tempPassword, role: "teacher", schoolName,
      });
      setForm({ firstName: "", lastName: "", email: "", phone: "" });
      setCreateOpen(false);
      await load();
      toast.success("Secrétaire créée");
    } catch (e) { toast.error((e as Error).message); } finally { setCreating(false); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Gestion des utilisateurs</CardTitle>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />Ajouter une secrétaire
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? <p className="py-6 text-center text-sm text-muted-foreground">Chargement...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="py-2">Nom</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Dernière connexion</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="py-2 font-medium">{u.full_name ?? "—"}</td>
                    <td className="text-muted-foreground">{u.email}</td>
                    <td><Badge variant="secondary">{u.role}</Badge></td>
                    <td>{u.is_active === false ? <Badge variant="outline" className="text-destructive">Inactif</Badge> : <Badge variant="outline" className="text-success">Actif</Badge>}</td>
                    <td className="text-xs text-muted-foreground">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("fr-FR") : "—"}</td>
                    <td className="text-right">
                      <Button variant="ghost" size="icon" disabled={busy === u.id} onClick={() => reset(u)} title="Réinitialiser mot de passe"><KeyRound className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" disabled={busy === u.id || u.id === currentUserId} onClick={() => toggleActive(u)} title={u.is_active === false ? "Réactiver" : "Désactiver"}>
                        {u.is_active === false ? <UserCheck className="h-4 w-4 text-success" /> : <UserX className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" disabled={busy === u.id || u.id === currentUserId} onClick={() => setConfirmDel(u)} title="Supprimer"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <CredentialsModal info={credentials} onClose={() => setCredentials(null)} />
        {confirmDel && (
          <Dialog open onOpenChange={(o) => !o && setConfirmDel(null)}>
            <DialogContent>
              <DialogHeader><DialogTitle>Supprimer ce compte ?</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">{confirmDel.full_name} ({confirmDel.email}) — cette action est irréversible.</p>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setConfirmDel(null)}>Annuler</Button>
                <Button onClick={del} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle secrétaire</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Prénom</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
                <div><Label>Nom</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
              </div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Téléphone (optionnel)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <p className="text-xs text-muted-foreground">
                La secrétaire aura accès à : élèves, parents, facturation, paiements (création uniquement),
                annonces, calendrier, présences, transport. Elle ne pourra pas accéder à la comptabilité,
                au budget, au personnel ni aux paramètres.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
                <Button onClick={createSecretary} disabled={creating}>{creating ? "Création..." : "Créer"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function PrivacyPanel({ schoolId }: { schoolId?: string }) {
  const db = useDB();
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    setLoading(true);
    supabase.from("schools").select("privacy_accepted_at").eq("id", schoolId).maybeSingle().then(({ data }) => {
      if (cancelled) return;
      setAcceptedAt((data as any)?.privacy_accepted_at ?? null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [schoolId]);

  const exportAll = () => {
    const schoolPayload = {
      exportedAt: new Date().toISOString(),
      school: db.schools.find((s) => s.id === schoolId),
      classes: db.classes,
      students: db.students,
      teachers: db.teachers,
      parents: db.parents,
      grades: db.grades,
      attendance: db.attendance,
      payments: db.payments,
      paymentRecords: db.paymentRecords,
      classSubjects: db.classSubjects,
      feeTypes: db.feeTypes,
      announcements: db.announcements,
      academicYears: db.academicYears,
    };
    const blob = new Blob([JSON.stringify(schoolPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `export-ecole-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export généré");
  };

  const missingConsent = db.students.filter((s) => !s.consentGiven).length;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Données &amp; Confidentialité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="font-medium">Conformité — Loi n°2024/017 (Cameroun)</p>
            <p className="mt-1 text-xs text-muted-foreground">
              SchoolMaster isole vos données par école, restreint l'accès par rôle, et chiffre les communications.
              Vous êtes responsable du traitement des données scolaires.
            </p>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Politique acceptée</span>
            <span className="font-medium">
              {loading ? "…" : acceptedAt ? new Date(acceptedAt).toLocaleDateString("fr-FR") : "Non"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Élèves sans consentement enregistré</span>
            <span className={"font-medium " + (missingConsent > 0 ? "text-accent" : "text-success")}>
              {missingConsent}
            </span>
          </div>
          <a href="/confidentialite" target="_blank" rel="noreferrer" className="inline-block text-sm text-primary hover:underline">
            Lire la politique de confidentialité →
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exporter les données</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Téléchargez l'ensemble des données de votre école au format JSON. Utile pour vos archives ou en cas
            d'exercice du droit d'accès par un parent ou un employé.
          </p>
          <Button onClick={exportAll}>
            <Upload className="mr-1.5 h-4 w-4 rotate-180" />
            Exporter toutes les données
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SubjectsPanel() {
  const db = useDB();
  const subjects = getSchoolSubjects(db);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const classCount = (name: string) => {
    const key = name.toLowerCase();
    const ids = new Set(
      db.classSubjects.filter((s) => s.name.toLowerCase() === key).map((s) => s.classId),
    );
    return ids.size;
  };
  const teacherCount = (name: string) => {
    const key = name.toLowerCase();
    return db.teachers.filter((t) =>
      (t.subjects ?? [t.subject]).some((x) => (x ?? "").toLowerCase() === key),
    ).length;
  };

  const addSubject = () => {
    const name = newName.trim();
    if (!name) return;
    if (subjects.some((s) => s.toLowerCase() === name.toLowerCase())) {
      toast.error("Cette matière existe déjà");
      return;
    }
    // Adds to the unified list by attaching it to every existing class
    // as an unassigned entry, so it's immediately pickable everywhere.
    // Admin can remove it per-class if not relevant.
    updateDB((d) => {
      for (const c of d.classes) {
        d.classSubjects.push({
          id: crypto.randomUUID(),
          classId: c.id,
          name,
          coefficient: 1,
        });
      }
    });
    toast.success("Matière ajoutée à toutes les classes");
    setNewName("");
  };

  const doRename = () => {
    if (!renaming) return;
    const to = renameTo.trim();
    if (!to) { toast.error("Nom requis"); return; }
    updateDB((d) => {
      for (const s of d.classSubjects) {
        if (s.name.toLowerCase() === renaming.toLowerCase()) s.name = to;
      }
    });
    toast.success("Matière renommée");
    setRenaming(null);
    setRenameTo("");
  };

  const doDelete = () => {
    if (!confirmDel) return;
    const key = confirmDel.toLowerCase();
    updateDB((d) => {
      d.classSubjects = d.classSubjects.filter((s) => s.name.toLowerCase() !== key);
      d.teachers.forEach((t) => {
        if (t.subjects) t.subjects = t.subjects.filter((x) => (x ?? "").toLowerCase() !== key);
        if ((t.subject ?? "").toLowerCase() === key) t.subject = t.subjects?.[0] ?? "";
      });
    });
    toast.success("Matière supprimée");
    setConfirmDel(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Matières de l'école</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Liste unique des matières utilisée partout (classes, enseignants, notes). Toute matière créée ici
          est immédiatement disponible dans Classes et lors de l'affectation d'un enseignant.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Nouvelle matière (ex: Sciences Physiques)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSubject()}
          />
          <Button onClick={addSubject}>Ajouter</Button>
        </div>

        <div className="rounded-md border border-border">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
            <div>Matière</div>
            <div>Classes</div>
            <div>Enseignants</div>
            <div className="text-right">Actions</div>
          </div>
          {subjects.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">Aucune matière.</div>
          )}
          {subjects.map((s) => {
            const cCount = classCount(s);
            const tCount = teacherCount(s);
            const isRenaming = renaming === s;
            return (
              <div key={s} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0">
                {isRenaming ? (
                  <Input
                    value={renameTo}
                    onChange={(e) => setRenameTo(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doRename()}
                    autoFocus
                  />
                ) : (
                  <span className="font-medium">{s}</span>
                )}
                <Badge variant="secondary">{cCount} classe{cCount > 1 ? "s" : ""}</Badge>
                <Badge variant="secondary">{tCount} ens.</Badge>
                <div className="flex justify-end gap-1">
                  {isRenaming ? (
                    <>
                      <Button size="sm" onClick={doRename}>OK</Button>
                      <Button size="sm" variant="outline" onClick={() => { setRenaming(null); setRenameTo(""); }}>Annuler</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { setRenaming(s); setRenameTo(s); }}>Renommer</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDel(s)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Dialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supprimer « {confirmDel} » ?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Cette matière sera retirée de toutes les classes qui l'utilisent. Les notes déjà saisies restent
              conservées mais ne pourront plus être associées à cette matière.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDel(null)}>Annuler</Button>
              <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={doDelete}>Supprimer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

