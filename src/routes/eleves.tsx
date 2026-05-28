import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState, TableSkeleton, useLoaded } from "@/components/shared";
import { useDB, updateDB } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

export const Route = createFileRoute("/eleves")({
  component: ElevesPage,
});

const schema = z.object({
  firstName: z.string().min(2, "Prénom requis"),
  lastName: z.string().min(2, "Nom requis"),
  classId: z.string().min(1, "Classe requise"),
  gender: z.enum(["M", "F"]),
  parentName: z.string().min(2, "Nom du parent requis"),
  parentPhone: z.string().min(6, "Téléphone invalide"),
});

function ElevesPage() {
  const db = useDB();
  const loaded = useLoaded();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", classId: "", gender: "M", parentName: "", parentPhone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const className = (id: string) => db.classes.find((c) => c.id === id)?.name ?? "—";

  const filtered = useMemo(
    () =>
      db.students.filter((s) =>
        `${s.firstName} ${s.lastName} ${className(s.classId)}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [db.students, search],
  );

  const submit = () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    updateDB((d) => {
      d.students.push({
        id: "student-" + Math.random().toString(36).slice(2, 9),
        firstName: form.firstName,
        lastName: form.lastName,
        gender: form.gender as "M" | "F",
        classId: form.classId,
        birthDate: "2016-01-01",
        parentName: form.parentName,
        parentPhone: form.parentPhone,
        enrolledAt: new Date().toISOString().slice(0, 10),
      });
      d.activities.unshift({ id: "act-" + Math.random().toString(36).slice(2, 7), type: "student", text: `Nouvel élève inscrit : ${form.firstName} ${form.lastName}`, date: new Date().toISOString() });
    });
    toast.success("Élève ajouté avec succès");
    setForm({ firstName: "", lastName: "", classId: "", gender: "M", parentName: "", parentPhone: "" });
    setOpen(false);
  };

  const remove = (id: string) => {
    updateDB((d) => {
      d.students = d.students.filter((s) => s.id !== id);
    });
    toast.success("Élève supprimé");
  };

  return (
    <AppLayout title="Élèves">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un élève..." className="pl-9" />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> Nouvel élève
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Inscrire un nouvel élève</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Prénom" error={errors.firstName}>
                <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
              </Field>
              <Field label="Nom" error={errors.lastName}>
                <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
              </Field>
              <Field label="Classe" error={errors.classId}>
                <Select value={form.classId} onValueChange={(v) => set("classId", v)}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {db.classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Sexe" error={errors.gender}>
                <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculin</SelectItem>
                    <SelectItem value="F">Féminin</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Nom du parent" error={errors.parentName}>
                <Input value={form.parentName} onChange={(e) => set("parentName", e.target.value)} />
              </Field>
              <Field label="Téléphone parent" error={errors.parentPhone}>
                <Input value={form.parentPhone} onChange={(e) => set("parentPhone", e.target.value)} />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={submit}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          {!loaded ? (
            <TableSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState icon={Users} title="Aucun élève trouvé" description="Commencez par inscrire votre premier élève." actionLabel="Nouvel élève" onAction={() => setOpen(true)} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom complet</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Sexe</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                    <TableCell><Badge variant="secondary">{className(s.classId)}</Badge></TableCell>
                    <TableCell>{s.gender === "M" ? "Garçon" : "Fille"}</TableCell>
                    <TableCell>{s.parentName}</TableCell>
                    <TableCell className="text-muted-foreground">{s.parentPhone}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
