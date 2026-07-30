import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "./types";
import { getDB, clearLocalDB } from "./store";
import { supabase } from "@/integrations/supabase/client";
import { hydrateAll, clearHydration, triggerSync, getCurrentSchoolId, isSyncActive } from "./supabase-sync";
import { registerPersistHook } from "./store";
import { getImpersonatedSchoolId, setImpersonatedSchoolId } from "./super-admin-api";
import { setAppLanguage, type AppLanguage } from "./i18n";

// Tables owned by the local optimistic store. When any of these changes on
// the server (another tab, another user, or a server-side write), we
// re-hydrate so the UI reflects the true current state without waiting for
// the user to navigate away and back.
const LOCAL_STORE_TABLES = [
  "schools", "classes", "students", "teachers",
  "class_subjects", "class_teachers",
  "grades", "attendance",
  "fee_types", "invoices", "payment_records",
  "parents", "announcements", "academic_years",
] as const;

interface AuthContextType {
  user: User | null;
  /** When super_admin is impersonating, this is the real super_admin user. */
  originalUser: User | null;
  isImpersonating: boolean;
  stopImpersonating: () => void;
  startImpersonating: (schoolId: string) => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

registerPersistHook(() => triggerSync());

type ProfileRow = {
  id: string;
  school_id: string | null;
  full_name: string | null;
  email: string | null;
  role: "school_admin" | "teacher" | "parent" | "super_admin" | null;
  avatar_url: string | null;
  assigned_classes: string[] | null;
  assigned_subjects: string[] | null;
  student_id: string | null;
  student_ids: string[] | null;
  must_change_password: boolean | null;
  is_active: boolean | null;
};

function profileToUser(p: ProfileRow): User {
  const name = p.full_name ?? p.email ?? "Utilisateur";
  return {
    id: p.id,
    name,
    email: p.email ?? "",
    role: (p.role ?? "school_admin") as User["role"],
    schoolId: p.school_id ?? undefined,
    assignedClasses: p.assigned_classes ?? [],
    assignedSubjects: p.assigned_subjects ?? [],
    studentId: p.student_id ?? undefined,
    studentIds: p.student_ids ?? [],
    mustChangePassword: !!p.must_change_password,
    isActive: p.is_active !== false,
    avatar: name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
  };
}

async function loadProfile(userId: string): Promise<User | null> {
  // 1) Try profiles table
  const { data } = await supabase
    .from("profiles")
    .select("id, school_id, full_name, email, role, avatar_url, assigned_classes, assigned_subjects, student_id, student_ids, must_change_password, is_active, language")
    .eq("id", userId)
    .maybeSingle();

  // 2) Fall back to user_roles for the super_admin case (super admin has no
  //    school-scoped profile row when first created).
  if (data) {
    const user = profileToUser(data as ProfileRow);
    const savedLang = (data as { language?: string }).language;
    // Reconcile language: an explicit local choice (e.g. picked on the login
    // page before signing in) is the user's most recent intent and wins over
    // whatever is stored on the profile. Persist it back so future logins
    // and other devices pick it up. Otherwise, apply the saved profile lang.
    let localLang: string | null = null;
    try { localLang = typeof window !== "undefined" ? window.localStorage.getItem("sm.language") : null; } catch {}
    if (localLang === "fr" || localLang === "en") {
      setAppLanguage(localLang as AppLanguage);
      if (savedLang !== localLang) {
        supabase.from("profiles").update({ language: localLang }).eq("id", userId).then(() => {});
      }
    } else if (savedLang === "fr" || savedLang === "en") {
      setAppLanguage(savedLang as AppLanguage);
    }
    if (user.role && user.role !== "school_admin" && user.role !== "teacher" && user.role !== "parent" && user.role !== "super_admin" && user.role !== "secretary") {
      // unknown role — fall through to role lookup
    } else {
      return user;
    }
  }
  const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  if (roleRow?.role === "super_admin") {
    const { data: authUser } = await supabase.auth.getUser();
    const email = authUser.user?.email ?? "";
    const name = (authUser.user?.user_metadata as any)?.full_name ?? email;
    return {
      id: userId, name, email, role: "super_admin",
      mustChangePassword: false, isActive: true,
      avatar: (name as string).split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
    };
  }
  return null;
}

// The demo seeder is gated server-side behind SEED_SECRET and is no longer
// invoked from the client. Seeding is an operator action, not something
// triggered by visiting the app or logging in.


/** Apply an active impersonation, if any. Returns the effective user. */
function applyImpersonation(realUser: User): User {
  if (realUser.role !== "super_admin") return realUser;
  const impSchoolId = getImpersonatedSchoolId();
  if (!impSchoolId) return realUser;
  return {
    ...realUser,
    role: "school_admin",
    schoolId: impSchoolId,
    mustChangePassword: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [originalUser, setOriginalUser] = useState<User | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const installUser = async (real: User | null) => {
    setOriginalUser(real);
    if (!real) { setUser(null); return; }
    const effective = applyImpersonation(real);
    setUser(effective);
    if (effective.schoolId && effective.schoolId !== getCurrentSchoolId()) {
      clearLocalDB();
      hydrateAll(effective.schoolId).catch((e) => console.error("[hydrate]", e));
    }
    // Stamp school activity (anti-churn signal). Only for real school users;
    // super_admin impersonating another school still bumps that school.
    if (real.role !== "super_admin" || effective.schoolId) {
      supabase.rpc("touch_school_activity").then(({ error }) => {
        if (error) console.warn("[touch_school_activity]", error.message);
      });
    }
  };


  useEffect(() => {
    // Demo seeding is no longer auto-triggered on app boot (security).
    let cancelled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setOriginalUser(null);
        clearHydration();
        clearLocalDB();
        setImpersonatedSchoolId(null);
        return;
      }
      const uid = session.user.id;
      setTimeout(async () => {
        if (cancelled) return;
        try {
          const u = await loadProfile(uid);
          if (!u || cancelled) return;
          await installUser(u);
        } catch (e) { console.error("[auth] profile load failed", e); }
      }, 0);
    });

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (data.session?.user) {
        try {
          const u = await loadProfile(data.session.user.id);
          if (u && !cancelled) await installUser(u);
        } catch (e) { console.error(e); }
      }
      setLoading(false);
    });

    return () => { cancelled = true; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global realtime rehydration for local-store tables. Whenever any of
  // these tables changes on the server for our school (from another tab,
  // another user, or a server-side trigger), refetch so useDB() reflects
  // it immediately — no manual refresh, no navigate-away-and-back.
  useEffect(() => {
    const schoolId = user?.schoolId;
    if (!schoolId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const rehydrate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // Never overwrite an in-flight local write.
        if (isSyncActive()) { rehydrate(); return; }
        if (getCurrentSchoolId() !== schoolId) return;
        hydrateAll(schoolId).catch((e) => console.warn("[rehydrate]", e));
      }, 600);
    };
    const channel = supabase.channel(`store-rt-${schoolId}`);
    type PgChangesOn = {
      on: (
        type: string,
        filter: { event: string; schema: string; table: string; filter: string },
        cb: () => void,
      ) => unknown;
    };
    for (const table of LOCAL_STORE_TABLES) {
      // `schools` is the tenant root: it has no school_id column, its own id
      // IS the school id. An invalid filter column breaks the whole channel.
      const filter = table === "schools" ? `id=eq.${schoolId}` : `school_id=eq.${schoolId}`;
      (channel as unknown as PgChangesOn).on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        rehydrate,
      );
    }
    channel.subscribe((status, err) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[store-rt] channel", status, err?.message);
      }
    });
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [user?.schoolId]);


  const login = async (email: string, password: string): Promise<User> => {
    const { withTimeoutRetry } = await import("@/lib/connection-friendly");

    // Server-enforced rate-limited login endpoint.
    const res = await withTimeoutRetry(
      () =>
        fetch("/api/public/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        }),
      { timeoutMs: 25000, retries: 1 },
    );
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string;
      access_token?: string;
      refresh_token?: string;
    };
    if (!res.ok || !payload.access_token || !payload.refresh_token) {
      throw new Error(payload.error || "Email ou mot de passe incorrect");
    }

    const { data: setData, error: setErr } = await supabase.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    });
    if (setErr || !setData.user) throw new Error("Connexion échouée");

    const u = await withTimeoutRetry(() => loadProfile(setData.user!.id), { timeoutMs: 20000, retries: 1 });
    if (!u) throw new Error("Profil introuvable");

    // Block suspended schools (for school members, not super admin)
    if (u.role !== "super_admin" && u.schoolId) {
      const { data: school } = await supabase.from("schools").select("status").eq("id", u.schoolId).maybeSingle();
      if (school?.status === "suspended") {
        await supabase.auth.signOut();
        throw new Error("Compte suspendu. Contactez Wintek : +237 690 72 23 16 / +237 675 86 72 45 — wintek2021@gmail.com");
      }
    }

    // Clear any leftover impersonation on a fresh login.
    setImpersonatedSchoolId(null);
    await installUser(u);
    return applyImpersonation(u);
  };

  const logout = async () => {
    setImpersonatedSchoolId(null);
    await supabase.auth.signOut();
    setUser(null);
    setOriginalUser(null);
    clearHydration();
    clearLocalDB();
    // Reset cached identity used by audit logging so the next signed-in
    // user doesn't inherit the previous user's name.
    import("./audit").then((m) => m.invalidateAuditIdentity()).catch(() => {});
  };

  const startImpersonating = async (schoolId: string) => {
    if (!originalUser || originalUser.role !== "super_admin") {
      throw new Error("Action réservée au super administrateur");
    }
    setImpersonatedSchoolId(schoolId);
    clearLocalDB();
    const effective: User = { ...originalUser, role: "school_admin", schoolId, mustChangePassword: false };
    setUser(effective);
    await hydrateAll(schoolId);
  };

  const stopImpersonating = () => {
    setImpersonatedSchoolId(null);
    clearLocalDB();
    clearHydration();
    if (originalUser) setUser(originalUser);
  };

  const refreshUser = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      const u = await loadProfile(data.session.user.id);
      if (u) await installUser(u);
    }
  };

  const isImpersonating = !!(originalUser && originalUser.role === "super_admin" && user && user.id === originalUser.id && user.role !== "super_admin");

  return (
    <AuthContext.Provider value={{
      user, originalUser, isImpersonating, startImpersonating, stopImpersonating,
      isAuthenticated: !!user, loading, login, logout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

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

// DEMO_ACCOUNTS removed: hard-coded credentials must not ship in the client bundle.
