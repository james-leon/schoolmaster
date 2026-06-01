import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/admin-api";

export interface SchoolParentAccount {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
}

/** Loads all parent login accounts in the current school once. */
export function useSchoolParentAccounts() {
  const [accounts, setAccounts] = useState<SchoolParentAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.listSchoolParents();
      setAccounts(r.parents);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const byEmail = new Map(
    accounts.map((a) => [(a.email ?? "").toLowerCase(), a]),
  );
  const hasAccount = (email?: string | null) =>
    !!email && byEmail.has(email.toLowerCase());
  const accountFor = (email?: string | null) =>
    email ? byEmail.get(email.toLowerCase()) ?? null : null;

  return { accounts, loading, hasAccount, accountFor, refresh: load };
}
