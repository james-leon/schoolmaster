import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Users, BookOpen, FileText, UserCheck } from "lucide-react";
import { useDB } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { resolveTeacherClassIds } from "@/lib/teacher-scope";
import { cn } from "@/lib/utils";

type Result = {
  id: string;
  type: "student" | "class" | "invoice" | "parent";
  label: string;
  sublabel?: string;
  onSelect: () => void;
};

const MAX_PER_GROUP = 5;

export function GlobalSearch() {
  const db = useDB();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isTeacher = user?.role === "teacher";
  const isParent = user?.role === "parent";

  // Keyboard shortcut Cmd/Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close on click outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const results = useMemo<Result[]>(() => {
    const query = q.trim().toLowerCase();
    if (!query || query.length < 1 || isParent) return [];

    const classIds = isTeacher ? new Set(resolveTeacherClassIds(user, db)) : null;
    const classMap = new Map(db.classes.map((c) => [c.id, c]));

    const match = (s: string | undefined | null) =>
      (s ?? "").toLowerCase().includes(query);

    // Students
    const students: Result[] = db.students
      .filter((s) => !classIds || classIds.has(s.classId))
      .filter(
        (s) =>
          match(s.firstName) ||
          match(s.lastName) ||
          match(`${s.firstName} ${s.lastName}`) ||
          match(s.code) ||
          match(s.parentName) ||
          match(s.parentPhone),
      )
      .slice(0, MAX_PER_GROUP)
      .map((s) => ({
        id: `student-${s.id}`,
        type: "student" as const,
        label: `${s.firstName} ${s.lastName}`,
        sublabel: `${s.code ? s.code + " • " : ""}${classMap.get(s.classId)?.name ?? "—"}`,
        onSelect: () => navigate({ to: "/eleves/$studentId", params: { studentId: s.id } }),
      }));

    // Classes
    const classes: Result[] = db.classes
      .filter((c) => !classIds || classIds.has(c.id))
      .filter((c) => match(c.name) || match(c.level))
      .slice(0, MAX_PER_GROUP)
      .map((c) => ({
        id: `class-${c.id}`,
        type: "class" as const,
        label: c.name,
        sublabel: `Niveau ${c.level}`,
        onSelect: () => navigate({ to: "/classes" }),
      }));

    // Invoices (admin only)
    const invoices: Result[] = isTeacher
      ? []
      : db.payments
          .filter(
            (p) =>
              match(p.invoiceNumber) ||
              match(p.type) ||
              (() => {
                const s = db.students.find((x) => x.id === p.studentId);
                return s ? match(`${s.firstName} ${s.lastName}`) : false;
              })(),
          )
          .slice(0, MAX_PER_GROUP)
          .map((p) => {
            const s = db.students.find((x) => x.id === p.studentId);
            return {
              id: `invoice-${p.id}`,
              type: "invoice" as const,
              label: p.invoiceNumber || "Facture",
              sublabel: `${s ? s.firstName + " " + s.lastName : "—"} • ${p.type}`,
              onSelect: () => navigate({ to: "/scolarite" }),
            };
          });

    // Parents (admin only)
    const parents: Result[] = isTeacher
      ? []
      : db.parents
          .filter(
            (p) =>
              match(p.firstName) ||
              match(p.lastName) ||
              match(`${p.firstName} ${p.lastName}`) ||
              match(p.phone) ||
              match(p.email),
          )
          .slice(0, MAX_PER_GROUP)
          .map((p) => ({
            id: `parent-${p.id}`,
            type: "parent" as const,
            label: `${p.firstName} ${p.lastName}`,
            sublabel: p.phone || p.email || "—",
            onSelect: () => navigate({ to: "/parents" }),
          }));

    return [...students, ...classes, ...invoices, ...parents];
  }, [q, db, user, isTeacher, isParent, navigate]);

  useEffect(() => {
    setActiveIdx(0);
  }, [q]);

  const runSelect = (r: Result) => {
    r.onSelect();
    setOpen(false);
    setQ("");
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[activeIdx];
      if (r) runSelect(r);
    }
  };

  const iconFor = (type: Result["type"]) => {
    if (type === "student") return Users;
    if (type === "class") return BookOpen;
    if (type === "invoice") return FileText;
    return UserCheck;
  };

  const groupLabel = (type: Result["type"]) =>
    type === "student"
      ? "Élèves"
      : type === "class"
        ? "Classes"
        : type === "invoice"
          ? "Factures"
          : "Parents";

  // Group for display
  const grouped = useMemo(() => {
    const g = new Map<Result["type"], Result[]>();
    results.forEach((r) => {
      const arr = g.get(r.type) ?? [];
      arr.push(r);
      g.set(r.type, arr);
    });
    return g;
  }, [results]);

  if (isParent) return null;

  return (
    <div ref={containerRef} className="relative hidden md:block md:w-[320px] lg:w-[380px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
      <input
        ref={inputRef}
        type="text"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Rechercher un élève, une facture..."
        className="h-10 w-full rounded-xl border border-[#E8EDF4] bg-[#F7F9FC] pl-9 pr-14 text-sm text-[#0F172A] outline-none transition focus:border-[#2563EB] focus:bg-card focus:ring-2 focus:ring-[#2563EB]/15"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline-flex">
        ⌘K
      </kbd>

      {open && q.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-12 z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              Aucun résultat pour « {q} »
            </div>
          ) : (
            Array.from(grouped.entries()).map(([type, items]) => (
              <div key={type} className="py-1">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {groupLabel(type)}
                </div>
                {items.map((r) => {
                  const Icon = iconFor(r.type);
                  const globalIdx = results.indexOf(r);
                  const active = globalIdx === activeIdx;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onMouseEnter={() => setActiveIdx(globalIdx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        runSelect(r);
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left text-sm transition",
                        active ? "bg-accent/10" : "hover:bg-muted",
                      )}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-foreground">{r.label}</div>
                        {r.sublabel && (
                          <div className="truncate text-xs text-muted-foreground">{r.sublabel}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
