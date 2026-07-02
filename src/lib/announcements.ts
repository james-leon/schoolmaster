import { useEffect, useState } from "react";
import type { Announcement, Role } from "./types";

export interface AudienceContext {
  /** For parents: the class IDs of their children */
  classIds?: string[];
}

export function visibleAnnouncements(
  all: Announcement[],
  role: Role | undefined,
  ctx: AudienceContext = {},
): Announcement[] {
  const classIds = new Set(ctx.classIds ?? []);
  const filtered = all.filter((a) => {
    // School admin & super_admin see everything for their school
    if (role === "school_admin" || role === "super_admin" || role === "secretary") return true;
    if (role === "teacher") {
      return a.audience === "Tous" || a.audience === "Enseignants";
    }
    if (role === "parent") {
      if (a.audience === "Tous" || a.audience === "Parents") return true;
      if (a.audience === "Classe" && a.targetClassId && classIds.has(a.targetClassId)) return true;
      return false;
    }
    return false;
  });
  return filtered.sort((a, b) => {
    // Pinned first, then newest first
    const pa = a.pinned ? 1 : 0;
    const pb = b.pinned ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function formatDateFr(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

const LAST_SEEN_KEY = "schoolmaster_announcements_last_seen";

export function getLastSeen(): number {
  if (typeof window === "undefined") return 0;
  const v = localStorage.getItem(LAST_SEEN_KEY);
  return v ? Number(v) || 0 : 0;
}

export function markAllSeen() {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
  window.dispatchEvent(new Event("announcements:seen"));
}

export function useUnreadCount(announcements: Announcement[]): number {
  const [lastSeen, setLastSeen] = useState<number>(() => getLastSeen());
  useEffect(() => {
    const onSeen = () => setLastSeen(getLastSeen());
    window.addEventListener("announcements:seen", onSeen);
    window.addEventListener("storage", onSeen);
    return () => {
      window.removeEventListener("announcements:seen", onSeen);
      window.removeEventListener("storage", onSeen);
    };
  }, []);
  return announcements.filter((a) => new Date(a.createdAt).getTime() > lastSeen).length;
}
