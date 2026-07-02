import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

import { useDB } from "@/lib/store";
import { InactivityGuard } from "@/components/InactivityGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fcfa } from "@/lib/format";
import { gradeValue, appreciationFor, deriveInvoiceStatus, type Grade, type Payment, type PaymentRecord, type Student, type Classe } from "@/lib/types";

function paidFor(invoice: Payment, records: PaymentRecord[]): number {
  const summed = records.filter((r) => r.invoiceId === invoice.id).reduce((s, r) => s + (r.amount || 0), 0);
  return Math.max(invoice.amountPaid ?? 0, summed);
}
import { Logo } from "@/components/Logo";
import { useParentChildren, type ParentChild } from "@/lib/useParentChildren";
import { useNotifications } from "@/lib/notifications";
import {
  Bell, Calendar, GraduationCap, UserCircle, LogOut, Wallet, MessageSquare,
  CheckCircle2, Inbox, BookOpen, Users2, HeartPulse, ShieldAlert, MoreHorizontal,
  CalendarDays,
} from "lucide-react";
import { MedicalTab } from "@/components/MedicalTab";
import { DisciplineTab } from "@/components/DisciplineTab";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";


export const Route = createFileRoute("/parent")({
  component: ParentPortal,
});

type TabKey = "tous" | "enfant" | "notes" | "presences" | "paiements" | "medical" | "suivi" | "messages" | "calendrier";

function ParentPortal() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const db = useDB();
  const { children, loading: childrenLoading, selectedId, setSelectedId, selectedChild } = useParentChildren();
  const [tab, setTab] = useState<TabKey>("enfant");
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !user) { navigate({ to: "/login", replace: true }); return; }
    if (user.mustChangePassword) { navigate({ to: "/changer-mot-de-passe", replace: true }); return; }
    if (user.role !== "parent") navigate({ to: "/dashboard", replace: true });
  }, [user, loading, isAuthenticated, navigate]);

  const hasMultiple = children.length > 1;

  type TabDef = { key: TabKey; label: string; icon: typeof UserCircle };
  const PRIMARY: TabDef[] = [
    ...(hasMultiple ? [{ key: "tous" as TabKey, label: "Tous", icon: Users2 }] : []),
    { key: "enfant", label: "Enfant", icon: UserCircle },
    { key: "notes", label: "Notes", icon: GraduationCap },
    { key: "paiements", label: "Paiements", icon: Wallet },
    { key: "messages", label: "Messages", icon: MessageSquare },
  ];
  const MORE: TabDef[] = [
    { key: "presences", label: "Présences", icon: Calendar },
    { key: "medical", label: "Médical", icon: HeartPulse },
    { key: "suivi", label: "Suivi", icon: ShieldAlert },
    { key: "calendrier", label: "Calendrier", icon: CalendarDays },
  ];
  const moreActive = MORE.some((m) => m.key === tab);
  const navItems = PRIMARY.length >= 5 ? PRIMARY.slice(0, 5) : PRIMARY;


  // Resolve a Student-like object from local db (may be missing if not synced) — fall back to hook data
  const student: Student | null = useMemo(() => {
    if (!selectedChild) return null;
    const local = db.students.find((s) => s.id === selectedChild.id);
    if (local) return local;
    return {
      id: selectedChild.id,
      firstName: selectedChild.firstName,
      lastName: selectedChild.lastName,
      gender: (selectedChild.gender as "M" | "F") || "M",
      classId: selectedChild.classId ?? "",
      birthDate: selectedChild.birthDate ?? "",
      parentName: user?.name ?? "",
      parentPhone: "",
      parentEmail: user?.email ?? "",
      parentRelation: (selectedChild.relationship as any) ?? "Tuteur",
      code: selectedChild.code ?? undefined,
      photo: selectedChild.photo ?? undefined,
      status: "actif",
      enrolledAt: new Date().toISOString(),
    };
  }, [selectedChild, db.students, user]);

  const klass = student ? db.classes.find((c) => c.id === student.classId) : undefined;
  const initials = student ? (student.firstName[0] + student.lastName[0]).toUpperCase() : "?";

  return (
    <div className="min-h-screen bg-[#EEF2F8] pb-28 font-['Inter']">
      <header
        className="sticky top-0 z-20 text-white shadow-[0_8px_24px_-12px_rgba(13,44,84,0.4)]"
        style={{ background: "linear-gradient(160deg, #0D2C54 0%, #15366B 60%, #1B4080 100%)" }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pb-4 pt-4">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
              👋 Espace Parent
            </span>
            <p className="mt-1.5 truncate font-['Sora'] text-lg font-bold tracking-tight">
              Bonjour, {user?.name}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div className="hidden h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/15 sm:flex">
              <Logo compact />
            </div>
            <ParentNotificationBell />
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={() => { logout(); navigate({ to: "/login" }); }}
              aria-label="Déconnexion"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
        {hasMultiple && tab !== "tous" && (
          <ChildSelector
            children={children}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-5">
        {childrenLoading ? (
          <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground">Chargement…</CardContent></Card>
        ) : children.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Aucun enfant n'est associé à votre compte. Contactez l'école pour le lier.
            </CardContent>
          </Card>
        ) : tab === "tous" && hasMultiple ? (
          <CombinedView children={children} db={db} onPickChild={(id) => { setSelectedId(id); setTab("enfant"); }} />
        ) : student ? (
          <>
            {tab === "enfant" && <EnfantTab student={student} klass={klass} initials={initials} grades={db.grades} payments={db.payments} paymentRecords={db.paymentRecords} attendance={db.attendance} />}
            {tab === "notes" && <NotesTab studentId={student.id} grades={db.grades} classSubjects={db.classSubjects.filter((s) => s.classId === student.classId)} />}
            {tab === "presences" && <PresencesTab studentId={student.id} attendance={db.attendance} />}
            {tab === "paiements" && <PaiementsTab studentId={student.id} payments={db.payments} paymentRecords={db.paymentRecords} />}
            {tab === "medical" && <MedicalTab studentId={student.id} canEdit={false} />}
            {tab === "suivi" && <DisciplineTab studentId={student.id} schoolId={user?.schoolId} canAdd={false} readOnly />}
            {tab === "messages" && <MessagesTab announcements={db.announcements} classIds={children.map((c) => c.classId).filter((id): id is string => !!id)} userId={user?.id} schoolId={user?.schoolId} />}
            {tab === "calendrier" && <ParentCalendarTab />}
          </>
        ) : null}
        <div className="mx-auto mt-6 max-w-3xl px-4 pb-20 text-center text-xs text-muted-foreground">
          <a href="/confidentialite" target="_blank" rel="noreferrer" className="hover:text-foreground">Politique de confidentialité</a>
          <span className="mx-2">•</span>
          <span>Loi n°2024/017</span>
        </div>
      </main>


      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E8EDF4] bg-white shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid max-w-3xl" style={{ gridTemplateColumns: `repeat(${navItems.length + 1}, minmax(0, 1fr))` }}>
          {navItems.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-[#2563EB]" : "text-[#64748B] hover:text-[#0F172A]",
                )}
              >
                {active && <span className="absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-[#2563EB]" />}
                <t.icon className="h-5 w-5" />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
              moreActive ? "text-[#2563EB]" : "text-[#64748B] hover:text-[#0F172A]",
            )}
          >
            {moreActive && <span className="absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-[#2563EB]" />}
            <MoreHorizontal className="h-5 w-5" />
            <span className="truncate">Plus</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0">
          <SheetHeader className="border-b px-4 py-3 text-left">
            <SheetTitle>Plus d'options</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-1 gap-1 p-3">
            {MORE.map((item) => {
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => { setTab(item.key); setMoreOpen(false); }}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium hover:bg-accent/10",
                    active && "bg-accent/10 text-accent",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
      <InactivityGuard />
    </div>

  );
}

function ChildSelector({
  children, selectedId, onSelect,
}: {
  children: ParentChild[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  return (
    <div className="border-t border-border bg-muted/30 px-4 py-2">
      <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto">
        {children.map((c) => {
          const active = c.id === selectedId;
          const initials = (c.firstName[0] + c.lastName[0]).toUpperCase();
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {c.photo ? (
                <img src={c.photo} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-primary/20 text-primary">{initials}</AvatarFallback>
                </Avatar>
              )}
              <span className="font-medium">{c.firstName} {c.lastName}</span>
              {c.className && <Badge variant="outline" className="text-[10px]">{c.className}</Badge>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CombinedView({
  children, db, onPickChild,
}: {
  children: ParentChild[]; db: ReturnType<typeof useDB>; onPickChild: (id: string) => void;
}) {
  const month = new Date().toISOString().slice(0, 7);
  const rows = children.map((c) => {
    const grades = db.grades.filter((g) => g.studentId === c.id);
    const t1 = grades.filter((g) => g.term === "1er trimestre");
    const avg = t1.length ? Math.round((t1.reduce((s, g) => s + gradeValue(g), 0) / t1.length) * 100) / 100 : null;
    const due = db.payments.filter((p) => p.studentId === c.id).reduce((s, p) => s + Math.max(0, p.amount - paidFor(p, db.paymentRecords)), 0);
    const absences = db.attendance.filter((a) => a.studentId === c.id && a.date.startsWith(month) && a.status === "absent").length;
    return { child: c, avg, due, absences };
  });
  const totalDue = rows.reduce((s, r) => s + r.due, 0);
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <div>
            <p className="text-xs text-muted-foreground">Total frais impayés (tous enfants)</p>
            <p className={cn("text-2xl font-bold", totalDue > 0 ? "text-destructive" : "text-success")}>{fcfa(totalDue)}</p>
          </div>
          <Wallet className="h-8 w-8 text-muted-foreground" />
        </CardContent>
      </Card>
      <div className="space-y-3">
        {rows.map(({ child, avg, due, absences }) => {
          const initials = (child.firstName[0] + child.lastName[0]).toUpperCase();
          return (
            <Card key={child.id} className="cursor-pointer transition-colors hover:bg-muted/40" onClick={() => onPickChild(child.id)}>
              <CardContent className="flex items-center gap-3 pt-5">
                {child.photo ? (
                  <img src={child.photo} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/15 text-primary font-bold">{initials}</AvatarFallback>
                  </Avatar>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{child.firstName} {child.lastName}</p>
                    {child.className && <Badge variant="outline" className="text-[10px]">{child.className}</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Moyenne: <b className="text-foreground">{avg != null ? `${avg}/20` : "—"}</b></span>
                    <span>Absences: <b className="text-foreground">{absences}</b></span>
                    <span>Impayé: <b className={due > 0 ? "text-destructive" : "text-success"}>{fcfa(due)}</b></span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}



function EmptyState({ icon: Icon, message, tone = "muted" }: { icon: any; message: string; tone?: "muted" | "success" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full",
        tone === "success" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
      )}>
        <Icon className="h-6 w-6" />
      </div>
      <p className={cn("text-sm", tone === "success" ? "font-medium text-success" : "text-muted-foreground")}>{message}</p>
    </div>
  );
}

function EnfantTab({ student, klass, initials, grades, payments, paymentRecords, attendance }: {
  student: Student; klass: Classe | undefined; initials: string; grades: Grade[]; payments: Payment[]; paymentRecords: PaymentRecord[]; attendance: any[];
}) {
  const studentGrades = grades.filter((g) => g.studentId === student.id);
  const lastTerm = "1er trimestre";
  const termGrades = studentGrades.filter((g) => g.term === lastTerm);
  const moy = termGrades.length
    ? Math.round((termGrades.reduce((s, g) => s + gradeValue(g), 0) / termGrades.length) * 100) / 100
    : null;

  const month = new Date().toISOString().slice(0, 7);
  const absencesMois = attendance.filter((a) => a.studentId === student.id && a.date.startsWith(month) && a.status === "absent").length;

  const studentInvoices = payments.filter((p) => p.studentId === student.id);
  const due = studentInvoices.reduce((s, p) => s + Math.max(0, p.amount - paidFor(p, paymentRecords)), 0);

  const recent = [...studentGrades]
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, 4);

  return (
    <div className="space-y-4">
      {/* Child card */}
      <div className="relative overflow-hidden rounded-[22px] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-12px_rgba(15,23,42,0.12)]">
        <div className="h-16 bg-gradient-to-r from-[#2563EB]/15 via-[#7C5CFC]/15 to-[#0E9384]/15" />
        <div className="flex flex-col items-center px-5 pb-5 text-center">
          <div className="-mt-10 mb-3 rounded-full bg-white p-1.5 shadow-md ring-1 ring-[#E8EDF4]">
            {student.photo ? (
              <img src={student.photo} alt="" className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-gradient-to-br from-[#2563EB] to-[#7C5CFC] text-xl font-bold text-white">{initials}</AvatarFallback>
              </Avatar>
            )}
          </div>
          <h2 className="font-['Sora'] text-xl font-bold tracking-tight text-[#0F172A]">
            {student.firstName} {student.lastName}
          </h2>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            <span className="rounded-full bg-[#2563EB]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#2563EB]">
              {klass?.name ?? "—"}
            </span>
            {student.code && (
              <span className="rounded-full bg-[#EEF2F8] px-2.5 py-0.5 text-[11px] font-medium text-[#64748B]">
                {student.code}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2x2 stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Moyenne générale" value={moy != null ? `${moy}/20` : "—"} icon={GraduationCap} iconBg="#2563EB" />
        <SummaryCard label="Absences ce mois" value={String(absencesMois)} icon={Calendar} iconBg="#F58B1F" />
        <SummaryCard label="Frais impayés" value={fcfa(due)} icon={Wallet} iconBg={due > 0 ? "#E11D48" : "#15A05A"} />
        <SummaryCard label="Prochain cours" value="Lun. 08h00" icon={Bell} iconBg="#7C5CFC" />
      </div>

      {/* Dernières notes */}
      <div className="rounded-[18px] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.1)]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-['Sora'] text-base font-semibold text-[#0F172A]">Dernières notes</h3>
          <span className="text-[11px] font-medium text-[#64748B]">{recent.length} récente{recent.length > 1 ? "s" : ""}</span>
        </div>
        {recent.length === 0 ? (
          <EmptyState icon={Inbox} message="Aucune note enregistrée" />
        ) : (
          <ul className="space-y-2.5">
            {recent.map((g) => {
              const v = gradeValue(g);
              const gradeColor =
                v >= 14 ? { bg: "#15A05A", soft: "rgba(21,160,90,0.12)" } :
                v >= 10 ? { bg: "#2563EB", soft: "rgba(37,99,235,0.12)" } :
                { bg: "#F58B1F", soft: "rgba(245,139,31,0.14)" };
              const subjColor = subjectColor(g.subject);
              return (
                <li key={g.id} className="flex items-center gap-3 rounded-xl border border-[#EEF2F8] px-3 py-2.5">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold uppercase text-white"
                    style={{ background: subjColor }}
                  >
                    {g.subject.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#0F172A]">{g.subject}</p>
                    <p className="truncate text-[11px] text-[#64748B]">{g.evaluationType ?? "—"} · {g.term}</p>
                  </div>
                  <span
                    className="shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums"
                    style={{ background: gradeColor.soft, color: gradeColor.bg }}
                  >
                    {v}/20
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

const SUBJECT_PALETTE = ["#2563EB", "#15A05A", "#F58B1F", "#7C5CFC", "#0E9384", "#E11D48", "#0D2C54"];
function subjectColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return SUBJECT_PALETTE[h % SUBJECT_PALETTE.length];
}

function SummaryCard({ label, value, icon: Icon, iconBg }: { label: string; value: string; icon: any; iconBg: string }) {
  return (
    <div className="rounded-[18px] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.1)]">
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-white"
        style={{ background: iconBg }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-[11px] font-medium text-[#64748B]">{label}</p>
      <p className="mt-0.5 truncate font-['Sora'] text-lg font-bold tracking-tight text-[#0F172A]">{value}</p>
    </div>
  );
}

function NotesTab({ studentId, grades, classSubjects }: { studentId: string; grades: Grade[]; classSubjects: any[] }) {
  const [term, setTerm] = useState("1er trimestre");
  const termGrades = grades.filter((g) => g.studentId === studentId && g.term === term);

  if (termGrades.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Tabs value={term} onValueChange={setTerm}>
            <TabsList>
              <TabsTrigger value="1er trimestre">T1</TabsTrigger>
              <TabsTrigger value="2e trimestre">T2</TabsTrigger>
              <TabsTrigger value="3e trimestre">T3</TabsTrigger>
            </TabsList>
          </Tabs>
          <EmptyState icon={BookOpen} message="Les notes ne sont pas encore disponibles pour ce trimestre" />
        </CardContent>
      </Card>
    );
  }

  const bySubject = classSubjects.map((subj) => {
    const list = termGrades.filter((g) => g.subject === subj.name);
    const avg = list.length ? Math.round((list.reduce((s, g) => s + gradeValue(g), 0) / list.length) * 100) / 100 : null;
    return { name: subj.name, coefficient: subj.coefficient, avg };
  });

  const totalWeighted = bySubject.reduce((s, r) => s + (r.avg ?? 0) * r.coefficient, 0);
  const totalCoef = bySubject.filter((r) => r.avg != null).reduce((s, r) => s + r.coefficient, 0);
  const general = totalCoef ? Math.round((totalWeighted / totalCoef) * 100) / 100 : 0;

  return (
    <Tabs value={term} onValueChange={setTerm}>
      <TabsList>
        <TabsTrigger value="1er trimestre">T1</TabsTrigger>
        <TabsTrigger value="2e trimestre">T2</TabsTrigger>
        <TabsTrigger value="3e trimestre">T3</TabsTrigger>
      </TabsList>
      <TabsContent value={term} className="mt-3">
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matière</TableHead>
                  <TableHead className="text-center">Coef.</TableHead>
                  <TableHead className="text-right">Moyenne</TableHead>
                  <TableHead>Appréciation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bySubject.map((r) => {
                  const app = r.avg != null ? appreciationFor(r.avg) : null;
                  return (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-center">{r.coefficient}</TableCell>
                      <TableCell className="text-right">{r.avg != null ? `${r.avg}/20` : "—"}</TableCell>
                      <TableCell>{app && <Badge className={app.cls}>{app.label}</Badge>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="mt-4 flex items-center justify-between rounded-lg bg-primary/10 px-4 py-3">
              <span className="text-sm font-semibold text-primary">Moyenne générale</span>
              <span className="text-lg font-bold text-primary">{general}/20</span>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function PresencesTab({ studentId, attendance }: { studentId: string; attendance: any[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStr = now.toISOString().slice(0, 7);
  const records = attendance.filter((a) => a.studentId === studentId && a.date.startsWith(monthStr));
  const recMap = new Map(records.map((r) => [r.date, r.status]));
  const absences = records.filter((r) => r.status === "absent").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base capitalize">
          {now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
            <div key={i} className="py-1 font-semibold text-muted-foreground">{d}</div>
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const status = recMap.get(date);
            const cls =
              status === "present" ? "bg-success/20 text-success" :
              status === "absent" ? "bg-destructive/20 text-destructive" :
              status === "retard" ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground";
            return (
              <div key={day} className={cn("aspect-square rounded-md p-1 text-sm font-medium", cls)}>
                {day}
              </div>
            );
          })}
        </div>
        {records.length === 0 ? (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-success/10 px-4 py-3 text-success">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Aucune absence enregistrée ce mois-ci</span>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-destructive/5 px-4 py-3">
            <span className="text-sm">Absences ce mois</span>
            <Badge variant="destructive">{absences}</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PaiementsTab({ studentId, payments, paymentRecords }: { studentId: string; payments: Payment[]; paymentRecords: PaymentRecord[] }) {
  const list = payments.filter((p) => p.studentId === studentId);
  const due = list.reduce((s, p) => s + Math.max(0, p.amount - paidFor(p, paymentRecords)), 0);

  if (list.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState icon={CheckCircle2} message="Aucune facture en attente" tone="success" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <span className="text-sm font-medium">Total impayé</span>
          <span className={cn("text-xl font-bold", due > 0 ? "text-destructive" : "text-success")}>{fcfa(due)}</span>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Facture</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((p) => {
                const st = deriveInvoiceStatus(p.amount, paidFor(p, paymentRecords), p.dueDate);
                const variant = st === "paye" ? "default" : st === "partiel" ? "secondary" : "destructive";
                const label = st === "paye" ? "Payée" : st === "partiel" ? "Partiel" : st === "retard" ? "En retard" : "En attente";
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.invoiceNumber}</TableCell>
                    <TableCell className="text-sm">{p.type}</TableCell>
                    <TableCell className="text-right text-sm">{fcfa(p.amount)}</TableCell>
                    <TableCell><Badge variant={variant as any}>{label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MessagesTab({ announcements, classIds, userId, schoolId }: { announcements: import("@/lib/types").Announcement[]; classIds: string[]; userId?: string; schoolId?: string }) {
  const classSet = new Set(classIds);
  const visible = announcements
    .filter((a) => {
      if (a.audience === "Tous" || a.audience === "Parents") return true;
      if (a.audience === "Classe" && a.targetClassId && classSet.has(a.targetClassId)) return true;
      return false;
    })
    .sort((a, b) => {
      const pa = a.pinned ? 1 : 0;
      const pb = b.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return b.createdAt.localeCompare(a.createdAt);
    });
  useEffect(() => {
    if (!userId || !schoolId) return;
    import("@/lib/announcement-reads").then(({ markAnnouncementRead }) => {
      visible.forEach((a) => { markAnnouncementRead(a.id, schoolId, userId); });
    });
  }, [visible, userId, schoolId]);
  if (visible.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState icon={MessageSquare} message="Aucun message de l'école pour le moment" />
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {visible.map((a) => (
        <Card key={a.id} className={a.pinned ? "border-accent/60 bg-accent/5" : undefined}>
          <CardContent className="pt-5">
            <div className="mb-1 flex items-start justify-between gap-2">
              <p className="text-sm font-semibold">
                {a.pinned && <span className="mr-1 text-accent">📌</span>}
                {a.title}
              </p>
              <Badge variant="outline" className="text-[10px]">{a.audience === "Classe" ? "Classe" : a.audience}</Badge>
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">
              {new Date(a.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            <p className="whitespace-pre-wrap text-sm">{a.content}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ParentNotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, remove } = useNotifications();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        aria-label="Notifications"
        onClick={() => setOpen(true)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>
      <ParentNotificationsSheet
        open={open}
        onOpenChange={setOpen}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkRead={markAsRead}
        onMarkAllRead={markAllAsRead}
        onRemove={remove}
      />
    </>
  );
}

function ParentNotificationsSheet({
  open, onOpenChange, notifications, unreadCount, onMarkRead, onMarkAllRead, onRemove,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  notifications: ReturnType<typeof useNotifications>["notifications"];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md p-0 sm:max-w-md">
        <SheetHeader className="flex flex-row items-center justify-between border-b px-4 py-3 text-left">
          <SheetTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</SheetTitle>
          {unreadCount > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onMarkAllRead}>
              <CheckCircle2 className="mr-1 h-3 w-3" /> Tout marquer
            </Button>
          )}
        </SheetHeader>
        <div className="max-h-[calc(100vh-56px)] overflow-y-auto">
          {notifications.length === 0 && (
            <div className="px-4 py-16 text-center text-sm text-muted-foreground">
              <Inbox className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Aucune notification
            </div>
          )}
          {notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-3 border-b border-border px-4 py-3 cursor-pointer hover:bg-muted/40",
                !n.read && "bg-primary/5",
              )}
              onClick={() => { if (!n.read) onMarkRead(n.id); }}
            >
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</span>
                  {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </div>
                <p className="text-xs text-muted-foreground">{n.message}</p>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <Button
                variant="ghost" size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onRemove(n.id); }}
                aria-label="Supprimer"
              >
                <LogOut className="h-3.5 w-3.5 rotate-180" />
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

type ParentEvent = {
  id: string;
  title: string;
  description: string | null;
  type: "vacances" | "examen" | "reunion" | "evenement" | "sortie" | "ferie";
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  target: string;
};

const PARENT_TYPE_META: Record<ParentEvent["type"], { label: string; bg: string; text: string; dot: string }> = {
  vacances:  { label: "Vacances",   bg: "bg-emerald-100", text: "text-emerald-900", dot: "bg-emerald-500" },
  examen:    { label: "Examen",     bg: "bg-red-100",     text: "text-red-900",     dot: "bg-red-500" },
  reunion:   { label: "Réunion",    bg: "bg-blue-100",    text: "text-blue-900",    dot: "bg-blue-500" },
  evenement: { label: "Événement",  bg: "bg-orange-100",  text: "text-orange-900",  dot: "bg-orange-500" },
  sortie:    { label: "Sortie",     bg: "bg-purple-100",  text: "text-purple-900",  dot: "bg-purple-500" },
  ferie:     { label: "Jour férié", bg: "bg-gray-200",    text: "text-gray-800",    dot: "bg-gray-500" },
};

function parentFmtISO(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parentFmtFr(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}/${y}`;
}

function ParentCalendarTab() {
  const [events, setEvents] = useState<ParentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("id,title,description,type,start_date,end_date,start_time,end_time,location,target")
        .order("start_date", { ascending: true });
      if (cancelled) return;
      if (!error) setEvents((data ?? []) as ParentEvent[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  const grid = useMemo(() => {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const first = new Date(y, m, 1);
    const firstWeekday = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: { date: Date | null; iso: string | null }[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ date: null, iso: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(y, m, d);
      cells.push({ date: dt, iso: parentFmtISO(dt) });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, iso: null });
    return cells;
  }, [cursor]);

  const todayIso = parentFmtISO(new Date());
  const daysEvents = (iso: string) =>
    events.filter((e) => iso >= e.start_date && iso <= (e.end_date ?? e.start_date));

  const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const DAYS = ["L","M","M","J","V","S","D"];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3">
          <div className="mb-3 flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() - 1); setCursor(d); }} aria-label="Mois précédent">‹</Button>
            <div className="text-sm font-semibold">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</div>
            <Button variant="outline" size="icon" onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() + 1); setCursor(d); }} aria-label="Mois suivant">›</Button>
          </div>
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : (
            <>
              <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
                {DAYS.map((d, i) => <div key={i} className="py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {grid.map((cell, i) => {
                  if (!cell.iso || !cell.date) return <div key={i} className="min-h-[56px] rounded-md bg-muted/30" />;
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
                        "flex min-h-[56px] min-w-0 flex-col overflow-hidden rounded-md border p-1 text-left transition hover:bg-accent/30",
                        isToday && "border-primary",
                        isSelected && "ring-2 ring-primary",
                      )}
                    >
                      <span className={cn("text-[10px] font-semibold leading-none", isToday && "text-primary")}>{cell.date.getDate()}</span>
                      <div className="mt-1 flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
                        {visibleEvs.map((ev) => {
                          const meta = PARENT_TYPE_META[ev.type];
                          return (
                            <span
                              key={ev.id}
                              className={cn("block h-3.5 w-full min-w-0 truncate rounded px-1 text-[9px] font-medium leading-[14px]", meta.bg, meta.text)}
                              title={ev.title}
                            >
                              {ev.title}
                            </span>
                          );
                        })}
                        {extra > 0 && (
                          <span className="block h-3.5 w-full truncate rounded bg-muted px-1 text-[9px] font-medium leading-[14px] text-muted-foreground">
                            +{extra}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selectedDay && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">{parentFmtFr(selectedDay)}</h3>
              <button onClick={() => setSelectedDay(null)} className="text-xs text-muted-foreground hover:underline">Fermer</button>
            </div>
            {daysEvents(selectedDay).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun événement ce jour.</p>
            ) : (
              <div className="space-y-2">
                {daysEvents(selectedDay).map((ev) => {
                  const meta = PARENT_TYPE_META[ev.type];
                  return (
                    <div key={ev.id} className={cn("rounded-md border-l-4 p-3", meta.bg)}>
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
                        <span className={cn("text-sm font-semibold", meta.text)}>{ev.title}</span>
                        <Badge variant="outline" className="ml-auto text-[10px]">{meta.label}</Badge>
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {parentFmtFr(ev.start_date)}
                        {ev.end_date && ev.end_date !== ev.start_date && ` → ${parentFmtFr(ev.end_date)}`}
                        {ev.start_time && ` · ${ev.start_time}${ev.end_time ? `–${ev.end_time}` : ""}`}
                        {ev.location && ` · ${ev.location}`}
                      </div>
                      {ev.description && (
                        <p className="mt-2 whitespace-pre-wrap text-sm">{ev.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Légende</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {(Object.keys(PARENT_TYPE_META) as ParentEvent["type"][]).map((t) => (
              <div key={t} className="flex items-center gap-2">
                <span className={cn("h-3 w-3 rounded-full", PARENT_TYPE_META[t].dot)} />
                <span>{PARENT_TYPE_META[t].label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

