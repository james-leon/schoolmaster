import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useDB, updateDB } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useSchoolParentAccounts } from "@/lib/useSchoolParentAccounts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Eye, Pencil, KeyRound, Trash2, CheckCircle2, Mail, Phone, X, UserPlus } from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { CredentialsModal, type CredentialsInfo } from "@/components/CredentialsModal";
import { PARENT_RELATIONS, type ParentRelation } from "@/lib/types";
import { toast } from "sonner";

export type ParentGroup = {
  key: string;
  firstName: string;
  lastName: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  profession?: string;
  relationship?: ParentRelation;
  studentIds: string[];
  parentRowIds: string[]; // local db.parents row ids matching this group
};

export function ParentsListView() {
  const db = useDB();
  const { user } = useAuth();
  const school = db.schools.find((s) => s.id === user?.schoolId);
  const { accounts, accountFor, refresh } = useSchoolParentAccounts();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<ParentGroup | null>(null);
  const [editing, setEditing] = useState<ParentGroup | null>(null);
  const [confirmDel, setConfirmDel] = useState<ParentGroup | null>(null);
  const [credentials, setCredentials] = useState<CredentialsInfo | null>(null);

  const groups = useMemo<ParentGroup[]>(() => {
    const m = new Map<string, ParentGroup>();
    for (const p of db.parents) {
      const key = (p.email?.toLowerCase() || `${p.firstName}|${p.lastName}|${p.phone ?? ""}`).trim();
      const g = m.get(key) ?? {
        key, firstName: p.firstName, lastName: p.lastName,
        phone: p.phone, whatsapp: p.whatsapp, email: p.email,
        profession: (p as any).profession,
        relationship: p.relationship as ParentRelation | undefined,
        studentIds: [] as string[], parentRowIds: [] as string[],
      };
      if (!g.studentIds.includes(p.studentId)) g.studentIds.push(p.studentId);
      g.parentRowIds.push(p.id);
      m.set(key, g);
    }
    return Array.from(m.values()).sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  }, [db.parents]);

  // Keep open dialogs in sync with latest store data
  const refreshFromGroups = (key: string) => groups.find((g) => g.key === key) ?? null;

  const studentName = (id: string) => {
    const s = db.students.find((x) => x.id === id);
    return s ? `${s.firstName} ${s.lastName}` : "—";
  };

  const filtered = groups.filter((g) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return `${g.firstName} ${g.lastName} ${g.phone ?? ""} ${g.email ?? ""}`.toLowerCase().includes(q);
  });

  const openCreateAccount = async (g: ParentGroup) => {
    if (!g.email) { toast.error("Ce parent n'a pas d'email"); return; }
    try {
      const res = await adminApi.createParent({
        firstName: g.firstName, lastName: g.lastName,
        email: g.email, phone: g.phone || undefined,
        studentIds: g.studentIds,
        relationship: g.relationship,
      });
      setCredentials({
        name: `${g.firstName} ${g.lastName}`,
        email: g.email, tempPassword: res.tempPassword,
        role: "parent", schoolName: school?.name,
      });
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  const resetAccount = async (g: ParentGroup) => {
    const acc = accountFor(g.email);
    if (!acc) return;
    try {
      const res = await adminApi.resetPassword(acc.id);
      setCredentials({
        name: `${g.firstName} ${g.lastName}`,
        email: g.email ?? acc.email, tempPassword: res.tempPassword,
        role: "parent", schoolName: school?.name,
      });
    } catch (e) { toast.error((e as Error).message); }
  };

  const unlinkChild = async (g: ParentGroup, studentId: string) => {
    const child = studentName(studentId);
    const parentName = `${g.firstName} ${g.lastName}`.trim();
    if (!confirm(`Délier ${child} de ${parentName} ? Le parent ne sera plus associé à cet enfant.`)) return;
    const acc = accountFor(g.email);
    try {
      if (acc) await adminApi.unlinkParentStudent({ parentProfileId: acc.id, studentId });
      updateDB((d) => {
        d.parents = d.parents.filter((p) => !(g.parentRowIds.includes(p.id) && p.studentId === studentId));
      });
      toast.success("Enfant délié");
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  const linkChild = async (g: ParentGroup, studentId: string) => {
    if (!studentId) return;
    if (g.studentIds.includes(studentId)) { toast.error("Déjà lié"); return; }
    const acc = accountFor(g.email);
    try {
      if (acc) {
        await adminApi.linkParentStudent({ parentProfileId: acc.id, studentId, relationship: g.relationship });
      }
      updateDB((d) => {
        d.parents.push({
          id: crypto.randomUUID(), studentId,
          firstName: g.firstName, lastName: g.lastName,
          phone: g.phone ?? "", whatsapp: g.whatsapp, email: g.email,
          relationship: g.relationship, isEmergencyContact: false,
        });
      });
      toast.success("Enfant lié");
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  const doDelete = async (g: ParentGroup) => {
    const acc = accountFor(g.email);
    try {
      if (acc) await adminApi.delete(acc.id);
      updateDB((d) => {
        d.parents = d.parents.filter((p) => !g.parentRowIds.includes(p.id));
      });
      toast.success("Parent supprimé");
      setConfirmDel(null);
      setDetail(null);
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher un parent..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Aucun parent enregistré.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom complet</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Enfant(s)</TableHead>
                <TableHead>Compte</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((g) => {
                const acc = accountFor(g.email);
                return (
                  <TableRow key={g.key}>
                    <TableCell className="font-medium">
                      <button className="hover:underline text-left" onClick={() => setDetail(g)}>
                        {g.firstName} {g.lastName}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{g.phone ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{g.email ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {g.studentIds.map((sid) => (
                          <Link key={sid} to="/eleves/$studentId" params={{ studentId: sid }}>
                            <Badge variant="secondary" className="hover:bg-secondary/80 cursor-pointer">{studentName(sid)}</Badge>
                          </Link>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {acc ? (
                        <Badge className="bg-success/15 text-success hover:bg-success/15">Actif</Badge>
                      ) : (
                        <Badge variant="secondary">Aucun</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setDetail(g)} title="Voir">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditing(g)} title="Modifier">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => (acc ? resetAccount(g) : openCreateAccount(g))}
                        title={acc ? "Réinitialiser mot de passe" : "Créer compte"}
                        disabled={!acc && !g.email}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDel(g)} title="Supprimer">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-muted-foreground">{filtered.length} parent(s) · {accounts.length} compte(s) actif(s)</p>
      </CardContent>

      {/* Detail */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails du parent</DialogTitle>
          </DialogHeader>
          {detail && (() => {
            const g = refreshFromGroups(detail.key) ?? detail;
            const acc = accountFor(g.email);
            const otherStudents = db.students.filter((s) => !g.studentIds.includes(s.id));
            return (
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-base">{g.firstName} {g.lastName}</p>
                      {g.relationship && <Badge variant="outline">{g.relationship}</Badge>}
                      {acc ? (
                        <Badge className="bg-success/15 text-success hover:bg-success/15 ml-auto">
                          <CheckCircle2 className="mr-1 h-3 w-3" />Compte actif
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="ml-auto">Aucun compte</Badge>
                      )}
                    </div>
                    {g.phone && <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{g.phone}</p>}
                    {g.email && <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{g.email}</p>}
                    {g.profession && <p className="text-sm text-muted-foreground">{g.profession}</p>}
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Enfants liés ({g.studentIds.length})</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {g.studentIds.map((sid) => {
                      const s = db.students.find((x) => x.id === sid);
                      if (!s) return null;
                      const cls = db.classes.find((c) => c.id === s.classId)?.name ?? "—";
                      return (
                        <Card key={sid}>
                          <CardContent className="p-3 flex items-center gap-3">
                            <button
                              onClick={() => { setDetail(null); navigate({ to: "/eleves/$studentId", params: { studentId: sid } }); }}
                              className="flex flex-1 items-center gap-3 text-left hover:opacity-80"
                            >
                              {s.photo ? (
                                <img src={s.photo} alt="" className="h-10 w-10 rounded-full object-cover" />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                  {(s.firstName[0] ?? "").toUpperCase()}{(s.lastName[0] ?? "").toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{s.firstName} {s.lastName}</p>
                                <p className="text-xs text-muted-foreground">{cls}</p>
                              </div>
                            </button>
                            <Button variant="ghost" size="icon" onClick={() => unlinkChild(g, sid)} title="Délier">
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Select onValueChange={(v) => linkChild(g, v)}>
                      <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Lier un autre enfant..." /></SelectTrigger>
                      <SelectContent>
                        {otherStudents.length === 0 ? (
                          <div className="p-2 text-xs text-muted-foreground">Aucun élève disponible</div>
                        ) : otherStudents.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Compte</p>
                  {acc ? (
                    <Button variant="outline" size="sm" onClick={() => resetAccount(g)}>
                      <KeyRound className="mr-1.5 h-4 w-4" />Réinitialiser mot de passe
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => openCreateAccount(g)} disabled={!g.email}>
                      <UserPlus className="mr-1.5 h-4 w-4" />Créer un compte
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => detail && setEditing(detail)}>
              <Pencil className="mr-1.5 h-4 w-4" />Modifier
            </Button>
            <Button variant="destructive" onClick={() => detail && setConfirmDel(detail)}>
              <Trash2 className="mr-1.5 h-4 w-4" />Supprimer
            </Button>
            <Button onClick={() => setDetail(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ParentEditDialog group={editing} onClose={() => setEditing(null)} />

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce parent ?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDel && (
                <>
                  Supprimer <strong>{confirmDel.firstName} {confirmDel.lastName}</strong> définitivement ?
                  {confirmDel.studentIds.length > 1 && (
                    <span className="block mt-2 text-destructive">
                      Attention : ce parent est lié à {confirmDel.studentIds.length} enfants.
                    </span>
                  )}
                  <span className="block mt-2">
                    Son compte, ses accès et tous ses liens seront supprimés. Action irréversible.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && doDelete(confirmDel)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CredentialsModal info={credentials} onClose={() => setCredentials(null)} />
    </Card>
  );
}

function ParentEditDialog({ group, onClose }: { group: ParentGroup | null; onClose: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [profession, setProfession] = useState("");
  const [relationship, setRelationship] = useState<ParentRelation>("Père");
  const [primedKey, setPrimedKey] = useState<string | null>(null);

  if (group && primedKey !== group.key) {
    setPrimedKey(group.key);
    setFirstName(group.firstName);
    setLastName(group.lastName);
    setPhone(group.phone ?? "");
    setWhatsapp(group.whatsapp ?? "");
    setEmail(group.email ?? "");
    setProfession(group.profession ?? "");
    setRelationship((group.relationship as ParentRelation) || "Père");
  }

  const save = () => {
    if (!group) return;
    if (!firstName.trim() || !lastName.trim()) { toast.error("Prénom et nom requis"); return; }
    if (!phone.trim()) { toast.error("Téléphone requis"); return; }
    const rowIds = new Set(group.parentRowIds);
    updateDB((d) => {
      d.parents = d.parents.map((p) =>
        rowIds.has(p.id)
          ? {
              ...p,
              firstName: firstName.trim(), lastName: lastName.trim(),
              phone: phone.trim(), whatsapp: whatsapp.trim() || undefined,
              email: email.trim() || undefined,
              profession: profession.trim() || undefined,
              relationship,
            } as any
          : p,
      );
    });
    toast.success("Parent modifié");
    setPrimedKey(null);
    onClose();
  };

  return (
    <Dialog open={!!group} onOpenChange={(o) => { if (!o) { setPrimedKey(null); onClose(); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Modifier le parent</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Prénom *</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Nom *</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Téléphone *</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>WhatsApp</Label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Profession</Label>
            <Input value={profession} onChange={(e) => setProfession(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Relation</Label>
            <Select value={relationship} onValueChange={(v) => setRelationship(v as ParentRelation)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PARENT_RELATIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setPrimedKey(null); onClose(); }}>Annuler</Button>
          <Button onClick={save}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
