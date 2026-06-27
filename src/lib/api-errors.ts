// Safe, generic error messages for API responses.
// Never include raw DB / Supabase error text in client-facing responses —
// log internally instead and return a stable French message per status code.

export const SAFE_MESSAGES: Record<number, string> = {
  400: "Requête invalide.",
  401: "Action non autorisée.",
  403: "Action non autorisée.",
  404: "Ressource introuvable.",
  409: "Conflit : cette opération n'est pas possible.",
  500: "Une erreur est survenue. Réessayez plus tard.",
};

export function safeError(
  scope: string,
  status: number,
  realError: unknown,
  fallback?: string,
): Response {
  // Full error stays server-side for debugging.
  // eslint-disable-next-line no-console
  console.error(`[${scope}]`, realError);
  const message = SAFE_MESSAGES[status] ?? fallback ?? SAFE_MESSAGES[500];
  return Response.json({ error: message }, { status });
}
