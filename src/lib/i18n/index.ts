import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { fr } from "./locales/fr";
import { en } from "./locales/en";

export type AppLanguage = "fr" | "en";

const LOCAL_KEY = "sm.language";

function detectBrowserLanguage(): AppLanguage {
  if (typeof navigator === "undefined") return "fr";
  const langs: string[] = [];
  if (Array.isArray(navigator.languages)) langs.push(...navigator.languages);
  if (navigator.language) langs.push(navigator.language);
  for (const l of langs) {
    const code = (l || "").toLowerCase().split("-")[0];
    if (code === "en") return "en";
    if (code === "fr") return "fr";
  }
  return "fr";
}

function readInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") return "fr";
  try {
    const v = window.localStorage.getItem(LOCAL_KEY);
    if (v === "fr" || v === "en") return v;
  } catch {}
  return detectBrowserLanguage();
}

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources: {
        fr: { translation: fr },
        en: { translation: en },
      },
      lng: readInitialLanguage(),
      fallbackLng: "fr",
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  if (typeof document !== "undefined") {
    try { document.documentElement.lang = i18n.language === "en" ? "en" : "fr"; } catch {}
    i18n.on("languageChanged", (lng) => {
      try { document.documentElement.lang = lng === "en" ? "en" : "fr"; } catch {}
    });
  }
}

export function setAppLanguage(lang: AppLanguage) {
  if (lang !== "fr" && lang !== "en") return;
  i18n.changeLanguage(lang);
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(LOCAL_KEY, lang); } catch {}
    try { document.documentElement.lang = lang; } catch {}
  }
}

export function getAppLanguage(): AppLanguage {
  const cur = i18n.language;
  return cur === "en" ? "en" : "fr";
}

export default i18n;
