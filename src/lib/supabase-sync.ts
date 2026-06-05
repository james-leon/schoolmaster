// Hydration + diff-sync between the in-memory store and Supabase.
// Phase 1 tables: schools, classes, students, teachers, class_subjects.
// Phase 2 tables: grades, attendance, fee_types, invoices(payments), payment_records.

import { supabase } from "@/integrations/supabase/client";
import { getDB, updateDB } from "./store";
import { toast } from "sonner";
import type {
  Classe,
  Student,
  Teacher,
  School,
  ClassSubject,
  Level,
  Grade,
  Attendance,
  FeeType,
  Payment,
  PaymentRecord,
  PaymentStatus,
  PaymentMode,
  EvaluationType,
  FeeLevelScope,
  Parent,
  Announcement,
  AcademicYear,
} from "./types";

type Snapshot = {
  schools: School[];
  classes: Classe[];
  students: Student[];
  teachers: Teacher[];
  classSubjects: ClassSubject[];
  grades: Grade[];
  attendance: Attendance[];
  feeTypes: FeeType[];
  payments: Payment[];
  paymentRecords: PaymentRecord[];
  parents: Parent[];
  announcements: Announcement[];
  academicYears: AcademicYear[];
};

function snapshot(): Snapshot {
  const db = getDB();
  return {
    schools: [...db.schools],
    classes: [...db.classes],
    students: [...db.students],
    teachers: [...db.teachers],
    classSubjects: [...db.classSubjects],
    grades: [...db.grades],
    attendance: [...db.attendance],
    feeTypes: [...db.feeTypes],
    payments: [...db.payments],
    paymentRecords: [...db.paymentRecords],
    parents: [...db.parents],
    announcements: [...db.announcements],
    academicYears: [...db.academicYears],
  };
}

let lastSnapshot: Snapshot | null = null;
let currentSchoolId: string | null = null;
let syncing = false;
let pendingSync = false;

export function getCurrentSchoolId(): string | null {
  return currentSchoolId;
}


// ---- Row <-> domain mapping ----
function rowToSchool(r: { id: string; name: string; director_name: string | null; email: string | null; phone: string | null; city: string | null; country: string | null; address: string | null; logo_url: string | null }): School {
  return {
    id: r.id,
    name: r.name,
    director: r.director_name ?? "",
    email: r.email ?? "",
    phone: r.phone ?? "",
    city: r.city ?? "",
    country: r.country ?? "",
    address: r.address ?? "",
    logo: r.logo_url ?? undefined,
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

function rowToStudent(r: { id: string; class_id: string | null; first_name: string; last_name: string; gender: string | null; birth_date: string | null; enrollment_date: string | null; student_code: string | null; status: string | null; photo_url: string | null; consent_given?: boolean | null; consent_date?: string | null }): Student {
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
    consentGiven: r.consent_given ?? false,
    consentDate: r.consent_date ?? undefined,
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

function rowToGrade(r: {
  id: string; student_id: string; class_id: string | null; subject_id: string | null;
  subject: string; term: string; evaluation_type: string | null;
  grade: number | null; devoir1: number | null; devoir2: number | null;
  composition: number | null; value: number; comment: string | null; created_at: string;
}): Grade {
  return {
    id: r.id,
    studentId: r.student_id,
    classId: r.class_id ?? undefined,
    subjectId: r.subject_id ?? undefined,
    subject: r.subject,
    term: r.term,
    evaluationType: (r.evaluation_type ?? undefined) as EvaluationType | undefined,
    grade: r.grade ?? undefined,
    devoir1: r.devoir1 ?? undefined,
    devoir2: r.devoir2 ?? undefined,
    composition: r.composition ?? undefined,
    value: r.value ?? 0,
    comment: r.comment ?? undefined,
    createdAt: r.created_at,
  };
}

function rowToAttendance(r: { id: string; student_id: string; date: string; status: string }): Attendance {
  return {
    id: r.id,
    studentId: r.student_id,
    date: r.date,
    status: (r.status as Attendance["status"]) ?? "present",
  };
}

function rowToFeeType(r: { id: string; name: string; amount: number; scope: string; due_date: string | null }): FeeType {
  return {
    id: r.id,
    name: r.name,
    amount: Number(r.amount) || 0,
    scope: (r.scope as FeeLevelScope) ?? "Tous",
    dueDate: r.due_date ?? undefined,
  };
}

function rowToInvoice(r: {
  id: string; invoice_number: string | null; student_id: string; fee_type_id: string | null;
  amount: number; amount_paid: number; date: string; due_date: string | null;
  type: string | null; status: string; mode: string | null; reference: string | null; notes: string | null;
}): Payment {
  return {
    id: r.id,
    invoiceNumber: r.invoice_number ?? undefined,
    studentId: r.student_id,
    feeTypeId: r.fee_type_id ?? undefined,
    amount: Number(r.amount) || 0,
    amountPaid: Number(r.amount_paid) || 0,
    date: r.date,
    dueDate: r.due_date ?? undefined,
    type: r.type ?? "",
    status: (r.status as PaymentStatus) ?? "impaye",
    mode: (r.mode ?? undefined) as PaymentMode | undefined,
    reference: r.reference ?? undefined,
    notes: r.notes ?? undefined,
  };
}

function rowToPaymentRecord(r: {
  id: string; receipt_number: string; invoice_id: string; student_id: string;
  amount: number; mode: string; reference: string | null; date: string; notes: string | null;
}): PaymentRecord {
  return {
    id: r.id,
    receiptNumber: r.receipt_number,
    invoiceId: r.invoice_id,
    studentId: r.student_id,
    amount: Number(r.amount) || 0,
    mode: r.mode as PaymentMode,
    reference: r.reference ?? undefined,
    date: r.date,
    notes: r.notes ?? undefined,
  };
}

function rowToParent(r: {
  id: string; student_id: string; first_name: string; last_name: string;
  phone: string | null; whatsapp: string | null; email: string | null;
  relationship: string | null; profession: string | null; is_emergency_contact: boolean | null;
}): Parent {
  return {
    id: r.id,
    studentId: r.student_id,
    firstName: r.first_name,
    lastName: r.last_name,
    phone: r.phone ?? undefined,
    whatsapp: r.whatsapp ?? undefined,
    email: r.email ?? undefined,
    relationship: r.relationship ?? undefined,
    profession: r.profession ?? undefined,
    isEmergencyContact: r.is_emergency_contact ?? false,
  };
}

function rowToAnnouncement(r: {
  id: string; title: string; content: string; audience: string;
  author_id: string | null; created_at: string;
  pinned?: boolean | null; target_class_id?: string | null;
}): Announcement {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    audience: (r.audience as Announcement["audience"]) ?? "Tous",
    authorId: r.author_id ?? undefined,
    createdAt: r.created_at,
    pinned: r.pinned ?? false,
    targetClassId: r.target_class_id ?? null,
  };
}

function rowToAcademicYear(r: {
  id: string; name: string; start_date: string | null; end_date: string | null; is_current: boolean;
}): AcademicYear {
  return {
    id: r.id,
    name: r.name,
    startDate: r.start_date ?? undefined,
    endDate: r.end_date ?? undefined,
    isCurrent: r.is_current,
  };
}

// ---- Hydration ----
export async function hydrateAll(schoolId: string): Promise<void> {
  currentSchoolId = schoolId;
  const [
    schoolsRes, classesRes, studentsRes, teachersRes, subjectsRes,
    gradesRes, attendanceRes, feeTypesRes, invoicesRes, paymentRecordsRes,
    parentsRes, announcementsRes, academicYearsRes,
  ] = await Promise.all([
    supabase.from("schools").select("*").eq("id", schoolId),
    supabase.from("classes").select("*").eq("school_id", schoolId),
    supabase.from("students").select("*").eq("school_id", schoolId),
    supabase.from("teachers").select("*").eq("school_id", schoolId),
    supabase.from("class_subjects").select("*").eq("school_id", schoolId),
    supabase.from("grades").select("*").eq("school_id", schoolId),
    supabase.from("attendance").select("*").eq("school_id", schoolId),
    supabase.from("fee_types").select("*").eq("school_id", schoolId),
    supabase.from("invoices").select("*").eq("school_id", schoolId),
    supabase.from("payment_records").select("*").eq("school_id", schoolId),
    supabase.from("parents").select("*").eq("school_id", schoolId),
    supabase.from("announcements").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }),
    supabase.from("academic_years").select("*").eq("school_id", schoolId),
  ]);

  const schools = (schoolsRes.data ?? []).map(rowToSchool);
  const classes = (classesRes.data ?? []).map(rowToClasse);
  const students = (studentsRes.data ?? []).map(rowToStudent);
  const teachers = (teachersRes.data ?? []).map(rowToTeacher);
  const classSubjects = (subjectsRes.data ?? []).map(rowToClassSubject);
  const grades = (gradesRes.data ?? []).map(rowToGrade);
  const attendance = (attendanceRes.data ?? []).map(rowToAttendance);
  const feeTypes = (feeTypesRes.data ?? []).map(rowToFeeType);
  const payments = (invoicesRes.data ?? []).map(rowToInvoice);
  const paymentRecords = (paymentRecordsRes.data ?? []).map(rowToPaymentRecord);
  const parents = (parentsRes.data ?? []).map(rowToParent);
  const announcements = (announcementsRes.data ?? []).map(rowToAnnouncement);
  const academicYears = (academicYearsRes.data ?? []).map(rowToAcademicYear);

  // Backfill student.parentName/Phone/etc from the parents table for legacy UI.
  const parentByStudent = new Map<string, Parent>();
  for (const p of parents) {
    if (!parentByStudent.has(p.studentId)) parentByStudent.set(p.studentId, p);
  }
  for (const s of students) {
    const p = parentByStudent.get(s.id);
    if (p) {
      s.parentName = `${p.firstName} ${p.lastName}`.trim();
      s.parentPhone = p.phone ?? "";
      s.parentEmail = p.email;
      s.parentWhatsapp = p.whatsapp;
      if (p.relationship === "Père" || p.relationship === "Mère" || p.relationship === "Tuteur") {
        s.parentRelation = p.relationship;
      }
    }
  }

  syncing = true;
  try {
    updateDB((db) => {
      db.schools = schools;
      db.classes = classes;
      db.students = students;
      db.teachers = teachers;
      db.classSubjects = classSubjects;
      db.grades = grades;
      db.attendance = attendance;
      db.feeTypes = feeTypes;
      db.payments = payments;
      db.paymentRecords = paymentRecords;
      db.parents = parents;
      db.announcements = announcements;
      db.academicYears = academicYears;
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
      name: s.name, director_name: s.director, email: s.email, phone: s.phone,
      city: s.city, country: s.country, address: s.address ?? null, logo_url: s.logo ?? null,
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

  // Grades
  const gradeDiff = diff(lastSnapshot.grades, current.grades);
  for (const g of gradeDiff.inserted) {
    const { error } = await supabase.from("grades").insert({
      id: g.id, school_id: schoolId, student_id: g.studentId,
      class_id: g.classId || null, subject_id: g.subjectId || null,
      subject: g.subject, term: g.term, evaluation_type: g.evaluationType ?? null,
      grade: g.grade ?? null, devoir1: g.devoir1 ?? null, devoir2: g.devoir2 ?? null,
      composition: g.composition ?? null, value: g.value ?? 0, comment: g.comment ?? null,
    });
    if (error) throw error;
  }
  for (const g of gradeDiff.updated) {
    const { error } = await supabase.from("grades").update({
      student_id: g.studentId, class_id: g.classId || null, subject_id: g.subjectId || null,
      subject: g.subject, term: g.term, evaluation_type: g.evaluationType ?? null,
      grade: g.grade ?? null, devoir1: g.devoir1 ?? null, devoir2: g.devoir2 ?? null,
      composition: g.composition ?? null, value: g.value ?? 0, comment: g.comment ?? null,
    }).eq("id", g.id);
    if (error) throw error;
  }
  for (const id of gradeDiff.deletedIds) {
    const { error } = await supabase.from("grades").delete().eq("id", id);
    if (error) throw error;
  }

  // Attendance
  const attDiff = diff(lastSnapshot.attendance, current.attendance);
  for (const a of attDiff.inserted) {
    const { error } = await supabase.from("attendance").insert({
      id: a.id, school_id: schoolId, student_id: a.studentId, date: a.date, status: a.status,
    });
    if (error) throw error;
  }
  for (const a of attDiff.updated) {
    const { error } = await supabase.from("attendance").update({
      student_id: a.studentId, date: a.date, status: a.status,
    }).eq("id", a.id);
    if (error) throw error;
  }
  for (const id of attDiff.deletedIds) {
    const { error } = await supabase.from("attendance").delete().eq("id", id);
    if (error) throw error;
  }

  // Fee types
  const feeDiff = diff(lastSnapshot.feeTypes, current.feeTypes);
  for (const f of feeDiff.inserted) {
    const { error } = await supabase.from("fee_types").insert({
      id: f.id, school_id: schoolId, name: f.name, amount: f.amount,
      scope: f.scope, due_date: f.dueDate ?? null,
    });
    if (error) throw error;
  }
  for (const f of feeDiff.updated) {
    const { error } = await supabase.from("fee_types").update({
      name: f.name, amount: f.amount, scope: f.scope, due_date: f.dueDate ?? null,
    }).eq("id", f.id);
    if (error) throw error;
  }
  for (const id of feeDiff.deletedIds) {
    const { error } = await supabase.from("fee_types").delete().eq("id", id);
    if (error) throw error;
  }

  // Invoices (payments)
  const invDiff = diff(lastSnapshot.payments, current.payments);
  for (const p of invDiff.inserted) {
    const { error } = await supabase.from("invoices").insert({
      id: p.id, school_id: schoolId, invoice_number: p.invoiceNumber ?? null,
      student_id: p.studentId, fee_type_id: p.feeTypeId || null,
      amount: p.amount, amount_paid: p.amountPaid, date: p.date,
      due_date: p.dueDate ?? null, type: p.type, status: p.status,
      mode: p.mode ?? null, reference: p.reference ?? null, notes: p.notes ?? null,
    });
    if (error) throw error;
  }
  for (const p of invDiff.updated) {
    const { error } = await supabase.from("invoices").update({
      invoice_number: p.invoiceNumber ?? null, student_id: p.studentId,
      fee_type_id: p.feeTypeId || null, amount: p.amount, amount_paid: p.amountPaid,
      date: p.date, due_date: p.dueDate ?? null, type: p.type, status: p.status,
      mode: p.mode ?? null, reference: p.reference ?? null, notes: p.notes ?? null,
    }).eq("id", p.id);
    if (error) throw error;
  }
  for (const id of invDiff.deletedIds) {
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) throw error;
  }

  // Payment records
  const prDiff = diff(lastSnapshot.paymentRecords, current.paymentRecords);
  for (const r of prDiff.inserted) {
    const { error } = await supabase.from("payment_records").insert({
      id: r.id, school_id: schoolId, receipt_number: r.receiptNumber,
      invoice_id: r.invoiceId, student_id: r.studentId, amount: r.amount,
      mode: r.mode, reference: r.reference ?? null, date: r.date, notes: r.notes ?? null,
    });
    if (error) throw error;
  }
  for (const r of prDiff.updated) {
    const { error } = await supabase.from("payment_records").update({
      receipt_number: r.receiptNumber, invoice_id: r.invoiceId, student_id: r.studentId,
      amount: r.amount, mode: r.mode, reference: r.reference ?? null,
      date: r.date, notes: r.notes ?? null,
    }).eq("id", r.id);
    if (error) throw error;
  }
  for (const id of prDiff.deletedIds) {
    const { error } = await supabase.from("payment_records").delete().eq("id", id);
    if (error) throw error;
  }


  // Parents
  const parentDiff = diff(lastSnapshot.parents, current.parents);
  for (const p of parentDiff.inserted) {
    const { error } = await supabase.from("parents").insert({
      id: p.id, school_id: schoolId, student_id: p.studentId,
      first_name: p.firstName, last_name: p.lastName,
      phone: p.phone ?? null, whatsapp: p.whatsapp ?? null, email: p.email ?? null,
      relationship: p.relationship ?? null, profession: p.profession ?? null,
      is_emergency_contact: p.isEmergencyContact ?? false,
    });
    if (error) throw error;
  }
  for (const p of parentDiff.updated) {
    const { error } = await supabase.from("parents").update({
      student_id: p.studentId, first_name: p.firstName, last_name: p.lastName,
      phone: p.phone ?? null, whatsapp: p.whatsapp ?? null, email: p.email ?? null,
      relationship: p.relationship ?? null, profession: p.profession ?? null,
      is_emergency_contact: p.isEmergencyContact ?? false,
    }).eq("id", p.id);
    if (error) throw error;
  }
  for (const id of parentDiff.deletedIds) {
    const { error } = await supabase.from("parents").delete().eq("id", id);
    if (error) throw error;
  }

  // Announcements
  const annDiff = diff(lastSnapshot.announcements, current.announcements);
  for (const a of annDiff.inserted) {
    const { error } = await supabase.from("announcements").insert({
      id: a.id, school_id: schoolId, title: a.title, content: a.content,
      audience: a.audience, author_id: a.authorId ?? null,
      pinned: a.pinned ?? false, target_class_id: a.targetClassId ?? null,
    });
    if (error) throw error;
  }
  for (const a of annDiff.updated) {
    const { error } = await supabase.from("announcements").update({
      title: a.title, content: a.content, audience: a.audience,
      pinned: a.pinned ?? false, target_class_id: a.targetClassId ?? null,
    }).eq("id", a.id);
    if (error) throw error;
  }
  for (const id of annDiff.deletedIds) {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) throw error;
  }

  // Academic years
  const ayDiff = diff(lastSnapshot.academicYears, current.academicYears);
  for (const y of ayDiff.inserted) {
    const { error } = await supabase.from("academic_years").insert({
      id: y.id, school_id: schoolId, name: y.name,
      start_date: y.startDate ?? null, end_date: y.endDate ?? null, is_current: y.isCurrent,
    });
    if (error) throw error;
  }
  for (const y of ayDiff.updated) {
    const { error } = await supabase.from("academic_years").update({
      name: y.name, start_date: y.startDate ?? null, end_date: y.endDate ?? null, is_current: y.isCurrent,
    }).eq("id", y.id);
    if (error) throw error;
  }
  for (const id of ayDiff.deletedIds) {
    const { error } = await supabase.from("academic_years").delete().eq("id", id);
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
