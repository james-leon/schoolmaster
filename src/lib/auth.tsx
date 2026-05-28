import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "./types";
import { getDB, updateDB } from "./store";

const SESSION_KEY = "schoolmaster_session";

interface AuthContextType {
  user: User | null;
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
      const id = JSON.parse(raw) as string;
      const u = getDB().users.find((x) => x.id === id);
      if (u) setUser(u);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const u = getDB().users.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password);
    if (!u) throw new Error("Email ou mot de passe incorrect");
    localStorage.setItem(SESSION_KEY, JSON.stringify(u.id));
    setUser(u);
    return u;
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

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
    localStorage.setItem(SESSION_KEY, JSON.stringify(newUser.id));
    setUser(newUser);
    return newUser;
  };

  return <AuthContext.Provider value={{ user, login, logout, registerSchool }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
