import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { superAdminApi } from "@/lib/super-admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Wrench, Loader2, Megaphone } from "lucide-react";

type Row = {
  maintenance_active: boolean;
  maintenance_message: string | null;
  maintenance_expected_return: string | null;
  announcement_active: boolean;
  announcement_message: string | null;
  announcement_starts_at: string | null;
  announcement_ends_at: string | null;
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MaintenancePanel() {
  const { t } = useTranslation();
  const DEFAULT_MSG = t("maintenance.panel.defaultMessage");
  const DEFAULT_ANN = t("maintenance.panel.defaultAnnouncement");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MSG);
  const [expected, setExpected] = useState("");

  // Announcement state
  const [annSaving, setAnnSaving] = useState(false);
  const [annActive, setAnnActive] = useState(false);
  const [annMessage, setAnnMessage] = useState(DEFAULT_ANN);
  const [annStarts, setAnnStarts] = useState("");
  const [annEnds, setAnnEnds] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("platform_settings")
      .select(
        "maintenance_active, maintenance_message, maintenance_expected_return, announcement_active, announcement_message, announcement_starts_at, announcement_ends_at",
      )
      .eq("id", true)
      .maybeSingle();
    if (!error && data) {
      const r = data as Row;
      setActive(!!r.maintenance_active);
      setMessage(r.maintenance_message || DEFAULT_MSG);
      setExpected(toLocalInput(r.maintenance_expected_return));
      setAnnActive(!!r.announcement_active);
      setAnnMessage(r.announcement_message || DEFAULT_ANN);
      setAnnStarts(toLocalInput(r.announcement_starts_at));
      setAnnEnds(toLocalInput(r.announcement_ends_at));
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const save = async (nextActive?: boolean) => {
    setSaving(true);
    try {
      const turningOn = (nextActive ?? active) === true;
      const payload: Record<string, unknown> = {
        id: true,
        maintenance_active: nextActive ?? active,
        maintenance_message: message.trim() || null,
        maintenance_expected_return: expected ? new Date(expected).toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      // Turning maintenance ON auto-disables the pre-announcement banner.
      if (turningOn) payload.announcement_active = false;
      const { error } = await supabase.from("platform_settings").upsert(payload, { onConflict: "id" });
      if (error) throw error;
      if (typeof nextActive === "boolean") setActive(nextActive);
      if (turningOn) setAnnActive(false);
      toast.success(
        (nextActive ?? active) ? t("maintenance.panel.toasts.maintenanceOn") : t("maintenance.panel.toasts.maintenanceOff"),
      );
    } catch (e) {
      toast.error((e as Error).message || t("maintenance.panel.toasts.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const saveAnnouncement = async (nextActive?: boolean, opts?: { broadcast?: boolean }) => {
    setAnnSaving(true);
    try {
      const turningOn = (nextActive ?? annActive) === true;
      const payload: Record<string, unknown> = {
        id: true,
        announcement_active: nextActive ?? annActive,
        announcement_message: annMessage.trim() || null,
        announcement_starts_at: annStarts ? new Date(annStarts).toISOString() : null,
        announcement_ends_at: annEnds ? new Date(annEnds).toISOString() : null,
        announcement_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("platform_settings").upsert(payload, { onConflict: "id" });
      if (error) throw error;
      if (typeof nextActive === "boolean") setAnnActive(nextActive);
      if (turningOn && opts?.broadcast !== false) {
        try {
          const res = await superAdminApi.broadcastAnnouncement(annMessage.trim() || DEFAULT_ANN);
          toast.success(t("maintenance.panel.toasts.broadcastSent", { count: res.recipients }));
        } catch (e) {
          toast.error(t("maintenance.panel.toasts.broadcastFailed", { error: (e as Error).message }));
        }
      } else {
        toast.success(turningOn ? t("maintenance.panel.toasts.announcementOn") : t("maintenance.panel.toasts.announcementOff"));
      }
    } catch (e) {
      toast.error((e as Error).message || t("maintenance.panel.toasts.updateFailed"));
    } finally {
      setAnnSaving(false);
    }
  };

  return (
    <Card className="mt-6 border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className="h-4 w-4 text-primary" />
          {t("maintenance.panel.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("maintenance.panel.loading")}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div>
                <div className="text-sm font-medium">
                  {active ? t("maintenance.panel.activeLabel") : t("maintenance.panel.offLabel")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {active ? t("maintenance.panel.activeHint") : t("maintenance.panel.offHint")}
                </div>
              </div>
              <Switch
                checked={active}
                onCheckedChange={(v) => save(v)}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maint-msg">{t("maintenance.panel.messageLabel")}</Label>
              <Textarea
                id="maint-msg"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={DEFAULT_MSG}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maint-eta">{t("maintenance.panel.etaLabel")}</Label>
              <Input
                id="maint-eta"
                type="datetime-local"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => save()} disabled={saving} size="sm">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("maintenance.panel.saveMessage")}
              </Button>
            </div>

            {/* ─── Announcement banner ─────────────────────────────── */}
            <div className="mt-6 border-t pt-5">
              <div className="mb-3 flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-semibold">{t("maintenance.panel.announcementSectionTitle")}</h3>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                {t("maintenance.panel.announcementSectionDesc")}
              </p>

              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                <div>
                  <div className="text-sm font-medium">
                    {annActive ? t("maintenance.panel.announcementActiveLabel") : t("maintenance.panel.announcementOffLabel")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {annActive ? t("maintenance.panel.announcementActiveHint") : t("maintenance.panel.announcementOffHint")}
                  </div>
                </div>
                <Switch
                  checked={annActive}
                  onCheckedChange={(v) => saveAnnouncement(v, { broadcast: v })}
                  disabled={annSaving || active}
                />
              </div>
              {active && (
                <p className="mt-2 text-xs text-amber-600">
                  {t("maintenance.panel.announcementDisabledNote")}
                </p>
              )}

              <div className="mt-4 space-y-2">
                <Label htmlFor="ann-msg">{t("maintenance.panel.announcementMessageLabel")}</Label>
                <Textarea
                  id="ann-msg"
                  rows={3}
                  value={annMessage}
                  onChange={(e) => setAnnMessage(e.target.value)}
                  placeholder={DEFAULT_ANN}
                />
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ann-starts">{t("maintenance.panel.announcementStartLabel")}</Label>
                  <Input
                    id="ann-starts"
                    type="datetime-local"
                    value={annStarts}
                    onChange={(e) => setAnnStarts(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ann-ends">{t("maintenance.panel.announcementEndLabel")}</Label>
                  <Input
                    id="ann-ends"
                    type="datetime-local"
                    value={annEnds}
                    onChange={(e) => setAnnEnds(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveAnnouncement(undefined, { broadcast: false })}
                  disabled={annSaving}
                >
                  {annSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("maintenance.panel.save")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveAnnouncement(true, { broadcast: true })}
                  disabled={annSaving || active}
                >
                  {annSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("maintenance.panel.activateAndNotify")}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
