import { BarChart3, Users, BookOpen, CreditCard, GraduationCap, CalendarCheck, UserCheck, Settings, Megaphone, Calendar, type LucideIcon } from "lucide-react";
import type { Role } from "./types";
import type { FeatureId } from "./plans";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
  /** Feature required by the school's plan — shows lock if missing. */
  feature?: FeatureId;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Tableau de bord", icon: BarChart3, roles: ["super_admin", "school_admin", "teacher"] },
  { to: "/eleves", label: "Élèves", icon: Users, roles: ["super_admin", "school_admin", "teacher"] },
  { to: "/classes", label: "Classes", icon: BookOpen, roles: ["super_admin", "school_admin", "teacher"] },
  { to: "/scolarite", label: "Scolarité & Paiements", icon: CreditCard, roles: ["super_admin", "school_admin"] },
  { to: "/notes", label: "Notes & Bulletins", icon: GraduationCap, roles: ["super_admin", "school_admin", "teacher"] },
  { to: "/presences", label: "Présences", icon: CalendarCheck, roles: ["super_admin", "school_admin", "teacher"] },
  { to: "/annonces", label: "Annonces", icon: Megaphone, roles: ["super_admin", "school_admin", "teacher"], feature: "announcements" },
  { to: "/enseignants", label: "Enseignants", icon: UserCheck, roles: ["super_admin", "school_admin"] },
  { to: "/parametres", label: "Paramètres", icon: Settings, roles: ["super_admin", "school_admin"] },
];

export function allowedRoutes(role: Role): string[] {
  const base = NAV_ITEMS.filter((n) => !n.roles || n.roles.includes(role)).map((n) => n.to);
  if (role === "school_admin" || role === "super_admin") base.push("/mon-abonnement");
  return base;
}
