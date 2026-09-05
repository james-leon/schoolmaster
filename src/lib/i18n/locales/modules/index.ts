import { deep } from "./deep";
import { budgetTransport } from "./budgetTransport";
import { staff } from "./staff";
import { school } from "./school";
import { settings } from "./settings";
import { settingsNav } from "./settingsNav";
import { parentPortal } from "./parentPortal";
import { adminConsole } from "./adminConsole";
import { legal } from "./legal";
import { pricing } from "./pricing";

const MODULES = [deep, budgetTransport, staff, school, settings, settingsNav, parentPortal, adminConsole, legal, pricing];

type AnyDict = Record<string, unknown>;

/** Deep-merge plain objects; later sources win. Arrays are replaced, not merged. */
export function deepMerge<T extends AnyDict>(base: T, ...sources: AnyDict[]): T {
  const out: AnyDict = { ...base };
  for (const src of sources) {
    for (const [k, v] of Object.entries(src ?? {})) {
      const prev = out[k];
      if (
        v && typeof v === "object" && !Array.isArray(v) &&
        prev && typeof prev === "object" && !Array.isArray(prev)
      ) {
        out[k] = deepMerge(prev as AnyDict, v as AnyDict);
      } else {
        out[k] = v;
      }
    }
  }
  return out as T;
}

export function withModules<T extends AnyDict>(base: T, lang: "fr" | "en"): T {
  return deepMerge(base, ...MODULES.map((m) => (m as AnyDict)[lang] as AnyDict));
}
