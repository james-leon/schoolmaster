import { useSyncExternalStore } from "react";

/**
 * Global status of the initial data load (hydration from the backend).
 * Lets every screen render a consistent LOADING / ERROR state instead of a
 * blank table while the first fetch is still in flight.
 */
export type DataStatus = "idle" | "loading" | "ready" | "error";

let status: DataStatus = "idle";
let lastError: string | null = null;
let retryFn: (() => void) | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setDataStatus(next: DataStatus, error?: unknown) {
  status = next;
  lastError = next === "error" ? String((error as Error)?.message ?? error ?? "") : null;
  emit();
}

/** Registered by the sync layer so any screen can offer a "Réessayer" action. */
export function registerDataRetry(fn: () => void) {
  retryFn = fn;
}

export function retryDataLoad() {
  retryFn?.();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const snap = () => status;
const serverSnap = () => "ready" as DataStatus;

export function useDataStatus(): {
  status: DataStatus;
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  retry: () => void;
} {
  const s = useSyncExternalStore(subscribe, snap, serverSnap);
  return {
    status: s,
    isLoading: s === "loading",
    isError: s === "error",
    error: lastError,
    retry: retryDataLoad,
  };
}
