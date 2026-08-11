import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { EmptyStateBlock, LoadingState } from "@/components/states";
import { CalendarDays as CalendarIconEmpty } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { isSchoolAdmin, isSuperAdmin, isSecretary } from "@/lib/permissions";
import { useDB } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, MapPin, Clock, CalendarDays, List, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/calendrier")({ component: CalendrierPage });

type EventType = "vacances" | "examen" | "reunion" | "evenement" | "sortie" | "ferie";
type EventTarget = "ecole" | "classe" | "parents" | "enseignants";

interface EventRow {
  id: string;
  school_id: string;
  title: string;
  description: string | null;
  type: EventType;
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  target: EventTarget;
  target_class_id: string | null;
  location: string | null;
  created_by: string | null;
  created_at: string;
}

const EVENT_TYPES: EventType[] = ["vacances", "examen", "reunion", "evenement", "sortie", "ferie"];
const EVENT_TARGETS: EventTarget[] = ["ecole", "classe", "parents", "enseignants"];
const TYPE_META_STYLE: Record<EventType, { bg: string; border: string; text: string; dot: string }> = {
  vacances:  { bg: "bg-emerald-100",  border: "border-emerald-400", text: "text-emerald-900", dot: "bg-emerald-500" },
  examen:    { bg: "bg-red-100",      border: "border-red-400",     text: "text-red-900",     dot: "bg-red-500" },
  reunion:   { bg: "bg-blue-100",     border: "border-blue-400",    text: "text-blue-900",    dot: "bg-blue-500" },
  evenement: { bg: "bg-orange-100",   border: "border-orange-400",  text: "text-orange-900",  dot: "bg-orange-500" },
  sortie:    { bg: "bg-purple-100",   border: "border-purple-400",  text: "text-purple-900",  dot: "bg-purple-500" },
  ferie:     { bg: "bg-gray-200",     border: "border-gray-400",    text: "text-gray-800",    dot: "bg-gray-500" },
};
function typeLabel(t: EventType) { return i18n.t(`calendar.types.${t}`); }
function targetLabel(tg: EventTarget) { return i18n.t(`calendar.targets.${tg}`); }
function typeMeta(t: EventType) { return { label: typeLabel(t), ...TYPE_META_STYLE[t] }; }

const MONTH_KEYS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const WEEKDAY_KEYS = ["mon","tue","wed","thu","fri","sat","sun"];
function monthsLabels() { return MONTH_KEYS.map((k) => i18n.t(`calendar.months.${k}`)); }
function weekdaysLabels() { return WEEKDAY_KEYS.map((k) => i18n.t(`calendar.weekdaysShort.${k}`)); }

function fmtISO(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmtFr(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}/${y}`;
}
function eventCoversDate(ev: EventRow, iso: string) {
  const end = ev.end_date ?? ev.start_date;
  return iso >= ev.start_date && iso <= end;
}

function CalendrierPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const db = useDB();
  const isAdmin = isSchoolAdmin(user) || isSuperAdmin(user) || isSecretary(user);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"month" | "list">("month");
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [viewingEvent, setViewingEvent] = useState<EventRow | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("start_date", { ascending: true });
    if (error) { toast.error(t("calendar.loadError")); setLoading(false); return; }
    setEvents((data ?? []) as EventRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useRealtimeRefresh(user?.schoolId, ["events"], fetchEvents);

  const monthEvents = useMemo(() => {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const monthStart = fmtISO(new Date(y, m, 1));
    const monthEnd = fmtISO(new Date(y, m + 1, 0));
    return events.filter((e) => {
      const end = e.end_date ?? e.start_date;
      return !(end < monthStart || e.start_date > monthEnd);
    });
  }, [events, cursor]);

  const upcoming = useMemo(() => {
    const today = fmtISO(new Date());
    return events
      .filter((e) => (e.end_date ?? e.start_date) >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 20);
  }, [events]);

  // Build month grid
  const grid = useMemo(() => {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const first = new Date(y, m, 1);
    const firstWeekday = (first.getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: { date: Date | null; iso: string | null; inMonth: boolean }[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ date: null, iso: null, inMonth: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(y, m, d);
      cells.push({ date: dt, iso: fmtISO(dt), inMonth: true });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, iso: null, inMonth: false });
    return cells;
  }, [cursor]);

  const todayIso = fmtISO(new Date());
  const daysEvents = (iso: string) => monthEvents.filter((e) => eventCoversDate(e, iso));

  const handleDelete = async (id: string) => {
    if (!confirm(t("calendar.confirmDeleteEvent"))) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return toast.error(t("calendar.deleteError"));
    toast.success(t("calendar.eventDeleted"));
    setViewingEvent(null);
    fetchEvents();
  };

  return (
    <AppLayout title={t("calendar.title")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() - 1); setCursor(d); }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[180px] text-center text-lg font-semibold">
            {monthsLabels()[cursor.getMonth()]} {cursor.getFullYear()}
          </div>
          <Button variant="outline" size="icon" onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() + 1); setCursor(d); }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }}>{t("calendar.today")}</Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border">
            <Button variant={view === "month" ? "secondary" : "ghost"} size="sm" onClick={() => setView("month")} className="rounded-r-none">
              <LayoutGrid className="mr-1.5 h-4 w-4" /> {t("calendar.month")}
            </Button>
            <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setView("list")} className="rounded-l-none">
              <List className="mr-1.5 h-4 w-4" /> {t("calendar.list")}
            </Button>
          </div>
          {isAdmin && (
            <Button onClick={() => { setEditing(null); setOpenDialog(true); }}>
              <Plus className="mr-1.5 h-4 w-4" /> {t("calendar.newEvent")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="p-3 md:p-4">
            {loading ? (
              <LoadingState className="h-64" />
            ) : view === "month" ? (
              <div>
                <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
                  {weekdaysLabels().map((d) => <div key={d} className="py-1">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {grid.map((cell, i) => {
                    if (!cell.iso || !cell.date) return <div key={i} className="min-h-[64px] rounded-md bg-muted/30 sm:min-h-[88px]" />;
                    const dayEvs = daysEvents(cell.iso);
                    const isToday = cell.iso === todayIso;
                    const isSelected = cell.iso === selectedDay;
                    const visibleEvs = dayEvs.slice(0, 2);
                    const extra = dayEvs.length - visibleEvs.length;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedDay(cell.iso)}
                        className={cn(
                          "flex min-h-[64px] min-w-0 flex-col overflow-hidden rounded-md border p-1 text-left transition hover:bg-accent/30 sm:min-h-[88px]",
                          isToday && "border-primary",
                          isSelected && "ring-2 ring-primary",
                        )}
                      >
                        <span className={cn("text-[11px] font-semibold leading-none", isToday && "text-primary")}>{cell.date.getDate()}</span>
                        <div className="mt-1 flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
                          {visibleEvs.map((ev) => {
                            const meta = typeMeta(ev.type);
                            return (
                              <span
                                key={ev.id}
                                onClick={(e) => { e.stopPropagation(); setViewingEvent(ev); }}
                                className={cn(
                                  "block h-4 w-full min-w-0 truncate rounded px-1 text-[10px] font-medium leading-4",
                                  meta.bg, meta.text,
                                )}
                                title={ev.title}
                              >
                                {ev.title}
                              </span>
                            );
                          })}
                          {extra > 0 && (
                            <span className="block h-4 w-full truncate rounded bg-muted px-1 text-[10px] font-medium leading-4 text-muted-foreground">
                              +{extra}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

              </div>
            ) : (
              <div className="space-y-2">
                {monthEvents.length === 0 && (
                  <EmptyStateBlock icon={CalendarIconEmpty} titleKey="emptyEvents" description={t("calendar.noEventsMonth")} />
                )}
                {monthEvents.map((ev) => <EventListItem key={ev.id} ev={ev} onClick={() => setViewingEvent(ev)} />)}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {selectedDay && (
            <Card>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold">{fmtFr(selectedDay)}</h3>
                  <button onClick={() => setSelectedDay(null)} className="text-xs text-muted-foreground hover:underline">{t("calendar.close")}</button>
                </div>
                {daysEvents(selectedDay).length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("calendar.noEventsThisDay")}</p>
                ) : (
                  <div className="space-y-2">
                    {daysEvents(selectedDay).map((ev) => <EventListItem key={ev.id} ev={ev} onClick={() => setViewingEvent(ev)} compact />)}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold"><CalendarDays className="h-4 w-4" /> {t("calendar.upcomingEvents")}</h3>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("calendar.noUpcomingEvents")}</p>
              ) : (
                <div className="space-y-2">
                  {upcoming.slice(0, 8).map((ev) => <EventListItem key={ev.id} ev={ev} onClick={() => setViewingEvent(ev)} compact />)}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold">{t("calendar.legend")}</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {EVENT_TYPES.map((et) => (
                  <div key={et} className="flex items-center gap-2">
                    <span className={cn("h-3 w-3 rounded-full", typeMeta(et).dot)} />
                    <span>{typeMeta(et).label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* View event modal */}
      <Dialog open={!!viewingEvent} onOpenChange={(o) => !o && setViewingEvent(null)}>
        <DialogContent>
          {viewingEvent && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className={cn("h-3 w-3 rounded-full", typeMeta(viewingEvent.type).dot)} />
                  <DialogTitle>{viewingEvent.title}</DialogTitle>
                </div>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn(typeMeta(viewingEvent.type).bg, typeMeta(viewingEvent.type).text, "border-0")}>
                    {typeMeta(viewingEvent.type).label}
                  </Badge>
                  <Badge variant="outline">{targetLabel(viewingEvent.target)}</Badge>
                  {viewingEvent.target === "classe" && viewingEvent.target_class_id && (
                    <Badge variant="outline">{db.classes.find((c) => c.id === viewingEvent.target_class_id)?.name ?? "Classe"}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  <span>
                    {fmtFr(viewingEvent.start_date)}
                    {viewingEvent.end_date && viewingEvent.end_date !== viewingEvent.start_date && ` → ${fmtFr(viewingEvent.end_date)}`}
                  </span>
                </div>
                {(viewingEvent.start_time || viewingEvent.end_time) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{viewingEvent.start_time ?? ""}{viewingEvent.end_time ? ` – ${viewingEvent.end_time}` : ""}</span>
                  </div>
                )}
                {viewingEvent.location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{viewingEvent.location}</span>
                  </div>
                )}
                {viewingEvent.description && (
                  <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3">{viewingEvent.description}</p>
                )}
              </div>
              {isAdmin && (
                <DialogFooter className="gap-2 sm:gap-2">
                  <Button variant="outline" onClick={() => { setEditing(viewingEvent); setViewingEvent(null); setOpenDialog(true); }}>
                    <Pencil className="mr-1.5 h-4 w-4" /> Modifier
                  </Button>
                  <Button variant="destructive" onClick={() => handleDelete(viewingEvent.id)}>
                    <Trash2 className="mr-1.5 h-4 w-4" /> Supprimer
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {isAdmin && (
        <EventFormDialog
          open={openDialog}
          onOpenChange={setOpenDialog}
          editing={editing}
          schoolId={user?.schoolId ?? ""}
          classes={db.classes}
          onSaved={() => { setOpenDialog(false); setEditing(null); fetchEvents(); }}
        />
      )}
    </AppLayout>
  );
}

function EventListItem({ ev, onClick, compact }: { ev: EventRow; onClick: () => void; compact?: boolean }) {
  const meta = typeMeta(ev.type);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex w-full items-start gap-2 rounded-md border-l-4 p-2 text-left transition hover:bg-accent/30", meta.border, meta.bg)}
    >
      <div className="flex-1 min-w-0">
        <div className={cn("truncate font-medium", meta.text, compact ? "text-sm" : "text-sm")}>{ev.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span>{fmtFr(ev.start_date)}{ev.end_date && ev.end_date !== ev.start_date && ` → ${fmtFr(ev.end_date)}`}</span>
          {ev.start_time && <span>· {ev.start_time}{ev.end_time ? `–${ev.end_time}` : ""}</span>}
          {ev.location && <span>· {ev.location}</span>}
        </div>
      </div>
      <Badge variant="outline" className="shrink-0 border-0 bg-background/60 text-[10px]">{meta.label}</Badge>
    </button>
  );
}

function EventFormDialog({
  open, onOpenChange, editing, schoolId, classes, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: EventRow | null;
  schoolId: string;
  classes: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<EventType>("evenement");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [target, setTarget] = useState<EventTarget>("ecole");
  const [classId, setClassId] = useState<string>("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? "");
      setType(editing.type);
      setStartDate(editing.start_date);
      setEndDate(editing.end_date ?? "");
      setStartTime(editing.start_time ?? "");
      setEndTime(editing.end_time ?? "");
      setTarget(editing.target);
      setClassId(editing.target_class_id ?? "");
      setLocation(editing.location ?? "");
    } else {
      setTitle(""); setDescription(""); setType("evenement");
      setStartDate(fmtISO(new Date())); setEndDate(""); setStartTime(""); setEndTime("");
      setTarget("ecole"); setClassId(""); setLocation("");
    }
  }, [open, editing]);

  const save = async () => {
    if (!title.trim()) return toast.error("Titre requis");
    if (!startDate) return toast.error("Date de début requise");
    if (target === "classe" && !classId) return toast.error("Sélectionnez une classe");
    setSaving(true);
    const payload = {
      school_id: schoolId,
      title: title.trim(),
      description: description.trim() || null,
      type,
      start_date: startDate,
      end_date: endDate || null,
      start_time: startTime || null,
      end_time: endTime || null,
      target,
      target_class_id: target === "classe" ? classId : null,
      location: location.trim() || null,
    };
    const { data: { user } } = await supabase.auth.getUser();
    if (editing) {
      const { error } = await supabase.from("events").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error("Modification impossible");
      toast.success("Événement modifié");
    } else {
      const { error } = await supabase.from("events").insert({ ...payload, created_by: user?.id ?? null });
      setSaving(false);
      if (error) return toast.error("Création impossible");
      toast.success("Événement créé");
    }
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier l'événement" : "Nouvel événement"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Réunion parents CE1" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type *</Label>
              <Select value={type} onValueChange={(v) => setType(v as EventType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{typeMeta(t).label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Audience *</Label>
              <Select value={target} onValueChange={(v) => setTarget(v as EventTarget)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TARGETS.map((t) => (
                    <SelectItem key={t} value={t}>{targetLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {target === "classe" && (
            <div>
              <Label>Classe *</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date début *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Date fin</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Heure début</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label>Heure fin</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Lieu</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Salle polyvalente" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : editing ? "Modifier" : "Créer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
