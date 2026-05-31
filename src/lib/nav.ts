import { BarChart3, Users, BookOpen, CreditCard, GraduationCap, CalendarCheck, UserCheck, Settings, Megaphone, type LucideIcon } from "lucide-react";
import type { Role } from "./types";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[]; // if omitted, visible to all authenticated non-parent roles
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Tableau de bord", icon: BarChart3, roles: ["super_admin", "school_admin", "teacher"] },
  { to: "/eleves", label: "Élèves", icon: Users, roles: ["super_admin", "school_admin", "teacher"] },
  { to: "/classes", label: "Classes", icon: BookOpen, roles: ["super_admin", "school_admin", "teacher"] },
  { to: "/scolarite", label: "Scolarité & Paiements", icon: CreditCard, roles: ["super_admin", "school_admin"] },
  { to: "/notes", label: "Notes & Bulletins", icon: GraduationCap, roles: ["super_admin", "school_admin", "teacher"] },
  { to: "/presences", label: "Présences", icon: CalendarCheck, roles: ["super_admin", "school_admin", "teacher"] },
  { to: "/annonces", label: "Annonces", icon: Megaphone, roles: ["super_admin", "school_admin", "teacher"] },
  { to: "/enseignants", label: "Enseignants", icon: UserCheck, roles: ["super_admin", "school_admin"] },
  { to: "/parametres", label: "Paramètres", icon: Settings, roles: ["super_admin", "school_admin"] },
];

/** Routes a given role is allowed to visit (besides /login, /unauthorized, /parent, public). */
export function allowedRoutes(role: Role): string[] {
  return NAV_ITEMS.filter((n) => !n.roles || n.roles.includes(role)).map((n) => n.to);
}
