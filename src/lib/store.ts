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

function persist() {
  if (cache) {
    // Reassign reference so useSyncExternalStore sees a new snapshot
    cache = { ...cache };
    if (typeof window !== "undefined") {
      localStorage.setItem(KEY, JSON.stringify(cache));
    }
  }
  listeners.forEach((l) => l());
  if (syncHook) syncHook();
}

export function getDB(): DB {
  return load();
}

export function updateDB(fn: (db: DB) => void) {
  const db = load();
  fn(db);
  persist();
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
