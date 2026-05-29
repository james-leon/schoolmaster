export type Role = "super_admin" | "school_admin" | "teacher" | "parent";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  schoolId?: string;
}

export interface School {
  id: string;
  name: string;
  director: string;
  email: string;
  phone: string;
  city: string;
  country: string;
}

export type Level = "PS" | "MS" | "CP" | "CE1" | "CE2" | "CM1" | "CM2";

export interface Classe {
  id: string;
  name: string;
  level: Level;
  teacherId: string;
  fees: number;
  capacity: number;
}

export type StudentStatus = "actif" | "inactif" | "transfere";
export type ParentRelation = "Père" | "Mère" | "Tuteur";

export interface Student {
  id: string;
  code?: string;
  firstName: string;
  lastName: string;
  gender: "M" | "F";
  classId: string;
  birthDate: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  parentRelation?: ParentRelation;
  parentWhatsapp?: string;
  status?: StudentStatus;
  photo?: string; // data URL
  enrolledAt: string;
}

export const STUDENT_STATUSES: { value: StudentStatus; label: string }[] = [
  { value: "actif", label: "Actif" },
  { value: "inactif", label: "Inactif" },
  { value: "transfere", label: "Transféré" },
];
export const PARENT_RELATIONS: ParentRelation[] = ["Père", "Mère", "Tuteur"];


export interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  subject: string;
  subjects: string[];
}

export type PaymentStatus = "paye" | "impaye" | "partiel" | "retard";
export type PaymentMode = "Espèces" | "MTN MoMo" | "Orange Money";

export interface Payment {
  id: string;
  studentId: string;
  amount: number; // total invoice amount
  amountPaid: number;
  date: string; // invoice / last payment date
  dueDate?: string;
  type: string;
  status: PaymentStatus;
  mode?: PaymentMode;
  reference?: string;
}

export interface Grade {
  id: string;
  studentId: string;
  subject: string;
  term: string;
  devoir1?: number;
  devoir2?: number;
  composition?: number;
  value: number; // moyenne
}

export interface Attendance {
  id: string;
  studentId: string;
  date: string;
  status: "present" | "absent" | "retard";
}

export interface Activity {
  id: string;
  type: "student" | "payment" | "grade" | "attendance";
  text: string;
  date: string;
}

export interface DB {
  users: User[];
  schools: School[];
  classes: Classe[];
  students: Student[];
  teachers: Teacher[];
  payments: Payment[];
  grades: Grade[];
  attendance: Attendance[];
  activities: Activity[];
}

export const SUBJECTS = ["Mathématiques", "Français", "Anglais", "Sciences", "Histoire-Géo", "Éveil"] as const;
export const TERMS = ["1er trimestre", "2e trimestre", "3e trimestre"] as const;
export const LEVELS: Level[] = ["PS", "MS", "CP", "CE1", "CE2", "CM1", "CM2"];
export const PAYMENT_MODES: PaymentMode[] = ["Espèces", "MTN MoMo", "Orange Money"];

export function computeMoyenne(g: Pick<Grade, "devoir1" | "devoir2" | "composition">): number {
  const vals: number[] = [];
  if (g.devoir1 != null) vals.push(g.devoir1);
  if (g.devoir2 != null) vals.push(g.devoir2);
  if (g.composition != null) vals.push(g.composition, g.composition); // composition double-weighted
  if (!vals.length) return 0;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100;
}

export function deriveInvoiceStatus(amount: number, amountPaid: number, dueDate?: string): PaymentStatus {
  if (amountPaid >= amount && amount > 0) return "paye";
  if (amountPaid > 0 && amountPaid < amount) return "partiel";
  if (dueDate && new Date(dueDate) < new Date() && amountPaid < amount) return "retard";
  return "impaye";
}
