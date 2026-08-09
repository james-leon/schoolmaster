/**
 * Admin-only viewer for the audit_logs table.
 * - Filter by user, action type, date range
 * - Paginated (server-side offset)
 * - Read-only (the table has no UPDATE/DELETE policy)
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUDIT_ACTION_LABELS, labelForAction } from "@/lib/audit";
import { ScrollText, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { EmptyStateBlock } from "@/components/states";

interface AuditRow {
  id: string;
  school_id: string;
  user_id: string | null;
  user_name: string;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

interface UserOption {
  id: string;
  full_name: string | null;
  email: string | null;
}

const PAGE_SIZE = 50;

export function AuditLogPanel({ schoolId }: { schoolId?: string }) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  const [userFilter, setUserFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [users, setUsers] = useState<UserOption[]>([]);

  // Load school users once for the filter dropdown.
  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("school_id", schoolId)
        .order("full_name", { ascending: true });
      setUsers((data ?? []) as UserOption[]);
    })();
  }, [schoolId]);

  const load = useMemo(
    () => async (targetPage: number) => {
      if (!schoolId) return;
      setLoading(true);
      try {
        let q = supabase
          .from("audit_logs" as any)
          .select("*", { count: "exact" })
          .eq("school_id", schoolId)
          .order("created_at", { ascending: false });

        if (userFilter !== "all") q = q.eq("user_id", userFilter);
        if (actionFilter !== "all") q = q.eq("action_type", actionFilter);
        if (from) q = q.gte("created_at", new Date(from + "T00:00:00").toISOString());
        if (to) q = q.lte("created_at", new Date(to + "T23:59:59").toISOString());

        const start = targetPage * PAGE_SIZE;
        q = q.range(start, start + PAGE_SIZE - 1);

        const { data, error, count } = await q;
        if (error) {
          toast.error("Impossible de charger le journal");
          setRows([]); setTotal(0);
        } else {
          setRows((data ?? []) as unknown as AuditRow[]);
          setTotal(count ?? 0);
          setPage(targetPage);
        }
      } finally {
        setLoading(false);
      }
    },
    [schoolId, userFilter, actionFilter, from, to],
  );

  useEffect(() => { void load(0); }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollText className="h-4 w-4" /> Journal d'activité
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => void load(page)} disabled={loading}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <Label className="mb-1.5 block text-xs">Utilisateur</Label>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name ?? u.email ?? u.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs">Action</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Toutes</SelectItem>
                {Object.entries(AUDIT_ACTION_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs">Du</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Au</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Date / Heure</th>
                <th className="px-3 py-2 font-medium">Utilisateur</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Cible</th>
                <th className="px-3 py-2 font-medium">Détails</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Chargement…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="p-0"><EmptyStateBlock titleKey="emptyAudit" className="border-0" /></td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {formatDate(r.created_at)}
                  </td>
                  <td className="px-3 py-2 font-medium">{r.user_name || "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className="font-normal">
                      {labelForAction(r.action_type)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.target_type ? (
                      <>
                        <span>{r.target_type}</span>
                        {r.target_id && (
                          <>
                            {" · "}
                            <code className="rounded bg-muted px-1 py-0.5">{r.target_id.slice(0, 8)}</code>
                          </>
                        )}
                      </>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <DetailsCell details={r.details} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {total.toLocaleString("fr-FR")} entrée{total > 1 ? "s" : ""} · page {page + 1} / {pageCount}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page === 0 || loading}
              onClick={() => void load(page - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" disabled={page + 1 >= pageCount || loading}
              onClick={() => void load(page + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Ce journal est en lecture seule et ne peut être ni modifié ni supprimé.
        </p>
      </CardContent>
    </Card>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function DetailsCell({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
      {entries.slice(0, 6).map(([k, v]) => (
        <span key={k}>
          <span className="text-muted-foreground">{k}:</span>{" "}
          <span className="font-medium">{formatValue(v)}</span>
        </span>
      ))}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  try { return JSON.stringify(v); } catch { return "…"; }
}
