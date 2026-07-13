import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callClaudeTool } from "./_lib/anthropic.js";
import { requireUserId } from "./_lib/auth.js";
import { checkAndConsumeQuota } from "./_lib/quota.js";

type GeneralQuizResult = {
  qcm: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  }[];
};

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

  const quota = await checkAndConsumeQuota(userId);
  if (!quota.allowed) {
    return res.status(429).json({
      error: "quota_exceeded",
      message: `Limite gratuite du jour atteinte (${quota.limit}). Réessaie demain ou passe en illimité.`,
    });
  }

  try {
    // Pas de cache ici (contrairement au quiz du jour) : chaque partie doit
    // être différente pour que le quiz général reste rejouable à volonté.
    const result = await callClaudeTool<GeneralQuizResult>({
      system:
        "Tu es un professeur qui prépare un quiz de révision varié pour un élève, afin de tester " +
        "ses connaissances générales dans une matière.",
      userText:
        `Génère un quiz de 8 questions à choix multiples en ${subject}, pour un élève de ${grade} ` +
        "(programme scolaire français), couvrant des notions variées de cette matière à ce niveau " +
        "(différentes de questions trop basiques). 4 options par question, une seule bonne réponse " +
        "(correctIndex entre 0 et 3), avec une courte explication. Varie la difficulté et les sujets " +
        "abordés d'une question à l'autre.",
      tool: {
        name: "save_general_quiz",
        description: "Enregistre le quiz généré.",
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
              minItems: 8,
              maxItems: 8,
            },
          },
          required: ["qcm"],
        },
      },
      maxTokens: 3072,
    });

    res.setHeader("X-Quota-Remaining", String(quota.remaining));
    return res.status(200).json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue.";
    return res.status(502).json({ error: "upstream_error", message });
  }
}
