/**
 * Server-side rate limiter backed by `public.check_and_record_rate_limit`.
 *
 * Used by API route handlers (`/api/public/*`) and protected server
 * functions to throttle sensitive actions per-user across every Worker
 * isolate (in-memory counters wouldn't be shared).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface RateLimitConfig {
  action: string;
  /** Max events allowed in the window (per key). */
  max: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

/**
 * Check-and-record. Consumes one slot if allowed.
 * `key` should be a stable identifier for the actor (user id, or ip:action).
 */
export async function checkRateLimit(
  admin: SupabaseClient,
  key: string,
  cfg: RateLimitConfig,
): Promise<RateLimitResult> {
  try {
    const { data, error } = await admin.rpc("check_and_record_rate_limit", {
      _key: key,
      _action: cfg.action,
      _max: cfg.max,
      _window_seconds: cfg.windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] rpc error", cfg.action, error.message);
      // Fail-open — never block a user because the limiter itself is down.
      return { allowed: true, retryAfter: 0 };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      allowed: !!row?.allowed,
      retryAfter: Number(row?.retry_after ?? 0),
    };
  } catch (err) {
    console.error("[rate-limit] threw", cfg.action, err);
    return { allowed: true, retryAfter: 0 };
  }
}

/** Convenience: return a 429 Response if rate-limited, else null. */
export async function rateLimitOr429(
  admin: SupabaseClient,
  key: string,
  cfg: RateLimitConfig,
): Promise<Response | null> {
  const r = await checkRateLimit(admin, key, cfg);
  if (r.allowed) return null;
  return Response.json(
    {
      error: `Trop de requêtes. Réessayez dans ${r.retryAfter}s.`,
      retryAfter: r.retryAfter,
    },
    { status: 429, headers: { "retry-after": String(r.retryAfter) } },
  );
}

/** Per-action limit presets. Tune here — everything else stays consistent. */
export const RATE_LIMITS = {
  accountWrite: { action: "admin:account-write", max: 20, windowSeconds: 600 },
  passwordReset: { action: "admin:password-reset", max: 20, windowSeconds: 600 },
  superAdminWrite: { action: "super-admin:write", max: 30, windowSeconds: 600 },
  superAdminDestructive: { action: "super-admin:destructive", max: 5, windowSeconds: 3600 },
  aiAppreciation: { action: "ai:appreciation", max: 30, windowSeconds: 300 },
  aiAppreciationBulk: { action: "ai:appreciation-bulk", max: 6, windowSeconds: 300 },
} as const satisfies Record<string, RateLimitConfig>;
