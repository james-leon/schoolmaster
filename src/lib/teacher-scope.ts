import type { User, Classe, DB } from "./types";

/**
 * Resolve the classes a teacher has access to, combining all assignment sources:
 *   1. profiles.assigned_classes (string[] of class names or levels)
 *   2. classes.teacherId — linked via the teachers row whose email matches the user
 *   3. class_subjects.teacherId — same email link
 *   4. class_teachers (many-to-many) — same email link
 *
 * For non-teachers, returns all classes.
 */
export function resolveTeacherClasses(user: User | null | undefined, db: DB): Classe[] {
  if (!user || user.role !== "teacher") return db.classes;

  const assigned = user.assignedClasses ?? [];
  const email = (user.email ?? "").trim().toLowerCase();
  const myTeacher = email
    ? db.teachers.find((t) => (t.email ?? "").trim().toLowerCase() === email)
    : undefined;
  const myTeacherId = myTeacher?.id;

  const subjectClassIds = new Set(
    myTeacherId
      ? db.classSubjects.filter((cs) => cs.teacherId === myTeacherId).map((cs) => cs.classId)
      : [],
  );
  const linkClassIds = new Set(
    myTeacherId
      ? (db.classTeachers ?? []).filter((ct) => ct.teacherId === myTeacherId).map((ct) => ct.classId)
      : [],
  );

  return db.classes.filter((c) => {
    if (assigned.some((a) => c.name === a || c.level === a)) return true;
    if (myTeacherId && c.teacherId === myTeacherId) return true;
    if (subjectClassIds.has(c.id)) return true;
    if (linkClassIds.has(c.id)) return true;
    return false;
  });
}

export function resolveTeacherClassIds(user: User | null | undefined, db: DB): string[] {
  return resolveTeacherClasses(user, db).map((c) => c.id);
}
