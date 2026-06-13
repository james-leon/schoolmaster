import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/admin-api";

export interface SchoolTeacherAccount {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
}

/** Loads all teacher login accounts in the current school. */
export function useSchoolTeacherAccounts() {
  const [accounts, setAccounts] = useState<SchoolTeacherAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.listSchoolTeachers();
      setAccounts(r.teachers);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const byEmail = new Map(accounts.map((a) => [(a.email ?? "").toLowerCase(), a]));
  const hasAccount = (email?: string | null) => !!email && byEmail.has(email.toLowerCase());
  const accountFor = (email?: string | null) =>
    email ? byEmail.get(email.toLowerCase()) ?? null : null;

  return { accounts, loading, hasAccount, accountFor, refresh: load };
}
