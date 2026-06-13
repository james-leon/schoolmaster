import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDB } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fcfa } from "@/lib/format";
import { gradeValue, appreciationFor, deriveInvoiceStatus, type Grade, type Payment, type Student, type Classe } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { useParentChildren, type ParentChild } from "@/lib/useParentChildren";
import { useNotifications } from "@/lib/notifications";
import {
  Bell, Calendar, GraduationCap, UserCircle, LogOut, Wallet, MessageSquare,
  CheckCircle2, Inbox, BookOpen, Users2, HeartPulse, ShieldAlert,
} from "lucide-react";
import { MedicalTab } from "@/components/MedicalTab";
import { DisciplineTab } from "@/components/DisciplineTab";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/parent")({
  component: ParentPortal,
});

type TabKey = "tous" | "enfant" | "notes" | "presences" | "paiements" | "medical" | "suivi" | "messages";

function ParentPortal() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const db = useDB();
  const { children, loading: childrenLoading, selectedId, setSelectedId, selectedChild } = useParentChildren();
  const [tab, setTab] = useState<TabKey>("enfant");

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !user) { navigate({ to: "/login", replace: true }); return; }
    if (user.mustChangePassword) { navigate({ to: "/changer-mot-de-passe", replace: true }); return; }
    if (user.role !== "parent") navigate({ to: "/dashboard", replace: true });
  }, [user, loading, isAuthenticated, navigate]);

  const hasMultiple = children.length > 1;

  const TABS: { key: TabKey; label: string; icon: typeof UserCircle }[] = [
    ...(hasMultiple ? [{ key: "tous" as TabKey, label: "Tous", icon: Users2 }] : []),
    { key: "enfant", label: "Enfant", icon: UserCircle },
    { key: "notes", label: "Notes", icon: GraduationCap },
    { key: "presences", label: "Présences", icon: Calendar },
    { key: "paiements", label: "Paiements", icon: Wallet },
    { key: "medical", label: "Médical", icon: HeartPulse },
    { key: "suivi", label: "Suivi", icon: ShieldAlert },
    { key: "messages", label: "Messages", icon: MessageSquare },
  ];

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
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Logo compact />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-success text-success-foreground">Parent</Badge>
              </div>
              <p className="text-sm font-medium">Bienvenue, {user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ParentNotificationBell />
            <Button variant="ghost" size="icon" onClick={() => { logout(); navigate({ to: "/login" }); }} aria-label="Déconnexion">
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
            {tab === "enfant" && <EnfantTab student={student} klass={klass} initials={initials} grades={db.grades} payments={db.payments} attendance={db.attendance} />}
            {tab === "notes" && <NotesTab studentId={student.id} grades={db.grades} classSubjects={db.classSubjects.filter((s) => s.classId === student.classId)} />}
            {tab === "presences" && <PresencesTab studentId={student.id} attendance={db.attendance} />}
            {tab === "paiements" && <PaiementsTab studentId={student.id} payments={db.payments} />}
            {tab === "medical" && <MedicalTab studentId={student.id} canEdit={false} />}
            {tab === "suivi" && <DisciplineTab studentId={student.id} schoolId={user?.schoolId} canAdd={false} readOnly />}
            {tab === "messages" && <MessagesTab announcements={db.announcements} classIds={children.map((c) => c.classId).filter((id): id is string => !!id)} userId={user?.id} schoolId={user?.schoolId} />}
          </>
        ) : null}
        <div className="mx-auto mt-6 max-w-3xl px-4 pb-20 text-center text-xs text-muted-foreground">
          <a href="/confidentialite" target="_blank" rel="noreferrer" className="hover:text-foreground">Politique de confidentialité</a>
          <span className="mx-2">•</span>
          <span>Loi n°2024/017</span>
        </div>
      </main>


      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card">
        <div className={cn("mx-auto grid max-w-3xl", `grid-cols-${TABS.length}`)} style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground transition-colors",
                  active && "text-primary",
                )}
              >
                <t.icon className="h-5 w-5" />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
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
    const due = db.payments.filter((p) => p.studentId === c.id).reduce((s, p) => s + Math.max(0, p.amount - p.amountPaid), 0);
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

function EnfantTab({ student, klass, initials, grades, payments, attendance }: {
  student: Student; klass: Classe | undefined; initials: string; grades: Grade[]; payments: Payment[]; attendance: any[];
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
  const due = studentInvoices.reduce((s, p) => s + Math.max(0, p.amount - p.amountPaid), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          {student.photo ? (
            <img src={student.photo} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">{initials}</AvatarFallback>
            </Avatar>
          )}
          <div>
            <h2 className="text-xl font-bold">{student.firstName} {student.lastName}</h2>
            <div className="mt-1 flex items-center justify-center gap-2">
              <Badge variant="outline">{klass?.name ?? "—"}</Badge>
              <span className="text-xs text-muted-foreground">{student.code ?? "—"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Moyenne générale" value={moy != null ? `${moy}/20` : "—"} icon={GraduationCap} tone="bg-secondary/10 text-secondary" />
        <SummaryCard label="Absences ce mois" value={String(absencesMois)} icon={Calendar} tone="bg-accent/10 text-accent" />
        <SummaryCard
          label="Frais impayés"
          value={fcfa(due)}
          icon={Wallet}
          tone={due > 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}
        />
        <SummaryCard label="Prochain cours" value="Lundi 08h00" icon={Bell} tone="bg-primary/10 text-primary" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Activité récente</CardTitle></CardHeader>
        <CardContent>
          {studentGrades.length === 0 ? (
            <EmptyState icon={Inbox} message="Aucune activité récente" />
          ) : (
            <div className="space-y-3">
              {studentGrades.slice(0, 3).map((g) => (
                <div key={g.id} className="flex items-center justify-between text-sm">
                  <span>{g.subject} — {g.term}</span>
                  <Badge variant="secondary">{gradeValue(g)}/20</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }: any) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-4">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
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

function PaiementsTab({ studentId, payments }: { studentId: string; payments: Payment[] }) {
  const list = payments.filter((p) => p.studentId === studentId);
  const due = list.reduce((s, p) => s + Math.max(0, p.amount - p.amountPaid), 0);

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
                const st = deriveInvoiceStatus(p.amount, p.amountPaid, p.dueDate);
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


