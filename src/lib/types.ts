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
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  gender: "M" | "F";
  classId: string;
  birthDate: string;
  parentName: string;
  parentPhone: string;
  enrolledAt: string;
}

export interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  subject: string;
}

export interface Payment {
  id: string;
  studentId: string;
  amount: number;
  date: string;
  type: string;
  status: "paye" | "impaye" | "partiel";
}

export interface Grade {
  id: string;
  studentId: string;
  subject: string;
  value: number;
  term: string;
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
