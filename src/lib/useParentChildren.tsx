import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface ParentChild {
  id: string;
  firstName: string;
  lastName: string;
  classId: string | null;
  className: string | null;
  photo: string | null;
  relationship: string;
  gender: string | null;
  birthDate: string | null;
  code: string | null;
}

const SELECTED_KEY = "parent_selected_child_v1";

export function useParentChildren() {
  const { user } = useAuth();
  const [children, setChildren] = useState<ParentChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, _setSelectedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(SELECTED_KEY);
  });

  const setSelectedId = useCallback((id: string | null) => {
    _setSelectedId(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(SELECTED_KEY, id);
      else localStorage.removeItem(SELECTED_KEY);
    }
  }, []);

  const load = useCallback(async () => {
    if (!user || user.role !== "parent") {
      setChildren([]); setLoading(false); return;
    }
    setLoading(true);
    const { data: links } = await supabase
      .from("parent_students")
      .select("student_id, relationship");
    const ids = (links ?? []).map((l: any) => l.student_id as string);
    if (ids.length === 0) {
      setChildren([]); setLoading(false); return;
    }
    const { data: studs } = await supabase
      .from("students")
      .select("id, first_name, last_name, class_id, photo_url, gender, birth_date, student_code")
      .in("id", ids);
    const classIds = Array.from(new Set((studs ?? []).map((s: any) => s.class_id).filter(Boolean)));
    const { data: classes } = classIds.length
      ? await supabase.from("classes").select("id, name").in("id", classIds)
      : { data: [] as any[] };
    const classMap = new Map((classes ?? []).map((c: any) => [c.id, c.name]));
    const relMap = new Map((links ?? []).map((l: any) => [l.student_id, l.relationship as string]));
    const list: ParentChild[] = (studs ?? []).map((s: any) => ({
      id: s.id,
      firstName: s.first_name,
      lastName: s.last_name,
      classId: s.class_id ?? null,
      className: s.class_id ? (classMap.get(s.class_id) ?? null) : null,
      photo: s.photo_url ?? null,
      gender: s.gender ?? null,
      birthDate: s.birth_date ?? null,
      code: s.student_code ?? null,
      relationship: relMap.get(s.id) ?? "Tuteur",
    }));
    list.sort((a, b) => a.firstName.localeCompare(b.firstName));
    setChildren(list);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Ensure selected is valid
  useEffect(() => {
    if (loading) return;
    if (children.length === 0) { if (selectedId) setSelectedId(null); return; }
    if (!selectedId || !children.find((c) => c.id === selectedId)) {
      setSelectedId(children[0].id);
    }
  }, [children, selectedId, loading, setSelectedId]);

  const selectedChild = useMemo(
    () => children.find((c) => c.id === selectedId) ?? null,
    [children, selectedId],
  );

  return { children, loading, selectedId, setSelectedId, selectedChild, refresh: load };
}
