export type Role = "super_admin" | "school_admin" | "teacher" | "parent";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  schoolId?: string;
  assignedClasses?: string[];
  assignedSubjects?: string[];
  studentId?: string;
  avatar?: string;
}

export interface School {
  id: string;
  name: string;
  director: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  address?: string;
  logo?: string;
}

export interface Parent {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  relationship?: string;
  profession?: string;
  isEmergencyContact?: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  audience: "Tous" | "Parents" | "Enseignants";
  authorId?: string;
  createdAt: string;
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
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
  photo?: string;
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
export type PaymentMode = "Espèces" | "MTN Mobile Money" | "Orange Money" | "Virement bancaire" | "Chèque";

export interface Payment {
  id: string;
  invoiceNumber?: string;
  studentId: string;
  feeTypeId?: string;
  amount: number;
  amountPaid: number;
  date: string;
  dueDate?: string;
  type: string;
  status: PaymentStatus;
  mode?: PaymentMode;
  reference?: string;
  notes?: string;
}

export type FeeLevelScope = "Tous" | "Maternelle" | "Primaire";
export interface FeeType {
  id: string;
  name: string;
  amount: number;
  scope: FeeLevelScope;
  dueDate?: string;
}

export interface PaymentRecord {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  studentId: string;
  amount: number;
  mode: PaymentMode;
  reference?: string;
  date: string;
  notes?: string;
}

export type EvaluationType = "Devoir 1" | "Devoir 2" | "Composition" | "Oral" | "Examen";

export interface Grade {
  id: string;
  studentId: string;
  classId?: string;
  subject: string;
  subjectId?: string;
  term: string;
  evaluationType?: EvaluationType;
  grade?: number;
  comment?: string;
  createdAt?: string;
  devoir1?: number;
  devoir2?: number;
  composition?: number;
  value: number;
}

export const EVALUATION_TYPES: EvaluationType[] = ["Devoir 1", "Devoir 2", "Composition", "Oral", "Examen"];

export function gradeValue(g: Grade): number {
  if (g.evaluationType != null) return g.grade ?? 0;
  return g.value || computeMoyenne(g);
}

export function appreciationFor(n: number): { label: string; cls: string } {
  if (n >= 16) return { label: "Très bien", cls: "bg-success/15 text-success" };
  if (n >= 14) return { label: "Bien", cls: "bg-secondary/15 text-secondary" };
  if (n >= 12) return { label: "Assez bien", cls: "bg-teal-500/15 text-teal-600 dark:text-teal-400" };
  if (n >= 10) return { label: "Passable", cls: "bg-accent/15 text-accent" };
  return { label: "Insuffisant", cls: "bg-destructive/15 text-destructive" };
}

export function mentionFor(n: number): string {
  if (n >= 16) return "Félicitations";
  if (n >= 14) return "Très Bien";
  if (n >= 12) return "Bien";
  if (n >= 10) return "Passable";
  return "À améliorer";
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

export interface ClassSubject {
  id: string;
  classId: string;
  name: string;
  coefficient: number;
  teacherId?: string;
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
  classSubjects: ClassSubject[];
  feeTypes: FeeType[];
  paymentRecords: PaymentRecord[];
  parents: Parent[];
  announcements: Announcement[];
  academicYears: AcademicYear[];
}

export const DEFAULT_SUBJECTS_MATERNELLE: { name: string; coefficient: number }[] = [
  { name: "Éveil", coefficient: 2 },
  { name: "Langage", coefficient: 2 },
  { name: "Activités Manuelles", coefficient: 1 },
  { name: "Anglais", coefficient: 1 },
  { name: "Motricité", coefficient: 1 },
];

export const DEFAULT_SUBJECTS_PRIMAIRE: { name: string; coefficient: number }[] = [
  { name: "Français", coefficient: 3 },
  { name: "Mathématiques", coefficient: 3 },
  { name: "Sciences", coefficient: 2 },
  { name: "Histoire-Géographie", coefficient: 2 },
  { name: "Anglais", coefficient: 2 },
  { name: "Education Civique", coefficient: 1 },
  { name: "Dessin/Art", coefficient: 1 },
  { name: "Education Physique", coefficient: 1 },
];

export const DEFAULT_FEE_TYPES: Omit<FeeType, "id">[] = [
  { name: "Inscription", amount: 25000, scope: "Tous" },
  { name: "Scolarité T1", amount: 45000, scope: "Tous" },
  { name: "Scolarité T2", amount: 45000, scope: "Tous" },
  { name: "Scolarité T3", amount: 45000, scope: "Tous" },
  { name: "Cantine", amount: 15000, scope: "Tous" },
  { name: "Transport", amount: 20000, scope: "Tous" },
];

export const SUBJECTS = ["Mathématiques", "Français", "Anglais", "Sciences", "Histoire-Géo", "Éveil"] as const;
export const TERMS = ["1er trimestre", "2e trimestre", "3e trimestre"] as const;
export const LEVELS: Level[] = ["PS", "MS", "CP", "CE1", "CE2", "CM1", "CM2"];
export const PAYMENT_MODES: PaymentMode[] = ["Espèces", "MTN Mobile Money", "Orange Money", "Virement bancaire", "Chèque"];
export const FEE_SCOPES: FeeLevelScope[] = ["Tous", "Maternelle", "Primaire"];

export function computeMoyenne(g: Pick<Grade, "devoir1" | "devoir2" | "composition">): number {
  const vals: number[] = [];
  if (g.devoir1 != null) vals.push(g.devoir1);
  if (g.devoir2 != null) vals.push(g.devoir2);
  if (g.composition != null) vals.push(g.composition, g.composition);
  if (!vals.length) return 0;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100;
}

export function deriveInvoiceStatus(amount: number, amountPaid: number, dueDate?: string): PaymentStatus {
  if (amountPaid >= amount && amount > 0) return "paye";
  const overdue = dueDate ? new Date(dueDate) < new Date(new Date().toDateString()) : false;
  if (amountPaid > 0 && amountPaid < amount) return overdue ? "retard" : "partiel";
  if (overdue) return "retard";
  return "impaye";
}

export function amountInWords(n: number): string {
  const units = ["zéro","un","deux","trois","quatre","cinq","six","sept","huit","neuf","dix","onze","douze","treize","quatorze","quinze","seize","dix-sept","dix-huit","dix-neuf"];
  const tens = ["","","vingt","trente","quarante","cinquante","soixante","soixante","quatre-vingt","quatre-vingt"];
  function below1000(num: number): string {
    if (num === 0) return "";
    if (num < 20) return units[num];
    if (num < 100) {
      const t = Math.floor(num / 10), u = num % 10;
      if (t === 7 || t === 9) {
        return tens[t] + "-" + units[10 + u];
      }
      if (u === 0) return tens[t] + (t === 8 ? "s" : "");
      if (u === 1 && t !== 8) return tens[t] + " et un";
      return tens[t] + "-" + units[u];
    }
    const h = Math.floor(num / 100), r = num % 100;
    const hPart = h === 1 ? "cent" : units[h] + " cent" + (r === 0 && h > 1 ? "s" : "");
    return r === 0 ? hPart : hPart + " " + below1000(r);
  }
  if (n === 0) return "zéro francs CFA";
  const million = Math.floor(n / 1_000_000);
  const thousand = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (million) parts.push((million === 1 ? "un" : below1000(million)) + " million" + (million > 1 ? "s" : ""));
  if (thousand) parts.push((thousand === 1 ? "" : below1000(thousand) + " ") + "mille");
  if (rest) parts.push(below1000(rest));
  return parts.join(" ").replace(/\s+/g, " ").trim() + " francs CFA";
}
