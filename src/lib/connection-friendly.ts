import { toast } from "sonner";

/**
 * Friendly French messages for connection issues. Used everywhere instead of
 * raw technical terms ("Délai dépassé", "timeout", "fetch failed", etc.).
 */
export const CONNECTION_MESSAGES = {
  timeout:
    "Votre connexion internet semble lente. Veuillez patienter ou réessayer. Vos données sont en sécurité.",
  offline: "Vous êtes hors ligne. Reconnexion en cours…",
  failed: "Connexion lente ou interrompue. Réessayez.",
} as const;

/** Phrases we should never show to the user — they get rewritten. */
const TECHNICAL_PATTERNS: { pattern: RegExp; friendly: string }[] = [
  { pattern: /délai dépassé/i, friendly: CONNECTION_MESSAGES.timeout },
  { pattern: /\btimed?\s?out\b|\btimeout\b/i, friendly: CONNECTION_MESSAGES.timeout },
  { pattern: /failed to fetch|fetch failed|networkerror|network error/i, friendly: CONNECTION_MESSAGES.failed },
  { pattern: /load failed/i, friendly: CONNECTION_MESSAGES.failed },
  { pattern: /typeerror.*fetch/i, friendly: CONNECTION_MESSAGES.failed },
  { pattern: /offline|hors ligne/i, friendly: CONNECTION_MESSAGES.offline },
];

export function friendlyConnectionMessage(input: unknown): string | null {
  const msg = typeof input === "string" ? input : (input as Error)?.message ?? "";
  if (!msg) return null;
  for (const { pattern, friendly } of TECHNICAL_PATTERNS) {
    if (pattern.test(msg)) return friendly;
  }
  return null;
}

/** Show a calm warning toast for connection issues. */
export function notifyConnectionIssue(
  message: string = CONNECTION_MESSAGES.timeout,
  opts: { onRetry?: () => void } = {},
) {
  toast.warning(message, {
    duration: 6000,
    action: opts.onRetry ? { label: "Réessayer", onClick: opts.onRetry } : undefined,
  });
}

/**
 * Run an async operation with a generous timeout and one silent retry.
 * On final failure due to a connection issue, throws an Error whose message
 * is the friendly French text (safe to surface in toasts).
 */
export async function withTimeoutRetry<T>(
  op: () => PromiseLike<T>,
  {
    timeoutMs = 25000,
    retries = 1,
  }: { timeoutMs?: number; retries?: number } = {},
): Promise<T> {
  const attempt = (): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("__CONNECTION_TIMEOUT__")),
        timeoutMs,
      );
      Promise.resolve(op()).then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });

  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await attempt();
    } catch (e) {
      lastErr = e;
      const msg = (e as Error)?.message ?? "";
      const isConn =
        msg === "__CONNECTION_TIMEOUT__" ||
        friendlyConnectionMessage(msg) !== null;
      if (!isConn) throw e; // non-connection error: don't retry
      // otherwise, loop and retry silently
    }
  }
  const friendly = friendlyConnectionMessage((lastErr as Error)?.message ?? "") ?? CONNECTION_MESSAGES.timeout;
  throw new Error(friendly);
}

/**
 * Install a global interceptor on sonner's toast.error so any legacy call
 * site passing a raw technical message ("Délai dépassé", "Failed to fetch",
 * etc.) is automatically rewritten to a calm warning toast.
 */
let installed = false;
export function installFriendlyToastInterceptor() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const originalError = toast.error.bind(toast);
  toast.error = ((msg: unknown, opts?: any) => {
    const friendly = friendlyConnectionMessage(msg);
    if (friendly) {
      return toast.warning(friendly, { duration: 6000, ...(opts ?? {}) });
    }
    return originalError(msg as any, opts);
  }) as typeof toast.error;
}
