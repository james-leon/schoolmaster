import { BarChart3, Users, BookOpen, CreditCard, GraduationCap, CalendarCheck, UserCheck, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Tableau de bord", icon: BarChart3 },
  { to: "/eleves", label: "Élèves", icon: Users },
  { to: "/classes", label: "Classes", icon: BookOpen },
  { to: "/scolarite", label: "Scolarité & Paiements", icon: CreditCard },
  { to: "/notes", label: "Notes & Bulletins", icon: GraduationCap },
  { to: "/presences", label: "Présences", icon: CalendarCheck },
  { to: "/enseignants", label: "Enseignants", icon: UserCheck },
  { to: "/parametres", label: "Paramètres", icon: Settings },
];
