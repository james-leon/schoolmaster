import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppreciationInput = {
  firstName: string;
  classLevel?: string;
  term: string;
  generalAverage: number | null;
  rank: number | null;
  totalStudents: number | null;
  subjects: { name: string; average: number | null }[];
  absences?: number;
  retards?: number;
};

function buildPrompt(d: AppreciationInput): string {
  const moy = d.generalAverage != null ? d.generalAverage.toFixed(2) : "non disponible";
  const rang = d.rank && d.totalStudents ? `${d.rank} / ${d.totalStudents}` : "non disponible";
  const matieres = d.subjects
    .filter((s) => s.average != null)
    .map((s) => `- ${s.name}: ${s.average!.toFixed(2)}/20`)
    .join("\n");
  let niveau = "passable";
  const m = d.generalAverage ?? 0;
  if (m >= 16) niveau = "excellent";
  else if (m >= 14) niveau = "bien";
  else if (m >= 12) niveau = "assez bien";
  else if (m >= 10) niveau = "passable";
  else niveau = "insuffisant";

  return `Élève prénommé: ${d.firstName}
Trimestre: ${d.term}
Niveau de performance global: ${niveau}
Moyenne générale: ${moy}/20
Rang: ${rang}
Moyennes par matière:
${matieres || "(non disponibles)"}
Absences: ${d.absences ?? 0} — Retards: ${d.retards ?? 0}

Rédige UNIQUEMENT l'appréciation (2 à 3 phrases), sans en-tête, sans guillemets, sans chiffres précis.`;
}

export const generateAppreciation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as AppreciationInput)
  .handler(async ({ data, context }) => {
    // Restrict to teachers and school admins
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    const role = profile?.role ?? roleRow?.role;
    if (role !== "school_admin" && role !== "teacher" && role !== "super_admin") {
      throw new Response("Forbidden", { status: 403 });
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Response("AI not configured", { status: 500 });

    const system = `Tu es un enseignant expérimenté d'une école primaire en Afrique francophone. Rédige une appréciation scolaire personnalisée, bienveillante et constructive pour cet élève, en français, en 2-3 phrases. Base-toi sur ses résultats. Sois encourageant tout en restant honnête. Adapte le ton à un enfant de primaire. Ne mentionne pas de chiffres précis. N'utilise jamais le nom de famille.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "raw",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: buildPrompt(data) },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[ai-appreciation]", res.status, text);
      if (res.status === 429) throw new Response("Limite IA atteinte. Réessayez plus tard.", { status: 429 });
      if (res.status === 402) throw new Response("Crédits IA épuisés.", { status: 402 });
      throw new Response("Erreur de génération IA", { status: 500 });
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) throw new Response("Réponse IA vide", { status: 500 });
    return { text };
  });
