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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Megaphone, Upload, Image as ImageIcon, KeyRound, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import type { Announcement } from "@/lib/types";
import { adminApi } from "@/lib/admin-api";
import { CredentialsModal, type CredentialsInfo } from "@/components/CredentialsModal";

export const Route = createFileRoute("/parametres")({
  component: ParametresPage,
});

function ParametresPage() {
  const db = useDB();
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const school = db.schools.find((s) => s.id === user?.schoolId) ?? db.schools[0];

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
    if (!school) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${school.id}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("school-logos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("school-logos").getPublicUrl(path);
      set("logo", data.publicUrl);
      updateDB((d) => {
        const idx = d.schools.findIndex((s) => s.id === school.id);
        if (idx >= 0) d.schools[idx] = { ...d.schools[idx], logo: data.publicUrl };
      });
      toast.success("Logo téléchargé");
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
          <TabsTrigger value="annonces">Annonces</TabsTrigger>
          <TabsTrigger value="utilisateurs">Utilisateurs</TabsTrigger>
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

        <TabsContent value="annonces" className="mt-4">
          <AnnouncementsPanel authorId={user?.id} />
        </TabsContent>

        <TabsContent value="utilisateurs" className="mt-4">
          <UsersPanel schoolId={school?.id} schoolName={school?.name} currentUserId={user?.id} />
        </TabsContent>



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

function AnnouncementsPanel({ authorId }: { authorId?: string }) {
  const db = useDB();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<Announcement["audience"]>("Tous");

  const sorted = [...db.announcements].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const submit = () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Titre et contenu requis");
      return;
    }
    updateDB((d) => {
      d.announcements.unshift({
        id: crypto.randomUUID(),
        title: title.trim(),
        content: content.trim(),
        audience,
        authorId,
        createdAt: new Date().toISOString(),
      });
    });
    setTitle("");
    setContent("");
    setAudience("Tous");
    toast.success("Annonce publiée");
  };

  const remove = (id: string) => {
    updateDB((d) => {
      d.announcements = d.announcements.filter((a) => a.id !== id);
    });
    toast.success("Annonce supprimée");
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4" /> Nouvelle annonce
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Titre</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Réunion parents-professeurs" />
          </div>
          <div className="space-y-1.5">
            <Label>Audience</Label>
            <Select value={audience} onValueChange={(v) => setAudience(v as Announcement["audience"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Tous">Tous</SelectItem>
                <SelectItem value="Parents">Parents</SelectItem>
                <SelectItem value="Enseignants">Enseignants</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Contenu</Label>
            <Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Détails de l'annonce..." />
          </div>
          <Button onClick={submit}>Publier l'annonce</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Annonces récentes ({sorted.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sorted.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucune annonce</p>
          ) : (
            sorted.map((a) => (
              <div key={a.id} className="rounded-lg border border-border p-3">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{a.audience}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(a.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(a.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">{a.content}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function EnrollmentTargetsPanel({ schoolId }: { schoolId?: string }) {
  const [values, setValues] = useState<number[]>(() => new Array(12).fill(30));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    setLoading(true);
    supabase.from("schools").select("enrollment_targets").eq("id", schoolId).maybeSingle().then(({ data, error }) => {
      if (cancelled) return;
      if (error) toast.error("Erreur lors du chargement: " + error.message);
      const raw = (data?.enrollment_targets ?? {}) as Record<string, number>;
      const next = new Array(12).fill(30).map((d, i) => Number(raw[String(i + 1)] ?? d));
      setValues(next);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [schoolId]);

  const setMonth = (idx: number, v: string) => {
    const n = Math.max(0, Math.floor(Number(v) || 0));
    setValues((arr) => arr.map((x, i) => (i === idx ? n : x)));
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
                  />
                </div>
              ))}
            </div>
            <Button onClick={save} disabled={saving}>
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

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Gestion des utilisateurs</CardTitle></CardHeader>
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
      </CardContent>
    </Card>
  );
}
