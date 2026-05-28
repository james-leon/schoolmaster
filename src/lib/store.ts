import { useSyncExternalStore } from "react";
import type { DB } from "./types";
import { buildSeed } from "./seed";

const KEY = "schoolmaster_db_v1";

let cache: DB | null = null;
const listeners = new Set<() => void>();

function load(): DB {
  if (cache) return cache;
  if (typeof window === "undefined") {
    cache = buildSeed();
    return cache;
  }
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      cache = JSON.parse(raw) as DB;
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
  if (typeof window !== "undefined" && cache) {
    localStorage.setItem(KEY, JSON.stringify(cache));
  }
  listeners.forEach((l) => l());
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

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, getDB, getDB);
}
