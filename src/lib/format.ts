export function fcfa(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Administrateur",
  school_admin: "Administrateur",
  teacher: "Enseignant",
  parent: "Parent",
  secretary: "Secrétaire",
};
