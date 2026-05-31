// Hydration + diff-sync between the in-memory store and Supabase for Phase 1
// tables: schools, classes, students, teachers, class_subjects.
//
// Hydration: pull from Supabase, replace those collections in the cache.
// Sync: after every updateDB, diff snapshots and push INSERT/UPDATE/DELETE to
// Supabase. Errors are reported via toast and trigger a re-hydration.

import { supabase } from "@/integrations/supabase/client";
import { getDB, updateDB } from "./store";
import { toast } from "sonner";
import type { Classe, Student, Teacher, School, ClassSubject, Level } from "./types";

type Snapshot = {
  schools: School[];
  classes: Classe[];
  students: Student[];
  teachers: Teacher[];
  classSubjects: ClassSubject[];
};

let lastSnapshot: Snapshot | null = null;
let currentSchoolId: string | null = null;
let syncing = false;
let pendingSync = false;

export function getCurrentSchoolId(): string | null {
  return currentSchoolId;
}

function snapshot(): Snapshot {
  const db = getDB();
  return {
    schools: [...db.schools],
    classes: [...db.classes],
    students: [...db.students],
    teachers: [...db.teachers],
    classSubjects: [...db.classSubjects],
  };
}

// ---- Row <-> domain mapping ----
function rowToSchool(r: { id: string; name: string; director_name: string | null; email: string | null; phone: string | null; city: string | null; country: string | null }): School {
  return {
    id: r.id,
    name: r.name,
    director: r.director_name ?? "",
    email: r.email ?? "",
    phone: r.phone ?? "",
    city: r.city ?? "",
    country: r.country ?? "",
  };
}

function rowToClasse(r: { id: string; name: string; level: string | null; capacity: number | null; teacher_id: string | null }): Classe {
  return {
    id: r.id,
    name: r.name,
    level: (r.level ?? "CP") as Level,
    capacity: r.capacity ?? 30,
    teacherId: r.teacher_id ?? "",
    fees: 150000,
  };
}

function rowToStudent(r: { id: string; class_id: string | null; first_name: string; last_name: string; gender: string | null; birth_date: string | null; enrollment_date: string | null; student_code: string | null; status: string | null; photo_url: string | null }): Student {
  const statusMap: Record<string, Student["status"]> = { active: "actif", inactive: "inactif", transferred: "transfere" };
  return {
    id: r.id,
    classId: r.class_id ?? "",
    firstName: r.first_name,
    lastName: r.last_name,
    gender: (r.gender === "F" ? "F" : "M") as "M" | "F",
    birthDate: r.birth_date ?? "",
    enrolledAt: r.enrollment_date ?? "",
    code: r.student_code ?? undefined,
    status: statusMap[r.status ?? "active"] ?? "actif",
    photo: r.photo_url ?? undefined,
    parentName: "",
    parentPhone: "",
  };
}

function rowToTeacher(r: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; subjects: string[] | null }): Teacher {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email ?? "",
    phone: r.phone ?? "",
    subject: r.subjects?.[0] ?? "",
    subjects: r.subjects ?? [],
  };
}

function rowToClassSubject(r: { id: string; class_id: string; name: string; coefficient: number; teacher_id: string | null }): ClassSubject {
  return {
    id: r.id,
    classId: r.class_id,
    name: r.name,
    coefficient: r.coefficient,
    teacherId: r.teacher_id ?? undefined,
  };
}

// ---- Hydration ----
export async function hydrateAll(schoolId: string): Promise<void> {
  currentSchoolId = schoolId;
  const [schoolsRes, classesRes, studentsRes, teachersRes, subjectsRes] = await Promise.all([
    supabase.from("schools").select("*").eq("id", schoolId),
    supabase.from("classes").select("*").eq("school_id", schoolId),
    supabase.from("students").select("*").eq("school_id", schoolId),
    supabase.from("teachers").select("*").eq("school_id", schoolId),
    supabase.from("class_subjects").select("*").eq("school_id", schoolId),
  ]);

  const schools = (schoolsRes.data ?? []).map(rowToSchool);
  const classes = (classesRes.data ?? []).map(rowToClasse);
  const students = (studentsRes.data ?? []).map(rowToStudent);
  const teachers = (teachersRes.data ?? []).map(rowToTeacher);
  const classSubjects = (subjectsRes.data ?? []).map(rowToClassSubject);

  // Suppress sync while we apply hydration
  syncing = true;
  try {
    updateDB((db) => {
      db.schools = schools;
      db.classes = classes;
      db.students = students;
      db.teachers = teachers;
      db.classSubjects = classSubjects;
    });
  } finally {
    syncing = false;
  }
  lastSnapshot = snapshot();
}

export function clearHydration(): void {
  lastSnapshot = null;
  currentSchoolId = null;
}

// ---- Diff sync ----
function diff<T extends { id: string }>(before: T[], after: T[]): { inserted: T[]; updated: T[]; deletedIds: string[] } {
  const beforeMap = new Map(before.map((x) => [x.id, x]));
  const afterMap = new Map(after.map((x) => [x.id, x]));
  const inserted: T[] = [];
  const updated: T[] = [];
  const deletedIds: string[] = [];
  for (const [id, val] of afterMap) {
    const old = beforeMap.get(id);
    if (!old) inserted.push(val);
    else if (JSON.stringify(old) !== JSON.stringify(val)) updated.push(val);
  }
  for (const id of beforeMap.keys()) {
    if (!afterMap.has(id)) deletedIds.push(id);
  }
  return { inserted, updated, deletedIds };
}

async function pushDiffs(): Promise<void> {
  if (!currentSchoolId || !lastSnapshot) return;
  const current = snapshot();
  const schoolId = currentSchoolId;

  // Schools
  for (const s of diff(lastSnapshot.schools, current.schools).updated) {
    const { error } = await supabase.from("schools").update({
      name: s.name, director_name: s.director, email: s.email, phone: s.phone, city: s.city, country: s.country,
    }).eq("id", s.id);
    if (error) throw error;
  }

  // Teachers
  const teacherDiff = diff(lastSnapshot.teachers, current.teachers);
  for (const t of teacherDiff.inserted) {
    const { error } = await supabase.from("teachers").insert({
      id: t.id, school_id: schoolId, first_name: t.firstName, last_name: t.lastName,
      email: t.email || null, phone: t.phone || null, subjects: t.subjects ?? [],
    });
    if (error) throw error;
  }
  for (const t of teacherDiff.updated) {
    const { error } = await supabase.from("teachers").update({
      first_name: t.firstName, last_name: t.lastName, email: t.email || null,
      phone: t.phone || null, subjects: t.subjects ?? [],
    }).eq("id", t.id);
    if (error) throw error;
  }
  for (const id of teacherDiff.deletedIds) {
    const { error } = await supabase.from("teachers").delete().eq("id", id);
    if (error) throw error;
  }

  // Classes
  const classDiff = diff(lastSnapshot.classes, current.classes);
  for (const c of classDiff.inserted) {
    const { error } = await supabase.from("classes").insert({
      id: c.id, school_id: schoolId, name: c.name, level: c.level,
      capacity: c.capacity, teacher_id: c.teacherId || null,
    });
    if (error) throw error;
  }
  for (const c of classDiff.updated) {
    const { error } = await supabase.from("classes").update({
      name: c.name, level: c.level, capacity: c.capacity, teacher_id: c.teacherId || null,
    }).eq("id", c.id);
    if (error) throw error;
  }
  for (const id of classDiff.deletedIds) {
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) throw error;
  }

  // Students
  const studentStatusMap: Record<string, string> = { actif: "active", inactif: "inactive", transfere: "transferred" };
  const studentDiff = diff(lastSnapshot.students, current.students);
  for (const s of studentDiff.inserted) {
    const { error } = await supabase.from("students").insert({
      id: s.id, school_id: schoolId, class_id: s.classId || null,
      first_name: s.firstName, last_name: s.lastName, gender: s.gender,
      birth_date: s.birthDate || null, enrollment_date: s.enrolledAt || null,
      student_code: s.code ?? null, status: studentStatusMap[s.status ?? "actif"], photo_url: s.photo ?? null,
    });
    if (error) throw error;
  }
  for (const s of studentDiff.updated) {
    const { error } = await supabase.from("students").update({
      class_id: s.classId || null, first_name: s.firstName, last_name: s.lastName,
      gender: s.gender, birth_date: s.birthDate || null, enrollment_date: s.enrolledAt || null,
      student_code: s.code ?? null, status: studentStatusMap[s.status ?? "actif"], photo_url: s.photo ?? null,
    }).eq("id", s.id);
    if (error) throw error;
  }
  for (const id of studentDiff.deletedIds) {
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) throw error;
  }

  // Class subjects
  const subjDiff = diff(lastSnapshot.classSubjects, current.classSubjects);
  for (const s of subjDiff.inserted) {
    const { error } = await supabase.from("class_subjects").insert({
      id: s.id, school_id: schoolId, class_id: s.classId, name: s.name,
      coefficient: s.coefficient, teacher_id: s.teacherId || null,
    });
    if (error) throw error;
  }
  for (const s of subjDiff.updated) {
    const { error } = await supabase.from("class_subjects").update({
      class_id: s.classId, name: s.name, coefficient: s.coefficient, teacher_id: s.teacherId || null,
    }).eq("id", s.id);
    if (error) throw error;
  }
  for (const id of subjDiff.deletedIds) {
    const { error } = await supabase.from("class_subjects").delete().eq("id", id);
    if (error) throw error;
  }

  lastSnapshot = current;
}

export function triggerSync(): void {
  if (syncing) {
    pendingSync = true;
    return;
  }
  if (!currentSchoolId || !lastSnapshot) return;
  syncing = true;
  pushDiffs()
    .catch((err) => {
      console.error("[sync] failed", err);
      toast.error("Erreur d'enregistrement: " + (err as Error).message);
      // Re-hydrate to recover
      if (currentSchoolId) hydrateAll(currentSchoolId).catch(() => {});
    })
    .finally(() => {
      syncing = false;
      if (pendingSync) {
        pendingSync = false;
        triggerSync();
      }
    });
}
