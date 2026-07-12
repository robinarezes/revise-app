import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callClaudeTool } from "./_lib/anthropic.js";
import { requireUserId } from "./_lib/auth.js";
import { getCached, setCached } from "./_lib/cache.js";
import { checkAndConsumeQuota } from "./_lib/quota.js";

type DailyQuizResult = {
  qcm: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  }[];
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const userId = await requireUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "unauthorized", message: "Connecte-toi pour continuer." });
  }

  const { grade, subject } = req.body as { grade: string; subject: string };
  if (!grade || !subject) {
    return res.status(400).json({ error: "bad_request", message: "Classe ou matière manquante." });
  }

  // Shared across every student in the same grade for the same day, so the
  // daily quiz is only generated once per grade+subject+day, not per user.
  const cacheKey = `daily:${grade}:${subject}:${todayStr()}`;
  const cached = await getCached<DailyQuizResult>(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  const quota = await checkAndConsumeQuota(userId);
  if (!quota.allowed) {
    return res.status(429).json({
      error: "quota_exceeded",
      message: `Limite gratuite du jour atteinte (${quota.limit}). Réessaie demain.`,
    });
  }

  try {
    const result = await callClaudeTool<DailyQuizResult>({
      system:
        "Tu es un professeur qui prépare un petit quiz quotidien de révision, sur des notions " +
        "de base, pour un élève.",
      userText:
        `Génère un mini quiz quotidien de 5 questions à choix multiples en ${subject}, pour un ` +
        `élève de ${grade} (programme scolaire français), portant sur des notions de base et ` +
        "fondamentales de cette matière (pas forcément liées à une leçon précise). Les questions " +
        "doivent être simples, variées, et rapides à répondre. 4 options par question, une seule " +
        "bonne réponse (correctIndex entre 0 et 3), avec une courte explication.",
      tool: {
        name: "save_daily_quiz",
        description: "Enregistre le quiz quotidien généré.",
        input_schema: {
          type: "object",
          properties: {
            qcm: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  options: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 4,
                    maxItems: 4,
                  },
                  correctIndex: { type: "integer", minimum: 0, maximum: 3 },
                  explanation: { type: "string" },
                },
                required: ["question", "options", "correctIndex"],
              },
              minItems: 5,
              maxItems: 5,
            },
          },
          required: ["qcm"],
        },
      },
      maxTokens: 2048,
    });

    await setCached(cacheKey, result);
    res.setHeader("X-Quota-Remaining", String(quota.remaining));
    return res.status(200).json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue.";
    return res.status(502).json({ error: "upstream_error", message });
  }
}
