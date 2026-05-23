// ============================================================
// Supabase Edge Function — groq-program
// Server-side proxy for the Groq API. The GROQ_API_KEY never
// reaches the client (fixes the critical secret-leak issue).
//
// Deploy:
//   supabase functions deploy groq-program
//   supabase secrets set GROQ_API_KEY=gsk_xxx
//
// `verify_jwt` is ON by default → only authenticated users of
// this project can call it (Supabase validates the Bearer JWT
// before our code runs). We also re-validate the user explicitly.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXPERT_SYSTEM_PROMPT =
  `Tu es un coach sportif certifié (NSCA-CSCS, ISSA) avec 15 ans d'expérience en programmation de force et d'hypertrophie.
Applique la science : volume MEV/MAV/MRV par muscle/semaine, fréquence 2x/muscle, ranges de reps selon l'objectif (force 1-5, hypertrophie 6-12, endurance 15-25), surcharge progressive, composés avant isolation, repos adaptés (composés lourds 180-240s, isolation 60-90s), adaptations par niveau et par genre.
Tu réponds UNIQUEMENT avec du JSON valide, sans markdown, sans texte avant ou après, sans balises.`;

const GOAL_CONTEXT: Record<string, string> = {
  muscle: "HYPERTROPHIE : 3-4×8-12, repos 90-120s, 15-20 sets/muscle/sem.",
  strength: "FORCE : 4-6×3-6 sur les gros mouvements, repos 3-5min, périodisation.",
  weight_loss: "PERTE DE POIDS : 3-4×12-20, repos courts 30-60s, multi-articulaires.",
  endurance: "ENDURANCE : 3-4×15-25, repos 30-45s, supersets.",
  general: "FORME GÉNÉRALE : 3×10-15, repos 60-90s, équilibre global.",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // ── Authn: validate the caller's JWT ──
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    // ── Input validation (server-side, never trust the client) ──
    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return json({ error: "Invalid payload" }, 400);
    }
    const goal = String(payload.goal ?? "general").slice(0, 20);
    const level = String(payload.level ?? "beginner").slice(0, 20);
    const gender = payload.gender ? String(payload.gender).slice(0, 10) : null;
    const daysPerWeek = Math.min(7, Math.max(1, Number(payload.daysPerWeek) || 3));
    const ids: string[] = Array.isArray(payload.availableExerciseIds)
      ? payload.availableExerciseIds
          .filter((x: unknown) => typeof x === "string")
          .slice(0, 200)
          .map((s: string) => s.slice(0, 64))
      : [];
    if (ids.length === 0) return json({ error: "No exercises provided" }, 400);

    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) return json({ error: "Server misconfigured" }, 500);

    const levelMap: Record<string, string> = {
      beginner: "DÉBUTANT (<1 an)",
      intermediate: "INTERMÉDIAIRE (1-3 ans)",
      advanced: "AVANCÉ (3+ ans)",
    };
    const genderNote = gender === "female"
      ? "\n- Genre : Femme → favorise glutes, tolérance hautes reps"
      : gender === "male" ? "\n- Genre : Homme" : "";

    const userPrompt =
      `Crée un programme d'entraînement.
PROFIL :
- Niveau : ${levelMap[level] ?? level}
- Objectif : ${goal.toUpperCase()}${genderNote}
- Fréquence : ${daysPerWeek} séances/semaine
${GOAL_CONTEXT[goal] ?? ""}

IDs d'exercices disponibles — utilise UNIQUEMENT ces identifiants exacts :
${ids.join(", ")}

JSON strict, exactement ${daysPerWeek} séances, 4-6 exercices/séance :
{"name":"...","sessions":[{"name":"...","exercises":[{"exercise_id":"id","sets":4,"reps":10,"rest_seconds":90}]}]}`;

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: EXPERT_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.55,
        max_tokens: 2048,
        response_format: { type: "json_object" },
      }),
    });

    if (!groqRes.ok) {
      // Do not leak upstream error details to the client.
      console.error("Groq error", groqRes.status, await groqRes.text());
      return json({ error: "AI generation failed" }, 502);
    }

    const data = await groqRes.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return json({ error: "Empty AI response" }, 502);

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return json({ error: "Invalid AI JSON" }, 502);
    }
    if (!parsed?.name || !Array.isArray(parsed?.sessions) || parsed.sessions.length === 0) {
      return json({ error: "Invalid program structure" }, 502);
    }

    // Defense in depth: only allow ids we sent.
    const allow = new Set(ids);
    parsed.sessions = parsed.sessions.map((s: any) => ({
      name: String(s?.name ?? "Séance").slice(0, 60),
      exercises: Array.isArray(s?.exercises)
        ? s.exercises
            .filter((e: any) => allow.has(e?.exercise_id))
            .map((e: any) => ({
              exercise_id: String(e.exercise_id),
              sets: Math.min(10, Math.max(1, Number(e.sets) || 3)),
              reps: Math.min(50, Math.max(1, Number(e.reps) || 10)),
              rest_seconds: Math.min(600, Math.max(15, Number(e.rest_seconds) || 90)),
            }))
        : [],
    }));

    return json(parsed, 200);
  } catch (e) {
    console.error("groq-program fatal", e);
    return json({ error: "Internal error" }, 500);
  }
});
