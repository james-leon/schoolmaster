import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to Postgres realtime changes on the given tables and call
 * `onChange` (debounced) whenever any INSERT / UPDATE / DELETE happens.
 *
 * This is the app-wide pattern for keeping list/detail views fresh after
 * a mutation happens elsewhere (same tab, another tab, another user, or
 * a server-side write like a webhook or trigger). Filters by school_id
 * when provided so the client only receives its own tenant's events.
 *
 * Usage:
 *   useRealtimeRefresh(schoolId, ["transactions", "payment_records"], fetchAll);
 */
export function useRealtimeRefresh(
  schoolId: string | undefined | null,
  tables: readonly string[],
  onChange: () => void,
  opts?: { debounceMs?: number },
) {
  // Keep the latest callback without re-subscribing on every render.
  const cbRef = useRef(onChange);
  cbRef.current = onChange;
  const debounceMs = opts?.debounceMs ?? 250;

  useEffect(() => {
    if (!schoolId || tables.length === 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cbRef.current(), debounceMs);
    };

    const key = tables.join("+");
    const channel = supabase.channel(`rt-${key}-${schoolId}`);
    for (const table of tables) {
      (channel as unknown as {
        on: (
          type: string,
          filter: { event: string; schema: string; table: string; filter: string },
          cb: () => void,
        ) => unknown;
      }).on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `school_id=eq.${schoolId}` },
        trigger,
      );
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [schoolId, tables.join("|"), debounceMs]); // eslint-disable-line react-hooks/exhaustive-deps
}
