import { useMemo, useRef, useState } from "react";
// xlsx is loaded dynamically to keep it out of the SSR bundle
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type RowStatus = "valid" | "warning" | "error";

export interface ParsedRow<T> {
  index: number;
  raw: Record<string, unknown>;
  data: T | null;
  status: RowStatus;
  messages: string[];
  display: string[];
}

export interface ImportConfig<T> {
  /** Modal title, e.g. "Importer des élèves" */
  title: string;
  /** Template file name (without extension) */
  templateName: string;
  /** Ordered column headers as they should appear in the template */
  columns: string[];
  /** 1-2 example rows shown in the template */
  exampleRows: (string | number)[][];
  /** Extra usage notes shown in step 1 */
  notes?: string[];
  /** Preview column headers shown in the review step (defaults to `columns`) */
  previewColumns?: string[];
  /** Whether to show the "auto-create missing classes" checkbox */
  showAutoCreateClasses?: boolean;
  /** Validate a single row. Returns parsed data + status + messages + display cells. */
  validateRow: (
    raw: Record<string, unknown>,
    ctx: { autoCreateClasses: boolean },
  ) => { data: T | null; status: RowStatus; messages: string[]; display: string[] };
  /** Commit valid (+ warning) rows; return imported / skipped counts. */
  importRows: (
    rows: ParsedRow<T>[],
    opts: { autoCreateClasses: boolean; onProgress: (done: number, total: number) => void },
  ) => Promise<{ imported: number; skipped: number }>;
}

interface Props<T> {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  config: ImportConfig<T>;
  onDone?: () => void;
}

export function ImportDialog<T>({ open, onOpenChange, config, onDone }: Props<T>) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [rows, setRows] = useState<ParsedRow<T>[]>([]);
  const [fileName, setFileName] = useState("");
  const [autoCreateClasses, setAutoCreateClasses] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => {
    const valid = rows.filter((r) => r.status === "valid").length;
    const warning = rows.filter((r) => r.status === "warning").length;
    const error = rows.filter((r) => r.status === "error").length;
    return { valid, warning, error, importable: valid + warning };
  }, [rows]);

  const reset = () => {
    setStep(1);
    setRows([]);
    setFileName("");
    setAutoCreateClasses(false);
    setImporting(false);
    setProgress({ done: 0, total: 0 });
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = (o: boolean) => {
    if (importing) return;
    if (!o) reset();
    onOpenChange(o);
  };

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([config.columns, ...config.exampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modèle");
    XLSX.writeFile(wb, `${config.templateName}.xlsx`);
  };

  const parseFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: false });
      if (!raw.length) {
        toast.error("Le fichier est vide.");
        return;
      }
      const parsed: ParsedRow<T>[] = raw.map((r, i) => {
        const v = config.validateRow(r, { autoCreateClasses });
        return { index: i + 2, raw: r, ...v };
      });
      setRows(parsed);
      setFileName(file.name);
      setStep(3);
    } catch (e) {
      console.error(e);
      toast.error("Impossible de lire le fichier. Vérifiez le format.");
    }
  };

  // Re-validate when "auto-create classes" toggles (warnings may become valid)
  const recomputeWithAutoCreate = (checked: boolean) => {
    setAutoCreateClasses(checked);
    if (rows.length === 0) return;
    setRows((prev) =>
      prev.map((r) => {
        const v = config.validateRow(r.raw, { autoCreateClasses: checked });
        return { ...r, ...v };
      }),
    );
  };

  const runImport = async () => {
    const importable = rows.filter((r) => r.status !== "error");
    if (importable.length === 0) {
      toast.error("Aucune ligne valide à importer.");
      return;
    }
    setImporting(true);
    setProgress({ done: 0, total: importable.length });
    setStep(4);
    try {
      const res = await config.importRows(importable, {
        autoCreateClasses,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      toast.success(`${res.imported} ligne(s) importée(s) avec succès`);
      if (res.skipped > 0) toast.message(`${res.skipped} ligne(s) ignorée(s)`);
      onDone?.();
      close(false);
    } catch (e) {
      console.error(e);
      toast.error("Erreur durant l'import. Réessayez.");
      setImporting(false);
      setStep(3);
    }
  };

  const downloadErrorReport = () => {
    const errs = rows.filter((r) => r.status === "error");
    if (errs.length === 0) return;
    const data = errs.map((r) => ({ Ligne: r.index, Erreurs: r.messages.join(" ; "), ...r.raw }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Erreurs");
    XLSX.writeFile(wb, `${config.templateName}-erreurs.xlsx`);
  };

  const previewCols = config.previewColumns ?? config.columns;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs">
          {[
            { n: 1, label: "Modèle" },
            { n: 2, label: "Importer" },
            { n: 3, label: "Vérifier" },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold",
                  step >= s.n ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {s.n}
              </div>
              <span className={cn(step >= s.n ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
              {i < 2 && <div className="mx-1 h-px w-8 bg-border" />}
            </div>
          ))}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Téléchargez le modèle Excel, remplissez-le avec vos données, puis revenez ici pour l'importer.
            </p>
            <div className="rounded-md border p-4 space-y-2">
              <p className="text-sm font-medium">Colonnes du modèle</p>
              <div className="flex flex-wrap gap-1.5">
                {config.columns.map((c) => (
                  <Badge key={c} variant="outline">{c}</Badge>
                ))}
              </div>
              {config.notes && (
                <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground space-y-1">
                  {config.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </div>
            <Button onClick={downloadTemplate} className="w-full sm:w-auto">
              <Download className="mr-1.5 h-4 w-4" /> Télécharger le modèle Excel
            </Button>
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>Annuler</Button>
              <Button onClick={() => setStep(2)}>Suivant</Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sélectionnez un fichier Excel (.xlsx) ou CSV rempli avec vos données.
            </p>
            <div
              onClick={() => fileRef.current?.click()}
              className="cursor-pointer rounded-md border-2 border-dashed border-border p-8 text-center hover:bg-muted/50 transition"
            >
              <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-2 text-sm">Cliquez pour choisir un fichier</p>
              <p className="text-xs text-muted-foreground">.xlsx ou .csv</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) parseFile(f);
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>Retour</Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">Fichier : <strong className="text-foreground">{fileName}</strong></span>
              <Badge className="bg-success/15 text-success hover:bg-success/15">
                <CheckCircle2 className="mr-1 h-3 w-3" /> {summary.valid} valide{summary.valid > 1 ? "s" : ""}
              </Badge>
              {summary.warning > 0 && (
                <Badge className="bg-accent/15 text-accent hover:bg-accent/15">
                  <AlertTriangle className="mr-1 h-3 w-3" /> {summary.warning} avertissement{summary.warning > 1 ? "s" : ""}
                </Badge>
              )}
              {summary.error > 0 && (
                <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15">
                  <XCircle className="mr-1 h-3 w-3" /> {summary.error} erreur{summary.error > 1 ? "s" : ""}
                </Badge>
              )}
            </div>

            {config.showAutoCreateClasses && (
              <div className="flex items-center gap-2 rounded-md border p-3">
                <Checkbox
                  id="auto-create"
                  checked={autoCreateClasses}
                  onCheckedChange={(c) => recomputeWithAutoCreate(!!c)}
                />
                <Label htmlFor="auto-create" className="text-sm cursor-pointer">
                  Créer automatiquement les classes manquantes
                </Label>
              </div>
            )}

            <div className="max-h-[40vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Statut</TableHead>
                    <TableHead className="w-12">Ligne</TableHead>
                    {previewCols.map((c) => (
                      <TableHead key={c}>{c}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.index}>
                      <TableCell>
                        {r.status === "valid" && <CheckCircle2 className="h-4 w-4 text-success" />}
                        {r.status === "warning" && <AlertTriangle className="h-4 w-4 text-accent" />}
                        {r.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.index}</TableCell>
                      {r.display.map((v, i) => (
                        <TableCell key={i} className="text-xs">{v}</TableCell>
                      ))}
                      {r.messages.length > 0 && (
                        <TableCell colSpan={0} />
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {(summary.warning > 0 || summary.error > 0) && (
              <div className="rounded-md border p-3 text-xs space-y-1 max-h-40 overflow-auto">
                {rows.filter((r) => r.messages.length > 0).map((r) => (
                  <div key={r.index} className={cn(
                    r.status === "error" ? "text-destructive" : "text-accent",
                  )}>
                    Ligne {r.index} : {r.messages.join(" ; ")}
                  </div>
                ))}
              </div>
            )}

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              {summary.error > 0 && (
                <Button variant="outline" onClick={downloadErrorReport}>
                  <FileDown className="mr-1.5 h-4 w-4" /> Rapport d'erreurs
                </Button>
              )}
              <Button variant="outline" onClick={() => setStep(2)}>Changer de fichier</Button>
              <Button onClick={runImport} disabled={summary.importable === 0}>
                <Upload className="mr-1.5 h-4 w-4" /> Importer {summary.importable} ligne{summary.importable > 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 4 — progress */}
        {step === 4 && (
          <div className="space-y-4 py-6">
            <p className="text-sm text-center">
              Import en cours… {progress.done}/{progress.total}
            </p>
            <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
