import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "./types";
import { getDB, updateDB } from "./store";

const SESSION_KEY = "currentUser";

export const DEMO_ACCOUNTS: { email: string; password: string; user: User }[] = [
  {
    email: "admin@queenmary.cm",
    password: "admin123",
    user: {
      id: "demo-admin-001",
      name: "Pauline Essomba",
      email: "admin@queenmary.cm",
      password: "admin123",
      role: "school_admin",
      avatar: "PE",
      assignedClasses: [],
      assignedSubjects: [],
    },
  },
  {
    email: "prof.martin@queenmary.cm",
    password: "prof123",
    user: {
      id: "demo-teacher-001",
      name: "Georges Mbarga",
      email: "prof.martin@queenmary.cm",
      password: "prof123",
      role: "teacher",
      avatar: "GM",
      assignedClasses: ["CE1", "CE2"],
      assignedSubjects: ["Mathématiques", "Sciences"],
    },
  },
  {
    email: "parent.ekane@gmail.com",
    password: "parent123",
    user: {
      id: "demo-parent-001",
      name: "Marcel Ekane",
      email: "parent.ekane@gmail.com",
      password: "parent123",
      role: "parent",
      avatar: "ME",
      assignedClasses: [],
      assignedSubjects: [],
      studentId: "student-001",
    },
  },
];

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as User;
        // Re-sync from DB if possible
        const fresh = getDB().users.find((x) => x.id === parsed.id);
        setUser(fresh ?? parsed);
      } catch {
        // ignore
      }
    }
  }, []);

  const persist = (u: User | null) => {
    if (u) localStorage.setItem(SESSION_KEY, JSON.stringify(u));
    else localStorage.removeItem(SESSION_KEY);
    setUser(u);
  };

  const login = async (email: string, password: string) => {
    const demo = DEMO_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === email.toLowerCase() && a.password === password,
    );
    if (demo) {
      persist(demo.user);
      return demo.user;
    }
    const u = getDB().users.find(
      (x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password,
    );
    if (!u) throw new Error("Email ou mot de passe incorrect");
    persist(u);
    return u;
  };

  const logout = () => persist(null);

  const registerSchool: AuthContextType["registerSchool"] = async (data) => {
    const existing = getDB().users.find((x) => x.email.toLowerCase() === data.email.toLowerCase());
    if (existing) throw new Error("Un compte existe déjà avec cet email");
    const schoolId = "school-" + Math.random().toString(36).slice(2, 8);
    const newUser: User = {
      id: "u-" + Math.random().toString(36).slice(2, 8),
      name: data.director,
      email: data.email,
      password: data.password,
      role: "school_admin",
      schoolId,
    };
    updateDB((db) => {
      db.schools.push({ id: schoolId, name: data.schoolName, director: data.director, email: data.email, phone: data.phone, city: data.city, country: data.country });
      db.users.push(newUser);
    });
    persist(newUser);
    return newUser;
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, registerSchool }}>
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
  // null = unrestricted (admin/super)
  return null;
}
