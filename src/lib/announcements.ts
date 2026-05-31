import { useEffect, useState } from "react";
import type { Announcement, Role } from "./types";

export function audienceFor(role: Role | undefined): Announcement["audience"][] {
  if (role === "teacher") return ["Tous", "Enseignants"];
  if (role === "parent") return ["Tous", "Parents"];
  return ["Tous", "Enseignants", "Parents"]; // admins see everything
}

export function visibleAnnouncements(all: Announcement[], role: Role | undefined): Announcement[] {
  const allow = new Set(audienceFor(role));
  return [...all]
    .filter((a) => allow.has(a.audience))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
