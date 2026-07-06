import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { setAppLanguage, type AppLanguage } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * FR / EN toggle. Persists the choice to the user's profile when signed in,
 * so it follows them across devices. Falls back to localStorage otherwise.
 */
export function LanguageSwitcher({ className, variant = "solid" }: { className?: string; variant?: "solid" | "ghost" }) {
  const { i18n } = useTranslation();
  const [current, setCurrent] = useState<AppLanguage>((i18n.language as AppLanguage) === "en" ? "en" : "fr");

  useEffect(() => {
    const handler = (lng: string) => setCurrent(lng === "en" ? "en" : "fr");
    i18n.on("languageChanged", handler);
    return () => { i18n.off("languageChanged", handler); };
  }, [i18n]);

  const change = async (lang: AppLanguage) => {
    if (lang === current) return;
    setAppLanguage(lang);
    setCurrent(lang);
    // Persist to profile if signed in. Fire-and-forget — the switch is
    // already applied locally regardless of network outcome.
    try {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await supabase.from("profiles").update({ language: lang }).eq("id", data.user.id);
      }
    } catch { /* ignore — local pref is enough */ }
  };

  const base = variant === "ghost"
    ? "flex items-center gap-0.5 rounded-full border border-white/15 bg-white/5 p-0.5 text-[11px] font-semibold text-white/80 backdrop-blur"
    : "flex items-center gap-0.5 rounded-full border border-[#E8EDF4] bg-white p-0.5 text-[11px] font-semibold text-[#64748B] shadow-sm";
  const activeCls = variant === "ghost"
    ? "bg-white text-[#0D2C54]"
    : "bg-[#0D2C54] text-white";

  return (
    <div className={cn(base, className)} role="group" aria-label="Language">
      {(["fr", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => change(code)}
          className={cn(
            "min-w-[34px] rounded-full px-2 py-1 uppercase tracking-wide transition-colors",
            current === code && activeCls,
          )}
          aria-pressed={current === code}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
