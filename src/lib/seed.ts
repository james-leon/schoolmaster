import type { DB, Level } from "./types";

const SCHOOL_ID = "school-1";

const firstNamesM = ["Jean", "Paul", "Emmanuel", "Brice", "Cédric", "Landry", "Hervé", "Yannick", "Aristide", "Steve", "Boris", "Franck", "Ulrich", "Joël", "Patrick"];
const firstNamesF = ["Marie", "Grace", "Larissa", "Nadège", "Sandrine", "Carine", "Vanessa", "Estelle", "Flore", "Chantal", "Mireille", "Audrey", "Reine", "Solange", "Linda"];
const lastNames = ["Nguema", "Mbarga", "Etoa", "Fotso", "Kamga", "Tchoua", "Ndongo", "Biya", "Owona", "Manga", "Essomba", "Atangana", "Mballa", "Ngono", "Tabi", "Eyenga", "Bekolo", "Mvogo", "Onana", "Belinga"];

// Deterministic PRNG (mulberry32) so seed is identical on SSR and client
// — avoids hydration mismatches and duplicate React keys.
let _rngState = 0x12345678;
function rng() {
  let t = (_rngState += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function rand<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
let _uidCounter = 0;
function uid(p: string) {
  _uidCounter += 1;
  return `${p}-${_uidCounter.toString(36).padStart(5, "0")}`;
}


const TEACHERS = [
  { firstName: "Pauline", lastName: "Essomba", subject: "Maternelle", subjects: ["Éveil"] },
  { firstName: "Georges", lastName: "Mbarga", subject: "Mathématiques", subjects: ["Mathématiques", "Sciences"] },
  { firstName: "Christine", lastName: "Fotso", subject: "Français", subjects: ["Français"] },
  { firstName: "Daniel", lastName: "Atangana", subject: "Sciences", subjects: ["Sciences", "Mathématiques"] },
  { firstName: "Rose", lastName: "Ngono", subject: "Anglais", subjects: ["Anglais"] },
  { firstName: "Samuel", lastName: "Owona", subject: "Histoire-Géo", subjects: ["Histoire-Géo"] },
];

const CLASSES: { name: string; level: Level; fees: number; capacity: number }[] = [
  { name: "PS", level: "PS", fees: 120000, capacity: 25 },
  { name: "MS", level: "MS", fees: 130000, capacity: 25 },
  { name: "CP", level: "CP", fees: 150000, capacity: 30 },
  { name: "CE1", level: "CE1", fees: 160000, capacity: 30 },
  { name: "CE2", level: "CE2", fees: 160000, capacity: 30 },
  { name: "CM1", level: "CM1", fees: 170000, capacity: 30 },
  { name: "CM2", level: "CM2", fees: 180000, capacity: 30 },
  { name: "CM2-B", level: "CM2", fees: 180000, capacity: 30 },
];

const SUBJECTS = ["Mathématiques", "Français", "Anglais", "Sciences", "Histoire-Géo", "Éveil"];

export function buildSeed(): DB {
  _rngState = 0x12345678;
  _uidCounter = 0;

  const teachers = TEACHERS.map((t) => ({
    id: uid("teacher"),
    email: `${t.firstName.toLowerCase()}.${t.lastName.toLowerCase()}@queenmary.cm`,
    phone: "+2376" + Math.floor(10000000 + rng() * 89999999),
    ...t,
  }));

  const classes = CLASSES.map((c, i) => ({
    id: uid("class"),
    name: c.name,
    level: c.level,
    fees: c.fees,
    capacity: c.capacity,
    teacherId: teachers[i % teachers.length].id,
  }));

  const students: DB["students"] = [];
  const payments: DB["payments"] = [];
  const grades: DB["grades"] = [];
  const attendance: DB["attendance"] = [];

  for (let i = 0; i < 45; i++) {
    const gender = rng() > 0.5 ? "M" : "F";
    const firstName = gender === "M" ? rand(firstNamesM) : rand(firstNamesF);
    const lastName = rand(lastNames);
    const cls = rand(classes);
    const sid = uid("student");
    const year = 2013 + Math.floor(rng() * 6);
    students.push({
      id: sid,
      code: `EL-2026-${(i + 1).toString().padStart(3, "0")}`,
      firstName,
      lastName,
      gender: gender as "M" | "F",
      classId: cls.id,
      birthDate: `${year}-0${1 + Math.floor(rng() * 8)}-1${Math.floor(rng() * 9)}`,
      parentName: rand(["M.", "Mme"]) + " " + lastName,
      parentPhone: "+2376" + Math.floor(10000000 + rng() * 89999999),
      parentRelation: rand(["Père", "Mère", "Tuteur"]) as "Père" | "Mère" | "Tuteur",
      status: "actif",
      enrolledAt: "2024-09-02",
    });


    // invoices over 3 trimesters
    for (let m = 0; m < 3; m++) {
      const r = rng();
      const total = Math.round(cls.fees / 3);
      const amountPaid = r > 0.8 ? 0 : r > 0.6 ? Math.round(total / 2) : total;
      const status = amountPaid >= total ? "paye" : amountPaid > 0 ? "partiel" : "impaye";
      payments.push({
        id: uid("pay"),
        studentId: sid,
        amount: total,
        amountPaid,
        date: `2025-0${3 + m}-1${Math.floor(rng() * 8)}`,
        type: "Scolarité " + ["1er", "2e", "3e"][m] + " trimestre",
        status,
        mode: amountPaid > 0 ? (rand(["Espèces", "MTN MoMo", "Orange Money"]) as "Espèces" | "MTN MoMo" | "Orange Money") : undefined,
        reference: amountPaid > 0 ? "REF-" + Math.floor(rng() * 100000) : undefined,
      });
    }

    // grades
    SUBJECTS.slice(0, 4).forEach((subject) => {
      const d1 = Math.round((6 + rng() * 13) * 10) / 10;
      const d2 = Math.round((6 + rng() * 13) * 10) / 10;
      const comp = Math.round((6 + rng() * 13) * 10) / 10;
      const moy = Math.round(((d1 + d2 + comp * 2) / 4) * 100) / 100;
      grades.push({ id: uid("grade"), studentId: sid, subject, term: "1er trimestre", devoir1: d1, devoir2: d2, composition: comp, value: moy });
    });

    // attendance last 30 days
    for (let d = 0; d < 30; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      const r = rng();
      const status = r > 0.92 ? "absent" : r > 0.88 ? "retard" : "present";
      attendance.push({ id: uid("att"), studentId: sid, date: date.toISOString().slice(0, 10), status: status as "present" | "absent" | "retard" });
    }
  }

  const activities = [
    { type: "student" as const, text: "Nouvel élève inscrit en CP" },
    { type: "payment" as const, text: "Paiement de 60 000 FCFA reçu" },
    { type: "grade" as const, text: "Notes de Mathématiques saisies (CE2)" },
    { type: "attendance" as const, text: "Présences du jour enregistrées (CM1)" },
    { type: "payment" as const, text: "Facture impayée relancée" },
    { type: "student" as const, text: "Dossier élève mis à jour" },
    { type: "grade" as const, text: "Bulletins du 1er trimestre générés" },
    { type: "attendance" as const, text: "3 absences signalées en MS" },
  ].map((a, i) => {
    const date = new Date();
    date.setHours(date.getHours() - i * 3);
    return { id: uid("act"), ...a, date: date.toISOString() };
  });

  return {
    schools: [{ id: SCHOOL_ID, name: "Groupe Scolaire Bilingue Queen Mary", director: "Mme Pauline Essomba", email: "contact@queenmary.cm", phone: "+237699112233", city: "Douala", country: "Cameroun" }],
    users: [
      { id: "u-admin", name: "Pauline Essomba", email: "admin@queenmary.cm", password: "password", role: "school_admin", schoolId: SCHOOL_ID },
      { id: "u-teacher", name: "Georges Mbarga", email: "prof@queenmary.cm", password: "password", role: "teacher", schoolId: SCHOOL_ID },
      { id: "u-parent", name: "M. Nguema", email: "parent@queenmary.cm", password: "password", role: "parent", schoolId: SCHOOL_ID },
      { id: "u-super", name: "Super Admin", email: "super@schoolmaster.cm", password: "password", role: "super_admin" },
    ],
    teachers,
    classes,
    students,
    payments,
    grades,
    attendance,
    activities,
  };
}

export { SCHOOL_ID };
