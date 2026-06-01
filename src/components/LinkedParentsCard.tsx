import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Trash2, UserPlus, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { PARENT_RELATIONS, type ParentRelation } from "@/lib/types";

interface LinkRow {
  id: string;
  parent_profile_id: string;
  relationship: string;
  profile: { id: string; full_name: string; email: string; phone: string | null } | null;
}

export function LinkedParentsCard({ studentId }: { studentId: string }) {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listStudentParents(studentId);
      setLinks(res.links as LinkRow[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const unlink = async (parentProfileId: string) => {
    if (!confirm("Délier ce parent de l'élève ?")) return;
    try {
      await adminApi.unlinkParentStudent({ parentProfileId, studentId });
      toast.success("Parent délié");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Comptes parents liés</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <Link2 className="mr-1.5 h-3.5 w-3.5" /> Lier un parent existant
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun compte parent lié. Créez un compte depuis la liste des élèves ou liez un parent existant (frères/sœurs).
          </p>
        ) : (
          links.map((l) => (
            <div key={l.id} className="flex items-start justify-between gap-2 rounded-md border border-border p-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{l.profile?.full_name ?? "—"}</span>
                  <Badge variant="outline" className="text-[10px]">{l.relationship}</Badge>
                </div>
                {l.profile?.email && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />{l.profile.email}
                  </p>
                )}
                {l.profile?.phone && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />{l.profile.phone}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => unlink(l.parent_profile_id)} aria-label="Délier">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
      <LinkExistingParentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        studentId={studentId}
        excludeIds={links.map((l) => l.parent_profile_id)}
        onLinked={() => { setDialogOpen(false); load(); }}
      />
    </Card>
  );
}

function LinkExistingParentDialog({
  open, onClose, studentId, excludeIds, onLinked,
}: {
  open: boolean; onClose: () => void; studentId: string;
  excludeIds: string[]; onLinked: () => void;
}) {
  const [parents, setParents] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [rel, setRel] = useState<ParentRelation>("Père");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(null); setSearch("");
    adminApi.listSchoolParents()
      .then((r) => setParents(r.parents))
      .catch((e) => toast.error((e as Error).message));
  }, [open]);

  const filtered = parents
    .filter((p) => !excludeIds.includes(p.id))
    .filter((p) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (p.full_name ?? "").toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q);
    });

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await adminApi.linkParentStudent({ parentProfileId: selected, studentId, relationship: rel });
      toast.success("Parent lié à l'élève");
      onLinked();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lier un compte parent existant</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Rechercher</Label>
            <Input placeholder="Nom ou email…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="rounded-md border border-border max-h-64 overflow-auto divide-y">
            {filtered.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Aucun parent disponible.</p>
            ) : filtered.map((p) => (
              <label key={p.id} className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-muted/50">
                <input type="radio" name="parent" checked={selected === p.id} onChange={() => setSelected(p.id)} />
                <div className="min-w-0">
                  <div className="font-medium">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Relation</Label>
            <Select value={rel} onValueChange={(v) => setRel(v as ParentRelation)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PARENT_RELATIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Annuler</Button>
          <Button onClick={submit} disabled={!selected || submitting}>
            <UserPlus className="mr-1.5 h-4 w-4" />{submitting ? "Liaison…" : "Lier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
