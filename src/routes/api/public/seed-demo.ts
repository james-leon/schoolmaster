import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Idempotent demo seeder. Safe to call on every app boot — returns existing IDs
// if the demo school already exists.
export const Route = createFileRoute("/api/public/seed-demo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Gate the seeder behind a server-side secret. Without SEED_SECRET
          // configured, the endpoint refuses every call — including the
          // super-admin bootstrap — to avoid unauthenticated privileged ops.
          const required = process.env.SEED_SECRET;
          if (!required) {
            return Response.json({ error: "Seeding disabled" }, { status: 403 });
          }
          const provided =
            request.headers.get("x-seed-token") ??
            request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
            "";
          if (provided !== required) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }

          await ensureSuperAdmin().catch((e) => console.error("[seed-demo] super admin", e));

          const { data: existing } = await supabaseAdmin
            .from("schools")
            .select("id")
            .eq("name", SCHOOL_NAME)
            .maybeSingle();
          if (existing) {
            return Response.json({ ok: true, schoolId: existing.id, seeded: false });
          }
          const result = await runSeed();
          return Response.json(result);
        } catch (e) {
          console.error("[seed-demo] failed:", e);
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});

const SUPER_ADMIN_EMAIL = "admin@wintek.cm";
const SUPER_ADMIN_NAME = "Wintek Admin";

async function ensureSuperAdmin() {
  const { data: list } = await supabaseAdmin.auth.admin.listUsers();
  const existing = list?.users?.find((x) => x.email?.toLowerCase() === SUPER_ADMIN_EMAIL);
  let uid: string;
  if (existing) {
    uid = existing.id;
  } else {
    // Bootstrap password must come from a secret. If absent, skip creation
    // rather than committing a hardcoded credential to source.
    const bootstrapPassword = process.env.SUPER_ADMIN_PASSWORD;
    if (!bootstrapPassword) {
      console.warn("[seed-demo] SUPER_ADMIN_PASSWORD not set; skipping super admin bootstrap");
      return;
    }
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: SUPER_ADMIN_EMAIL,
      password: bootstrapPassword,
      email_confirm: true,
      user_metadata: { full_name: SUPER_ADMIN_NAME },
    });
    if (error || !created.user) throw error ?? new Error("createUser failed");
    uid = created.user.id;
  }
  // Grant the super_admin role (idempotent) and ensure a profile row exists.
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: uid, role: "super_admin" }, { onConflict: "user_id,role" });
  await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: uid,
        email: SUPER_ADMIN_EMAIL,
        full_name: SUPER_ADMIN_NAME,
        role: "super_admin",
        school_id: null,
        is_active: true,
        must_change_password: false,
      },
      { onConflict: "id" },
    );
}

const SCHOOL_NAME = "Groupe Scolaire Bilingue Queen Mary";

const DEMO_USERS = [
  {
    email: "admin@queenmary.cm",
    password: "admin123",
    full_name: "Pauline Essomba",
    role: "school_admin" as const,
  },
  {
    email: "prof.martin@queenmary.cm",
    password: "prof123",
    full_name: "Georges Mbarga",
    role: "teacher" as const,
    assigned_classes: ["CE1", "CE2"],
    assigned_subjects: ["Mathématiques", "Sciences"],
  },
  {
    email: "parent.ekane@gmail.com",
    password: "parent123",
    full_name: "Marcel Ekane",
    role: "parent" as const,
  },
];

const TEACHERS_SEED = [
  { first_name: "Pauline", last_name: "Essomba", subjects: ["Éveil"] },
  { first_name: "Georges", last_name: "Mbarga", subjects: ["Mathématiques", "Sciences"] },
  { first_name: "Christine", last_name: "Fotso", subjects: ["Français"] },
  { first_name: "Daniel", last_name: "Atangana", subjects: ["Sciences", "Mathématiques"] },
  { first_name: "Rose", last_name: "Ngono", subjects: ["Anglais"] },
  { first_name: "Samuel", last_name: "Owona", subjects: ["Histoire-Géo"] },
];

const CLASSES_SEED: { name: string; level: string; capacity: number }[] = [
  { name: "PS", level: "PS", capacity: 25 },
  { name: "MS", level: "MS", capacity: 25 },
  { name: "CP", level: "CP", capacity: 30 },
  { name: "CE1", level: "CE1", capacity: 30 },
  { name: "CE2", level: "CE2", capacity: 30 },
  { name: "CM1", level: "CM1", capacity: 30 },
  { name: "CM2", level: "CM2", capacity: 30 },
  { name: "CM2-B", level: "CM2", capacity: 30 },
];

const firstNamesM = ["Jean", "Paul", "Emmanuel", "Brice", "Cédric", "Landry", "Hervé", "Yannick"];
const firstNamesF = ["Marie", "Grace", "Larissa", "Nadège", "Sandrine", "Carine", "Vanessa", "Estelle"];
const lastNames = ["Nguema", "Mbarga", "Etoa", "Fotso", "Kamga", "Tchoua", "Ndongo", "Manga", "Essomba", "Atangana"];

const SUBJECTS_MAT = [
  { name: "Éveil", coefficient: 2 },
  { name: "Langage", coefficient: 2 },
  { name: "Activités Manuelles", coefficient: 1 },
  { name: "Anglais", coefficient: 1 },
  { name: "Motricité", coefficient: 1 },
];
const SUBJECTS_PRI = [
  { name: "Français", coefficient: 3 },
  { name: "Mathématiques", coefficient: 3 },
  { name: "Sciences", coefficient: 2 },
  { name: "Histoire-Géographie", coefficient: 2 },
  { name: "Anglais", coefficient: 2 },
];

async function runSeed() {
  // 1) School (idempotent)
  const { data: existingSchool } = await supabaseAdmin
    .from("schools")
    .select("*")
    .eq("name", SCHOOL_NAME)
    .maybeSingle();

  let schoolId: string;
  if (existingSchool) {
    schoolId = existingSchool.id;
  } else {
    const { data: school, error } = await supabaseAdmin
      .from("schools")
      .insert({
        name: SCHOOL_NAME,
        address: "Yassa",
        city: "Douala",
        country: "Cameroun",
        phone: "+237699112233",
        email: "contact@queenmary.cm",
        director_name: "Mme Pauline Essomba",
        subscription_plan: "premium",
      })
      .select()
      .single();
    if (error) throw error;
    schoolId = school.id;
  }

  // 2) Teachers
  const { data: existingTeachers } = await supabaseAdmin
    .from("teachers")
    .select("*")
    .eq("school_id", schoolId);

  let teacherIds: string[] = [];
  if (existingTeachers && existingTeachers.length >= TEACHERS_SEED.length) {
    teacherIds = existingTeachers.map((t) => t.id);
  } else if (!existingTeachers || existingTeachers.length === 0) {
    const rows = TEACHERS_SEED.map((t, i) => ({
      school_id: schoolId,
      first_name: t.first_name,
      last_name: t.last_name,
      email: `${t.first_name.toLowerCase()}.${t.last_name.toLowerCase()}@queenmary.cm`,
      phone: `+23769900${(1000 + i).toString().padStart(4, "0")}`,
      subjects: t.subjects,
      status: "active",
    }));
    const { data, error } = await supabaseAdmin.from("teachers").insert(rows).select();
    if (error) throw error;
    teacherIds = data.map((t) => t.id);
  } else {
    teacherIds = existingTeachers.map((t) => t.id);
  }

  // 3) Classes
  const { data: existingClasses } = await supabaseAdmin
    .from("classes")
    .select("id,name,level")
    .eq("school_id", schoolId);

  let classes: { id: string; name: string; level: string | null }[] = [];
  if (existingClasses && existingClasses.length > 0) {
    classes = existingClasses;
  } else {
    const rows = CLASSES_SEED.map((c, i) => ({
      school_id: schoolId,
      name: c.name,
      level: c.level,
      capacity: c.capacity,
      teacher_id: teacherIds[i % teacherIds.length] ?? null,
    }));
    const { data, error } = await supabaseAdmin.from("classes").insert(rows).select("id,name,level");
    if (error) throw error;
    classes = data;
  }

  // 4) Students
  const { data: existingStudents } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("school_id", schoolId)
    .limit(1);

  let firstStudentId: string | null = existingStudents?.[0]?.id ?? null;
  if (!firstStudentId) {
    const studentRows: Array<{ school_id: string; class_id: string; first_name: string; last_name: string; gender: string; birth_date: string; enrollment_date: string; student_code: string; status: string }> = [];
    for (let i = 0; i < 24; i++) {
      const gender = i % 2 === 0 ? "M" : "F";
      const firstName = gender === "M" ? firstNamesM[i % firstNamesM.length] : firstNamesF[i % firstNamesF.length];
      const lastName = lastNames[i % lastNames.length];
      const cls = classes[i % classes.length];
      const year = 2013 + (i % 6);
      studentRows.push({
        school_id: schoolId,
        class_id: cls.id,
        first_name: firstName,
        last_name: lastName,
        gender,
        birth_date: `${year}-0${1 + (i % 8)}-1${i % 9}`,
        enrollment_date: "2024-09-02",
        student_code: `EL-2026-${(i + 1).toString().padStart(3, "0")}`,
        status: "active",
      });
    }
    const { data, error } = await supabaseAdmin.from("students").insert(studentRows).select("id");
    if (error) throw error;
    firstStudentId = data[0]?.id ?? null;
  }

  // 5) Class subjects
  const { data: existingSubjects } = await supabaseAdmin
    .from("class_subjects")
    .select("id")
    .eq("school_id", schoolId)
    .limit(1);

  if (!existingSubjects || existingSubjects.length === 0) {
    const subjectRows: Array<{ school_id: string; class_id: string; name: string; coefficient: number; teacher_id: string | null }> = [];
    classes.forEach((cls) => {
      const list = cls.level === "PS" || cls.level === "MS" ? SUBJECTS_MAT : SUBJECTS_PRI;
      list.forEach((s, i) => {
        subjectRows.push({
          school_id: schoolId,
          class_id: cls.id,
          name: s.name,
          coefficient: s.coefficient,
          teacher_id: teacherIds[i % teacherIds.length] ?? null,
        });
      });
    });
    if (subjectRows.length > 0) {
      const { error } = await supabaseAdmin.from("class_subjects").insert(subjectRows);
      if (error) throw error;
    }
  }

  // 6) Auth users + profiles + roles
  for (const u of DEMO_USERS) {
    // Try to find existing user
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const existing = list?.users?.find((x) => x.email?.toLowerCase() === u.email);
    let userId: string;
    if (existing) {
      userId = existing.id;
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name },
      });
      if (error) throw error;
      userId = created.user.id;
    }

    // Upsert profile
    const profilePatch: {
      id: string;
      school_id: string;
      full_name: string;
      email: string;
      role: "school_admin" | "teacher" | "parent";
      assigned_classes: string[];
      assigned_subjects: string[];
      student_id?: string;
    } = {
      id: userId,
      school_id: schoolId,
      full_name: u.full_name,
      email: u.email,
      role: u.role,
      assigned_classes: ("assigned_classes" in u ? u.assigned_classes : []) ?? [],
      assigned_subjects: ("assigned_subjects" in u ? u.assigned_subjects : []) ?? [],
    };
    if (u.role === "parent" && firstStudentId) {
      profilePatch.student_id = firstStudentId;
    }
    const { error: pErr } = await supabaseAdmin.from("profiles").upsert([profilePatch], { onConflict: "id" });
    if (pErr) throw pErr;

    // Upsert role (unique on user_id, role)
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: u.role }, { onConflict: "user_id,role" });
  }

  return { ok: true, schoolId };
}
