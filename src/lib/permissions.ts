/**
 * TEACHER PERMISSIONS — SINGLE SOURCE OF TRUTH
 * ============================================
 *
 * Defines what a teacher role can and cannot do. Use these helpers
 * everywhere instead of inline `user.role === "teacher"` checks so that
 * future changes don't silently re-grant blocked actions.
 *
 * RLS in the database enforces the same rules — see the policies on:
 *   students, classes, class_subjects, grades, attendance,
 *   discipline_records, invoices, payment_records, fee_types,
 *   transactions, staff, payroll, profiles.
 *
 * TEACHER CAN (allow):
 *   - VIEW their assigned classes only and their students
 *   - VIEW their own timetable, calendar (read-only), announcements
 *     addressed to them, their own profile
 *   - ENTER / EDIT grades for students in their assigned classes
 *   - TAKE / EDIT attendance for their assigned classes
 *   - ADD discipline / behavior observations for their students
 *   - EDIT their own profile + change their own password
 *
 * TEACHER CANNOT (block):
 *   - Create / edit / delete students, parents, accounts, imports
 *   - Create / edit / delete classes, subjects, teacher assignments
 *   - Access Scolarité, Comptabilité, Parents mgmt, Enseignants mgmt,
 *     Personnel, Paramètres, Super Admin, subscriptions
 *   - See other classes' students, grades, attendance, or any
 *     financial data
 */

import type { User, Role } from "./types";

export const isTeacher = (u: User | null | undefined): boolean =>
  u?.role === "teacher";

export const isAdmin = (u: User | null | undefined): boolean =>
  u?.role === "school_admin" || u?.role === "super_admin";

export const isSchoolAdmin = (u: User | null | undefined): boolean =>
  u?.role === "school_admin";

export const isParent = (u: User | null | undefined): boolean =>
  u?.role === "parent";

export const isSuperAdmin = (u: User | null | undefined): boolean =>
  u?.role === "super_admin";

export const isSecretary = (u: User | null | undefined): boolean =>
  u?.role === "secretary";

/** School operational staff: school_admin OR secretary (both work in one school). */
export const isSchoolStaff = (u: User | null | undefined): boolean =>
  u?.role === "school_admin" || u?.role === "secretary";

/**
 * The complete teacher capability matrix. Default = false.
 * Anything not listed here is denied for teachers.
 */
export const TEACHER_CAN = {
  // Students
  viewAssignedStudents: true,
  createStudent: false,
  editStudent: false,
  deleteStudent: false,
  importStudents: false,
  createStudentAccount: false,
  createParentAccount: false,

  // Parents
  viewParentsList: false,
  manageParents: false,

  // Classes / subjects
  viewAssignedClasses: true,
  createClass: false,
  editClass: false,
  deleteClass: false,
  manageSubjects: false,
  assignTeachers: false,

  // Academic work
  enterGrades: true, // limited to their classes (enforced by RLS + scope helper)
  takeAttendance: true,
  addDisciplineNote: true,

  // Finance
  viewFinance: false,
  viewInvoices: false,
  viewPayments: false,
  viewAccounting: false,
  viewFeeAmounts: false,

  // People & admin
  viewTeachersAdmin: false,
  viewPersonnel: false,
  viewPayroll: false,
  viewSettings: false,
  viewSuperAdmin: false,
  manageSubscription: false,

  // Self
  editOwnProfile: true,
  changeOwnPassword: true,
} as const;

export type TeacherCapability = keyof typeof TEACHER_CAN;

/**
 * SECRETARY capability matrix — segregation of duties.
 * Allowed: day-to-day operational admin (students, parents, invoicing,
 * payments, communications, transport affectations, attendance, printing
 * bulletins). Blocked: accounting/budget, personnel/payroll, settings,
 * teacher/secretary management, deletions of financial records.
 */
export const SECRETARY_CAN: Record<TeacherCapability, boolean> = {
  viewAssignedStudents: true,
  createStudent: true,
  editStudent: true,
  deleteStudent: false,
  importStudents: true,
  createStudentAccount: true,
  createParentAccount: true,
  viewParentsList: true,
  manageParents: true,

  viewAssignedClasses: true,
  createClass: false,
  editClass: false,
  deleteClass: false,
  manageSubjects: false,
  assignTeachers: false,

  enterGrades: false,
  takeAttendance: true,
  addDisciplineNote: false,

  viewFinance: true,
  viewInvoices: true,
  viewPayments: true,
  viewAccounting: false,
  viewFeeAmounts: true,

  viewTeachersAdmin: false,
  viewPersonnel: false,
  viewPayroll: false,
  viewSettings: false,
  viewSuperAdmin: false,
  manageSubscription: false,

  editOwnProfile: true,
  changeOwnPassword: true,
};

/**
 * Single permission check. For non-teachers, defaults to true for admin
 * roles and false for parents (since this map is teacher-centric).
 */
export function can(user: User | null | undefined, cap: TeacherCapability): boolean {
  if (!user) return false;
  if (isSuperAdmin(user) || isSchoolAdmin(user)) return true;
  if (isTeacher(user)) return TEACHER_CAN[cap];
  if (isSecretary(user)) return SECRETARY_CAN[cap];
  if (isParent(user)) return cap === "editOwnProfile" || cap === "changeOwnPassword";
  return false;
}

/**
 * Routes a teacher is allowed to visit. Used by the sidebar AND by route
 * guards to keep nav consistent. Keep in sync with NAV_ITEMS in nav.ts.
 */
export const TEACHER_ALLOWED_ROUTES: readonly string[] = [
  "/dashboard",
  "/eleves",
  "/classes",
  "/notes",
  "/presences",
  "/emploi-du-temps",
  "/calendrier",
  "/annonces",
  "/mon-profil",
  "/changer-mot-de-passe",
  "/notifications",
  "/aide",
] as const;

/**
 * SECRETARY_ALLOWED_ROUTES — routes a secretary can visit.
 *
 * International segregation-of-duties model: secretary handles day-to-day
 * operational admin (students, parents, invoicing, communications,
 * transport affectations, calendar, attendance corrections, printing
 * bulletins) but is BLOCKED from accounting, budget, payroll/personnel,
 * teacher management, school parameters, subscription, audit log.
 *
 * Keep in sync with NAV_ITEMS in nav.ts and RLS policies in the DB
 * (see migration adding is_school_secretary).
 */
export const SECRETARY_ALLOWED_ROUTES: readonly string[] = [
  "/dashboard",
  "/eleves",
  "/parents",
  "/classes",           // read only
  "/scolarite",         // invoices + payments (no delete via RLS)
  "/notes",             // read + print bulletins
  "/presences",
  "/emploi-du-temps",   // read
  "/calendrier",
  "/annonces",
  "/transport",         // student affectations only (writes to accounting blocked by RLS)
  "/notifications",
  "/mon-profil",
  "/changer-mot-de-passe",
  "/aide",
] as const;

export function roleCanVisit(role: Role, path: string): boolean {
  if (role === "teacher") {
    return TEACHER_ALLOWED_ROUTES.some((r) => path === r || path.startsWith(`${r}/`));
  }
  if (role === "secretary") {
    return SECRETARY_ALLOWED_ROUTES.some((r) => path === r || path.startsWith(`${r}/`));
  }
  return true;
}
