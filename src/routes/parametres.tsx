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
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { trimesterRanges, currentAcademicYear, defaultTrimesterRanges, schoolYearStartYear } from "@/lib/trimesters";


export const Route = createFileRoute("/parametres")({
  component: ParametresPage,
});

function ParametresPage() {
  const { t } = useTranslation();
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
    toast.success(t("settings2.school.saved"));
  };

  const uploadLogo = async (file: File) => {
    const schoolId = user?.schoolId ?? school?.id;
    if (!schoolId) {
      toast.error(t("settings2.school.schoolNotFound"));
      return;
    }
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error(t("settings2.school.unsupportedFormat"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("settings2.school.fileTooLarge"));
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
      toast.success(t("settings2.school.logoUpdated"));
    } catch (err) {
      toast.error(t("settings2.school.uploadError", { message: (err as Error).message }));
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppLayout title={t("settings2.pageTitle")}>
      <Tabs defaultValue="ecole">
        <TabsList>
          <TabsTrigger value="ecole">{t("settings2.tabs.school")}</TabsTrigger>
          <TabsTrigger value="objectifs">{t("settings2.tabs.goals")}</TabsTrigger>
          <TabsTrigger value="evaluations">{t("settings2.tabs.evaluations")}</TabsTrigger>
          <TabsTrigger value="matieres">{t("settings2.tabs.subjects")}</TabsTrigger>
          <TabsTrigger value="utilisateurs">{t("settings2.tabs.users")}</TabsTrigger>
          <TabsTrigger value="confidentialite">{t("settings2.tabs.privacy")}</TabsTrigger>
          {isAdmin && <TabsTrigger value="journal">{t("settings2.tabs.journal")}</TabsTrigger>}
          <TabsTrigger value="compte">{t("settings2.tabs.account")}</TabsTrigger>
        </TabsList>


        <TabsContent value="ecole" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("settings2.school.infoTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>{t("settings2.school.logo")}</Label>
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
                          {uploading ? t("settings2.school.uploading") : t("settings2.school.changeLogo")}
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
                {[
                  { k: "name", label: t("settings2.school.name") },
                  { k: "director", label: t("settings2.school.director") },
                  { k: "email", label: t("settings2.school.email") },
                  { k: "phone", label: t("settings2.school.phone") },
                  { k: "address", label: t("settings2.school.address") },
                  { k: "city", label: t("settings2.school.city") },
                  { k: "country", label: t("settings2.school.country") },
                ].map((f) => (
                  <div key={f.k} className="space-y-1.5">
                    <Label>{f.label}</Label>
                    <Input
                      value={form[f.k as keyof typeof form] as string}
                      onChange={(e) => set(f.k as keyof typeof form, e.target.value)}
                    />
                  </div>
                ))}
                <Button onClick={saveSchool}>{t("settings2.school.save")}</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("settings2.school.appearanceTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t("settings2.school.darkMode")}</p>
                  <p className="text-xs text-muted-foreground">{t("settings2.school.darkModeDesc")}</p>
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
          <div className="space-y-4">
            <TrimesterDatesPanel />
            <SequenceCoefficientsPanel />
          </div>

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
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("settings2.account.languageTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  {t("settings2.account.languageDesc")}
                </p>
                <LanguageSwitcher />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("settings2.account.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("settings2.account.name")}</span><span className="font-medium">{user?.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("settings2.account.email")}</span><span className="font-medium">{user?.email}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("settings2.account.role")}</span><span className="font-medium">{user ? ROLE_LABELS[user.role] : ""}</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function TrimesterDatesPanel() {
  const { t } = useTranslation();
  const db = useDB();
  const ranges = trimesterRanges(db.academicYears);
  const [vals, setVals] = useState(() => ranges.map((r) => ({ start: r.start, end: r.end })));
  const [saving, setSaving] = useState(false);

  // Re-sync when hydration brings the stored dates in.
  useEffect(() => {
    setVals(ranges.map((r) => ({ start: r.start, end: r.end })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(ranges)]);

  const setVal = (i: number, k: "start" | "end", v: string) =>
    setVals((p) => p.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));

  const save = () => {
    for (const [i, v] of vals.entries()) {
      if (!v.start || !v.end || v.end < v.start) {
        toast.error(t("trimesters.invalidRange", { n: i + 1 }));
        return;
      }
    }
    setSaving(true);
    updateDB((d) => {
      let ay = currentAcademicYear(d.academicYears);
      if (!ay) {
        const y = schoolYearStartYear();
        ay = { id: crypto.randomUUID(), name: `${y}-${y + 1}`, isCurrent: true };
        d.academicYears.push(ay);
      }
      ay.term1Start = vals[0].start; ay.term1End = vals[0].end;
      ay.term2Start = vals[1].start; ay.term2End = vals[1].end;
      ay.term3Start = vals[2].start; ay.term3End = vals[2].end;
    });
    setSaving(false);
    toast.success(t("trimesters.saved"));
  };

  const reset = () => {
    const d = defaultTrimesterRanges();
    setVals(d.map((r) => ({ start: r.start, end: r.end })));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("trimesters.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("trimesters.help")}</p>
        <div className="grid grid-cols-1 gap-3">
          {ranges.map((r, i) => (
            <div key={r.term} className="rounded-md border border-border p-3">
              <p className="mb-2 text-sm font-medium">{t(`trimesters.term${i + 1}`)}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">{t("trimesters.start")}</Label>
                  <Input type="date" value={vals[i]?.start ?? ""} onChange={(e) => setVal(i, "start", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{t("trimesters.end")}</Label>
                  <Input type="date" value={vals[i]?.end ?? ""} onChange={(e) => setVal(i, "end", e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={reset}>{t("trimesters.reset")}</Button>
          <Button onClick={save} disabled={saving}>{t("common.save")}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SequenceCoefficientsPanel() {
  const { t } = useTranslation();
  const [coefs, setCoefs] = useState<Record<string, number>>(() => getSequenceCoefficients());

  const set = (seq: Sequence, v: string) => {
    const n = Math.max(0, Number(v) || 0);
    setCoefs((p) => ({ ...p, [seq]: n }));
  };
  const save = () => {
    setSequenceCoefficients(coefs as Record<Sequence, number>);
    toast.success(t("settings2.evaluations.saved"));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings2.evaluations.sequencesTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t("settings2.evaluations.sequencesHelp")}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SEQUENCES.map((seq) => (
            <div key={seq} className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">{seq}</p>
                <p className="text-xs text-muted-foreground">{SEQUENCE_TERM[seq]}</p>
              </div>
              <div className="w-24">
                <Label className="text-xs">{t("settings2.evaluations.coef")}</Label>
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
          <Button onClick={save}>{t("settings2.evaluations.save")}</Button>
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
  const { t } = useTranslation();
  const MONTHS = [
    t("settings2.goals.months.jan"), t("settings2.goals.months.feb"), t("settings2.goals.months.mar"),
    t("settings2.goals.months.apr"), t("settings2.goals.months.may"), t("settings2.goals.months.jun"),
    t("settings2.goals.months.jul"), t("settings2.goals.months.aug"), t("settings2.goals.months.sep"),
    t("settings2.goals.months.oct"), t("settings2.goals.months.nov"), t("settings2.goals.months.dec"),
  ];
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
      if (error) toast.error(t("settings2.goals.loadError", { message: error.message }));
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
      toast.error(t("settings2.goals.error", { message: error.message }));
      setShowTargets(!v);
      return;
    }
    toast.success(v ? t("settings2.goals.shown") : t("settings2.goals.hidden"));
  };

  const save = async () => {
    if (!schoolId) return;
    setSaving(true);
    const payload: Record<string, number> = {};
    values.forEach((v, i) => { payload[String(i + 1)] = v; });
    const { error } = await supabase.from("schools").update({ enrollment_targets: payload }).eq("id", schoolId);
    setSaving(false);
    if (error) {
      toast.error(t("settings2.goals.error", { message: error.message }));
      return;
    }
    toast.success(t("settings2.goals.saved"));
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="text-base">{t("settings2.goals.title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("settings2.goals.subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">{t("settings2.goals.show")}</p>
            <p className="text-xs text-muted-foreground">{t("settings2.goals.showDesc")}</p>
          </div>
          <Switch checked={showTargets} onCheckedChange={toggleShow} disabled={loading} />
        </div>
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("settings2.goals.loading")}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MONTHS.map((m, i) => (
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
              {saving ? t("settings2.goals.saving") : t("settings2.goals.save")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}


function UsersPanel({ schoolId, schoolName, currentUserId }: { schoolId?: string; schoolName?: string; currentUserId?: string }) {
  const { t } = useTranslation();
  const { hasFeature } = usePlan();
  const canCreateExtra = hasFeature("extra_roles");
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
      toast.success(u.is_active ? t("settings2.users.deactivated") : t("settings2.users.reactivated"));
      await load();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const del = async () => {
    if (!confirmDel) return;
    setBusy(confirmDel.id);
    try {
      await adminApi.delete(confirmDel.id);
      toast.success(t("settings2.users.deleted"));
      setConfirmDel(null);
      await load();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [creating, setCreating] = useState(false);

  const createSecretary = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast.error(t("settings2.users.requiredFields")); return;
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
      toast.success(t("settings2.users.createdToast"));
    } catch (e) { toast.error((e as Error).message); } finally { setCreating(false); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("settings2.users.title")}</CardTitle>
        {canCreateExtra ? (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />{t("settings2.users.addSecretary")}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              toast.info(
                t("settings2.users.secretaryLockedToast", { phone: WINTEK_CONTACT.phones, email: WINTEK_CONTACT.email }),
              )
            }
            title={t("settings2.users.secretaryLockedTitle")}
          >
            <Lock className="h-4 w-4 mr-2" />{t("settings2.users.secretaryLocked")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? <p className="py-6 text-center text-sm text-muted-foreground">{t("settings2.users.loading")}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="py-2">{t("settings2.users.colName")}</th><th>{t("settings2.users.colEmail")}</th><th>{t("settings2.users.colRole")}</th><th>{t("settings2.users.colStatus")}</th><th>{t("settings2.users.colLastLogin")}</th><th className="text-right">{t("settings2.users.colActions")}</th></tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="py-2 font-medium">{u.full_name ?? "—"}</td>
                    <td className="text-muted-foreground">{u.email}</td>
                    <td><Badge variant="secondary">{u.role}</Badge></td>
                    <td>{u.is_active === false ? <Badge variant="outline" className="text-destructive">{t("settings2.users.inactive")}</Badge> : <Badge variant="outline" className="text-success">{t("settings2.users.active")}</Badge>}</td>
                    <td className="text-xs text-muted-foreground">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("fr-FR") : "—"}</td>
                    <td className="text-right">
                      <Button variant="ghost" size="icon" disabled={busy === u.id} onClick={() => reset(u)} title={t("settings2.users.resetPassword")}><KeyRound className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" disabled={busy === u.id || u.id === currentUserId} onClick={() => toggleActive(u)} title={u.is_active === false ? t("settings2.users.reactivate") : t("settings2.users.deactivate")}>
                        {u.is_active === false ? <UserCheck className="h-4 w-4 text-success" /> : <UserX className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" disabled={busy === u.id || u.id === currentUserId} onClick={() => setConfirmDel(u)} title={t("settings2.users.delete")}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
              <DialogHeader><DialogTitle>{t("settings2.users.deleteConfirmTitle")}</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">{t("settings2.users.deleteConfirmBody", { name: confirmDel.full_name, email: confirmDel.email })}</p>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setConfirmDel(null)}>{t("settings2.users.cancel")}</Button>
                <Button onClick={del} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("settings2.users.delete")}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("settings2.users.newSecretaryTitle")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("settings2.users.firstName")}</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
                <div><Label>{t("settings2.users.lastName")}</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
              </div>
              <div><Label>{t("settings2.users.colEmail")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>{t("settings2.users.phoneOptional")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <p className="text-xs text-muted-foreground">
                {t("settings2.users.secretaryAccessNote")}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("settings2.users.cancel")}</Button>
                <Button onClick={createSecretary} disabled={creating}>{creating ? t("settings2.users.creating") : t("settings2.users.create")}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function PrivacyPanel({ schoolId }: { schoolId?: string }) {
  const { t } = useTranslation();
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
    toast.success(t("settings2.privacy.exportDone"));
  };

  const missingConsent = db.students.filter((s) => !s.consentGiven).length;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings2.privacy.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="font-medium">{t("settings2.privacy.complianceTitle")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("settings2.privacy.complianceDesc")}
            </p>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("settings2.privacy.policyAccepted")}</span>
            <span className="font-medium">
              {loading ? "…" : acceptedAt ? new Date(acceptedAt).toLocaleDateString("fr-FR") : t("settings2.privacy.no")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("settings2.privacy.studentsWithoutConsent")}</span>
            <span className={"font-medium " + (missingConsent > 0 ? "text-accent" : "text-success")}>
              {missingConsent}
            </span>
          </div>
          <a href="/confidentialite" target="_blank" rel="noreferrer" className="inline-block text-sm text-primary hover:underline">
            {t("settings2.privacy.readPolicy")}
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings2.privacy.exportTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {t("settings2.privacy.exportDesc")}
          </p>
          <Button onClick={exportAll}>
            <Upload className="mr-1.5 h-4 w-4 rotate-180" />
            {t("settings2.privacy.exportButton")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SubjectsPanel() {
  const { t } = useTranslation();
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
      toast.error(t("settings2.subjects.alreadyExists"));
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
    toast.success(t("settings2.subjects.added"));
    setNewName("");
  };

  const doRename = () => {
    if (!renaming) return;
    const to = renameTo.trim();
    if (!to) { toast.error(t("settings2.subjects.nameRequired")); return; }
    updateDB((d) => {
      for (const s of d.classSubjects) {
        if (s.name.toLowerCase() === renaming.toLowerCase()) s.name = to;
      }
    });
    toast.success(t("settings2.subjects.renamed"));
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
    toast.success(t("settings2.subjects.deleted"));
    setConfirmDel(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings2.subjects.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("settings2.subjects.help")}
        </p>
        <div className="flex gap-2">
          <Input
            placeholder={t("settings2.subjects.placeholder")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSubject()}
          />
          <Button onClick={addSubject}>{t("settings2.subjects.add")}</Button>
        </div>

        <div className="rounded-md border border-border">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
            <div>{t("settings2.subjects.colSubject")}</div>
            <div>{t("settings2.subjects.colClasses")}</div>
            <div>{t("settings2.subjects.colTeachers")}</div>
            <div className="text-right">{t("settings2.subjects.colActions")}</div>
          </div>
          {subjects.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">{t("settings2.subjects.none")}</div>
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
                <Badge variant="secondary">{t("settings2.subjects.classesCount", { count: cCount })}</Badge>
                <Badge variant="secondary">{t("settings2.subjects.teachersAbbrev", { count: tCount })}</Badge>
                <div className="flex justify-end gap-1">
                  {isRenaming ? (
                    <>
                      <Button size="sm" onClick={doRename}>{t("settings2.subjects.ok")}</Button>
                      <Button size="sm" variant="outline" onClick={() => { setRenaming(null); setRenameTo(""); }}>{t("settings2.subjects.cancel")}</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { setRenaming(s); setRenameTo(s); }}>{t("settings2.subjects.rename")}</Button>
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
              <DialogTitle>{t("settings2.subjects.deleteConfirmTitle", { name: confirmDel })}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t("settings2.subjects.deleteConfirmBody")}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDel(null)}>{t("settings2.subjects.cancel")}</Button>
              <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={doDelete}>{t("settings2.subjects.delete")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

