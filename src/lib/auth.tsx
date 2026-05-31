import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "./types";
import { getDB } from "./store";
import { supabase } from "@/integrations/supabase/client";
import { hydrateAll, clearHydration, triggerSync, getCurrentSchoolId } from "./supabase-sync";
import { registerPersistHook } from "./store";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  registerSchool: (data: {
    schoolName: string;
    director: string;
    email: string;
    phone: string;
    password: string;
    city: string;
    country: string;
  }) => Promise<User>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Wire the store -> Supabase sync once.
registerPersistHook(() => triggerSync());

type ProfileRow = {
  id: string;
  school_id: string | null;
  full_name: string | null;
  email: string | null;
  role: "school_admin" | "teacher" | "parent" | null;
  avatar_url: string | null;
  assigned_classes: string[] | null;
  assigned_subjects: string[] | null;
  student_id: string | null;
};

function profileToUser(p: ProfileRow): User {
  const name = p.full_name ?? p.email ?? "Utilisateur";
  return {
    id: p.id,
    name,
    email: p.email ?? "",
    password: "",
    role: (p.role ?? "school_admin") as User["role"],
    schoolId: p.school_id ?? undefined,
    assignedClasses: p.assigned_classes ?? [],
    assignedSubjects: p.assigned_subjects ?? [],
    studentId: p.student_id ?? undefined,
    avatar: name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
  };
}

async function loadProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, school_id, full_name, email, role, avatar_url, assigned_classes, assigned_subjects, student_id")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return profileToUser(data as ProfileRow);
}

/** Trigger the idempotent demo seeder. Safe to call on every boot. */
let seedPromise: Promise<void> | null = null;
function ensureSeed(): Promise<void> {
  if (!seedPromise) {
    seedPromise = fetch("/api/public/seed-demo", { method: "POST" })
      .then((r) => {
        if (!r.ok) throw new Error("Seed failed");
      })
      .catch((e) => {
        console.error("[seed] failed", e);
        // Allow retry next time
        seedPromise = null;
      });
  }
  return seedPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Kick off seed on app boot
    ensureSeed();

    // Hydrate session
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const u = await loadProfile(data.session.user.id);
        if (u) {
          setUser(u);
          if (u.schoolId) await hydrateAll(u.schoolId).catch((e) => console.error(e));
        }
      }
      setLoading(false);
    });

    // Subscribe to auth state changes
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const u = await loadProfile(session.user.id);
        if (u) {
          setUser(u);
          if (u.schoolId && u.schoolId !== getCurrentSchoolId()) {
            await hydrateAll(u.schoolId).catch((e) => console.error(e));
          }
        }
      } else {
        setUser(null);
        clearHydration();
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    // Make sure demo accounts exist before the first login attempt.
    await ensureSeed();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === "Invalid login credentials" ? "Email ou mot de passe incorrect" : error.message);
    if (!data.user) throw new Error("Connexion échouée");
    const u = await loadProfile(data.user.id);
    if (!u) throw new Error("Profil introuvable");
    setUser(u);
    if (u.schoolId) await hydrateAll(u.schoolId);
    return u;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    clearHydration();
  };

  const registerSchool: AuthContextType["registerSchool"] = async (data) => {
    const { data: sign, error: signErr } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { full_name: data.director } },
    });
    if (signErr) throw new Error(signErr.message);
    if (!sign.user) throw new Error("Échec de l'inscription");

    // Get the access token from the new session and let the server route
    // create the school + role + profile via the admin client.
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error("Session manquante");

    const res = await fetch("/api/public/register-school", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        schoolName: data.schoolName,
        director: data.director,
        email: data.email,
        phone: data.phone,
        city: data.city,
        country: data.country,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "Échec de l'inscription");
    }
    const { schoolId } = (await res.json()) as { schoolId: string };

    const u = await loadProfile(sign.user.id);
    if (!u) throw new Error("Profil introuvable");
    setUser(u);
    await hydrateAll(schoolId);
    return u;
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, logout, registerSchool }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Returns the list of class IDs visible to the current user (teacher = assigned only). */
export function visibleClassIds(user: User | null): string[] | null {
  if (!user) return [];
  if (user.role === "teacher" && user.assignedClasses?.length) {
    const db = getDB();
    return db.classes
      .filter((c) => user.assignedClasses!.some((a) => c.name === a || c.level === a))
      .map((c) => c.id);
  }
  return null;
}

// Kept for compatibility with components that still import DEMO_ACCOUNTS metadata.
export const DEMO_ACCOUNTS = [
  { email: "admin@queenmary.cm", password: "admin123" },
  { email: "prof.martin@queenmary.cm", password: "prof123" },
  { email: "parent.ekane@gmail.com", password: "parent123" },
];
