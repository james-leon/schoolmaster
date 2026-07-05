import { useSyncExternalStore } from "react";
import type { DB } from "./types";
import { buildSeed } from "./seed";

const KEY = "schoolmaster_db_v5";


let cache: DB | null = null;
const listeners = new Set<() => void>();
let syncHook: (() => void) | null = null;

/** Register a callback to run after every persist. Used by supabase-sync. */
export function registerPersistHook(fn: () => void) {
  syncHook = fn;
}

function load(): DB {
  if (cache) return cache;
  if (typeof window === "undefined") {
    cache = buildSeed();
    return cache;
  }
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DB;
      if (!parsed.classSubjects) parsed.classSubjects = [];
      if (!parsed.classTeachers) parsed.classTeachers = [];
      if (!parsed.feeTypes) parsed.feeTypes = [];
      if (!parsed.paymentRecords) parsed.paymentRecords = [];
      if (!parsed.parents) parsed.parents = [];
      if (!parsed.announcements) parsed.announcements = [];
      if (!parsed.academicYears) parsed.academicYears = [];
      cache = parsed;
      return cache;
    } catch {
      // fall through to seed
    }
  }
  cache = buildSeed();
  localStorage.setItem(KEY, JSON.stringify(cache));
  return cache;
}

/**
 * Reassign references so React sees changes. CRITICAL: updateDB callers
 * mutate nested arrays in place (d.students.push(...), inv.amountPaid += x),
 * and components everywhere derive lists with useMemo(..., [db.students]).
 * A shallow top-level clone keeps the SAME array references, so those memos
 * never recompute and the UI looks frozen until remount. We must give every
 * top-level array (and each row) a fresh reference on every persist.
 */
function cloneForSnapshot(db: DB): DB {
  const next = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(db as unknown as Record<string, unknown>)) {
    next[k] = Array.isArray(v)
      ? v.map((row) => (row && typeof row === "object" ? { ...(row as object) } : row))
      : v;
  }
  return next as unknown as DB;
}

function persist(opts?: { silent?: boolean }) {
  if (cache) {
    cache = cloneForSnapshot(cache);
    if (typeof window !== "undefined") {
      localStorage.setItem(KEY, JSON.stringify(cache));
    }
  }
  listeners.forEach((l) => l());
  if (!opts?.silent && syncHook) syncHook();
}

export function getDB(): DB {
  return load();
}

export function updateDB(fn: (db: DB) => void) {
  const db = load();
  fn(db);
  persist();
}

/**
 * Like updateDB but does NOT fire the sync hook. Used when applying
 * server-fetched state (hydration): the data came FROM the server, so
 * pushing it back would be a no-op at best and previously left the
 * sync layer's pending flag stuck, silently disabling realtime refresh.
 */
export function hydrateDB(fn: (db: DB) => void) {
  const db = load();
  fn(db);
  persist({ silent: true });
}

export function resetDB() {
  cache = buildSeed();
  persist();
}

/**
 * Wipe the local cache AND its localStorage backing. Use on sign-out and
 * before hydrating a different school to prevent cross-tenant data bleed.
 */
export function clearLocalDB() {
  cache = buildSeed();
  if (typeof window !== "undefined") {
    localStorage.removeItem(KEY);
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, getDB, getDB);
}
