import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "./audit";

export interface MedicalInfo {
  blood_group: string | null;
  allergies: string | null;
  chronic_conditions: string | null;
  medications: string | null;
  vaccinations: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  medical_notes: string | null;
}

export const EMPTY_MEDICAL: MedicalInfo = {
  blood_group: null, allergies: null, chronic_conditions: null,
  medications: null, vaccinations: null,
  emergency_contact_name: null, emergency_contact_phone: null,
  emergency_contact_relation: null, medical_notes: null,
};

const MEDICAL_COLS =
  "blood_group, allergies, chronic_conditions, medications, vaccinations, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, medical_notes";

export function useMedicalInfo(studentId: string | undefined) {
  const [data, setData] = useState<MedicalInfo>(EMPTY_MEDICAL);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    const { data: row } = await supabase
      .from("students")
      .select(MEDICAL_COLS)
      .eq("id", studentId)
      .maybeSingle();
    setData({ ...EMPTY_MEDICAL, ...((row ?? {}) as Partial<MedicalInfo>) });
    setLoading(false);
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (patch: Partial<MedicalInfo>) => {
    if (!studentId) return { error: "no-student" as const };
    const { error } = await supabase.from("students").update(patch).eq("id", studentId);
    if (!error) setData((d) => ({ ...d, ...patch }));
    return { error: error?.message };
  }, [studentId]);

  return { data, loading, save, refresh: load };
}

export type DisciplineType = "incident" | "sanction" | "observation_positive" | "avertissement";
export type DisciplineSeverity = "faible" | "moyen" | "grave";

export interface DisciplineRecord {
  id: string;
  school_id: string;
  student_id: string;
  date: string;
  type: DisciplineType;
  title: string;
  description: string | null;
  severity: DisciplineSeverity | null;
  recorded_by: string | null;
  recorded_by_name?: string | null;
  created_at: string;
}

export function useDisciplineRecords(studentId: string | undefined) {
  const [records, setRecords] = useState<DisciplineRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    const { data } = await supabase
      .from("discipline_records")
      .select("*")
      .eq("student_id", studentId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    const list = (data ?? []) as DisciplineRecord[];

    // Resolve recorder names in one go
    const ids = Array.from(new Set(list.map((r) => r.recorded_by).filter(Boolean) as string[]));
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const byId = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      list.forEach((r) => { r.recorded_by_name = r.recorded_by ? byId.get(r.recorded_by) ?? null : null; });
    }
    setRecords(list);
    setLoading(false);
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (input: {
    schoolId: string; date: string; type: DisciplineType;
    title: string; description?: string; severity?: DisciplineSeverity | null;
  }) => {
    if (!studentId) return { error: "no-student" };
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    const { error } = await supabase.from("discipline_records").insert({
      school_id: input.schoolId,
      student_id: studentId,
      date: input.date,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      severity: input.type === "incident" ? (input.severity ?? null) : null,
      recorded_by: uid,
    });
    if (!error) {
      logAudit({
        action: "discipline_record_created", targetType: "student", targetId: studentId,
        details: { type: input.type, title: input.title, severity: input.severity ?? null, date: input.date },
      });
      await load();
    }
    return { error: error?.message };
  }, [studentId, load]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("discipline_records").delete().eq("id", id);
    if (!error) await load();
    return { error: error?.message };
  }, [load]);

  return { records, loading, add, remove, refresh: load };
}

export const DISCIPLINE_TYPE_LABEL: Record<DisciplineType, string> = {
  incident: "Incident",
  sanction: "Sanction",
  observation_positive: "Observation positive",
  avertissement: "Avertissement",
};

export function disciplineBadgeClass(t: DisciplineType): string {
  if (t === "incident") return "bg-destructive/15 text-destructive border-destructive/30";
  if (t === "sanction") return "bg-accent/25 text-accent-foreground border-accent/50";
  if (t === "avertissement") return "bg-accent/10 text-accent border-accent/30";
  return "bg-success/15 text-success border-success/30";
}
