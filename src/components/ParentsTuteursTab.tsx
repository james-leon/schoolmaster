import { useState } from "react";
import { useDB } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone, MessageCircle, UserPlus, Link2, KeyRound, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { updateDB } from "@/lib/store";
import { adminApi } from "@/lib/admin-api";
import { useSchoolParentAccounts } from "@/lib/useSchoolParentAccounts";
import { CredentialsModal, type CredentialsInfo } from "@/components/CredentialsModal";
import { PARENT_RELATIONS, type ParentRelation, type Parent } from "@/lib/types";

function initials(n: string) {
  return n.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "?";
}

export function ParentsTuteursTab({
  studentId,
  schoolName,
}: { studentId: string; schoolName?: string }) {
  const db = useDB();
  const { accounts, accountFor, refresh } = useSchoolParentAccounts();
  const parents = db.parents.filter((p) => p.studentId === studentId);
  const [editing, setEditing] = useState<Parent | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [credentials, setCredentials] = useState<CredentialsInfo | null>(null);

  const removeLocal = (id: string, name: string) => {
    if (!confirm(`Délier ${name} de cet élève ?`)) return;
    updateDB((d) => { d.parents = d.parents.filter((p) => p.id !== id); });
    toast.success("Parent délié");
  };

  const createAccount = async (p: Parent) => {
    if (!p.email) { toast.error("Ce parent n'a pas d'email"); return; }
    try {
      const res = await adminApi.createParent({
        firstName: p.firstName, lastName: p.lastName,
        email: p.email, phone: p.phone || undefined,
        studentIds: [studentId],
        relationship: p.relationship,
      });
      setCredentials({
        name: `${p.firstName} ${p.lastName}`,
        email: p.email, tempPassword: res.tempPassword,
        role: "parent", schoolName,
      });
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  const resetAccount = async (parentProfileId: string, name: string, email: string) => {
    try {
      const res = await adminApi.resetPassword(parentProfileId);
      setCredentials({ name, email, tempPassword: res.tempPassword, role: "parent", schoolName });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <UserPlus className="mr-1.5 h-4 w-4" /> Ajouter un parent
        </Button>
        <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
          <Link2 className="mr-1.5 h-4 w-4" /> Lier un parent existant
        </Button>
      </div>

      {parents.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Aucun parent/tuteur enregistré pour cet élève.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {parents.map((p) => {
            const fullName = `${p.firstName} ${p.lastName}`.trim();
            const account = accountFor(p.email);
            return (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {initials(fullName)}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{fullName || "—"}</p>
                        {p.relationship && (
                          <Badge variant="outline" className="text-[10px]">{p.relationship}</Badge>
                        )}
                        {account ? (
                          <Badge className="bg-success/15 text-success hover:bg-success/15 text-[10px]">
                            <CheckCircle2 className="mr-1 h-3 w-3" />Compte actif
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Aucun compte</Badge>
                        )}
                      </div>
                      {p.phone && (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />{p.phone}
                          {p.whatsapp && (
                            <a href={`https://wa.me/${p.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                               className="ml-1 inline-flex items-center text-success hover:underline">
                              <MessageCircle className="h-3 w-3" />
                            </a>
                          )}
                        </p>
                      )}
                      {p.email && (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                          <Mail className="h-3 w-3" />{p.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {account ? (
                      <Button size="sm" variant="outline" onClick={() => resetAccount(account.id, fullName, p.email ?? "")}>
                        <KeyRound className="mr-1 h-3.5 w-3.5" />Réinit. mot de passe
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => createAccount(p)} disabled={!p.email}>
                        <UserPlus className="mr-1 h-3.5 w-3.5" />Créer compte
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" />Modifier
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeLocal(p.id, fullName)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5 text-destructive" />Délier
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ParentFormDialog
        open={addOpen} onClose={() => setAddOpen(false)}
        studentId={studentId} parent={null}
      />
      <ParentFormDialog
        open={!!editing} onClose={() => setEditing(null)}
        studentId={studentId} parent={editing}
      />
      <LinkExistingDialog
        open={linkOpen} onClose={() => setLinkOpen(false)}
        studentId={studentId}
        excludeAccountIds={parents.map((p) => accountFor(p.email)?.id).filter((x): x is string => !!x)}
        onLinked={() => { setLinkOpen(false); refresh(); }}
        accounts={accounts}
      />
      <CredentialsModal info={credentials} onClose={() => setCredentials(null)} />
    </div>
  );
}

function ParentFormDialog({
  open, onClose, studentId, parent,
}: { open: boolean; onClose: () => void; studentId: string; parent: Parent | null }) {
  const [firstName, setFirstName] = useState(parent?.firstName ?? "");
  const [lastName, setLastName] = useState(parent?.lastName ?? "");
  const [phone, setPhone] = useState(parent?.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(parent?.whatsapp ?? "");
  const [email, setEmail] = useState(parent?.email ?? "");
  const [relationship, setRelationship] = useState<ParentRelation>(
    (parent?.relationship as ParentRelation) || "Père",
  );

  // Re-prime when parent changes
  const key = parent?.id ?? "new";
  const [primedKey, setPrimedKey] = useState<string | null>(null);
  if (open && primedKey !== key) {
    setPrimedKey(key);
    setFirstName(parent?.firstName ?? "");
    setLastName(parent?.lastName ?? "");
    setPhone(parent?.phone ?? "");
    setWhatsapp(parent?.whatsapp ?? "");
    setEmail(parent?.email ?? "");
    setRelationship((parent?.relationship as ParentRelation) || "Père");
  }

  const submit = () => {
    if (!firstName.trim() || !lastName.trim()) { toast.error("Prénom et nom requis"); return; }
    if (!phone.trim()) { toast.error("Téléphone requis"); return; }
    updateDB((d) => {
      if (parent) {
        const idx = d.parents.findIndex((p) => p.id === parent.id);
        if (idx >= 0) {
          d.parents[idx] = {
            ...d.parents[idx],
            firstName: firstName.trim(), lastName: lastName.trim(),
            phone: phone.trim(), whatsapp: whatsapp.trim() || undefined,
            email: email.trim() || undefined, relationship,
          };
        }
      } else {
        d.parents.push({
          id: crypto.randomUUID(), studentId,
          firstName: firstName.trim(), lastName: lastName.trim(),
          phone: phone.trim(), whatsapp: whatsapp.trim() || undefined,
          email: email.trim() || undefined, relationship,
          isEmergencyContact: false,
        });
      }
    });
    toast.success(parent ? "Parent modifié" : "Parent ajouté");
    setPrimedKey(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setPrimedKey(null); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{parent ? "Modifier le parent" : "Ajouter un parent"}</DialogTitle>
        </DialogHeader>
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
          <Button onClick={submit}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkExistingDialog({
  open, onClose, studentId, excludeAccountIds, onLinked, accounts,
}: {
  open: boolean; onClose: () => void; studentId: string;
  excludeAccountIds: string[]; onLinked: () => void;
  accounts: { id: string; full_name: string; email: string; phone: string | null }[];
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [rel, setRel] = useState<ParentRelation>("Père");
  const [submitting, setSubmitting] = useState(false);

  const filtered = accounts
    .filter((p) => !excludeAccountIds.includes(p.id))
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
      // Mirror as a local parent record too so the card list shows it.
      const acc = accounts.find((a) => a.id === selected);
      if (acc) {
        const [fn, ...rest] = (acc.full_name || acc.email).split(/\s+/);
        updateDB((d) => {
          d.parents.push({
            id: crypto.randomUUID(), studentId,
            firstName: fn || acc.email, lastName: rest.join(" "),
            phone: acc.phone ?? "", email: acc.email, relationship: rel,
            isEmergencyContact: false,
          });
        });
      }
      toast.success("Parent lié");
      setSelected(null); setSearch("");
      onLinked();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lier un parent existant (frère/sœur)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Rechercher un parent..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-64 divide-y overflow-auto rounded-md border border-border">
            {filtered.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Aucun parent disponible.</p>
            ) : filtered.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 p-2 text-sm hover:bg-muted/50">
                <input type="radio" name="parent" checked={selected === p.id} onChange={() => setSelected(p.id)} />
                <div className="min-w-0">
                  <div className="font-medium">{p.full_name}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.email}</div>
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
          <Button onClick={submit} disabled={!selected || submitting}>{submitting ? "..." : "Lier"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
