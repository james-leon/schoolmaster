import { supabase } from "@/integrations/supabase/client";

/** Mark an announcement as read for the current user. No-op if already read. */
export async function markAnnouncementRead(announcementId: string, schoolId: string | null | undefined, userId: string | null | undefined): Promise<void> {
  if (!announcementId || !schoolId || !userId) return;
  try {
    await supabase
      .from("announcement_reads")
      .upsert(
        { announcement_id: announcementId, user_id: userId, school_id: schoolId },
        { onConflict: "announcement_id,user_id", ignoreDuplicates: true },
      );
  } catch (e) {
    // Silent — read tracking is best-effort
    console.warn("[ann-read]", e);
  }
}

/** Load the IDs of announcements the current user has read. */
export async function fetchMyReadAnnouncementIds(userId: string | null | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data } = await supabase
    .from("announcement_reads")
    .select("announcement_id")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.announcement_id as string));
}
