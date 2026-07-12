import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callClaudeTool } from "./_lib/anthropic";
import { getCached, setCached } from "./_lib/cache";
import { checkAndConsumeQuota } from "./_lib/quota";

type CurriculumResult = { subjects: string[] };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const visitorId = req.headers["x-visitor-id"];
  if (typeof visitorId !== "string" || !visitorId) {
    return res.status(400).json({ error: "missing_visitor_id" });
  }

  const { grade } = req.body as { grade: string };
  if (!grade) {
    return res.status(400).json({ error: "bad_request", message: "Classe manquante." });
  }

  const cacheKey = `curriculum:subjects:${grade}`;
  const cached = await getCached<CurriculumResult>(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  const quota = await checkAndConsumeQuota(visitorId);
  if (!quota.allowed) {
    return res.status(429).json({
      error: "quota_exceeded",
      message:
        `Limite gratuite du jour atteinte (${quota.limit}). Réessaie demain, ou ajoute ta ` +
        "propre clé API Claude dans Réglages pour un usage illimité.",
    });
  }

  try {
    const result = await callClaudeTool<CurriculumResult>({
      system: "Tu es un assistant qui connaît précisément le programme scolaire français.",
      userText:
        `Pour un élève de ${grade} (système scolaire français), liste les matières scolaires ` +
        "principales enseignées à ce niveau, dans un ordre logique.",
      tool: {
        name: "save_subjects",
        description: "Enregistre la liste des matières du programme scolaire.",
        input_schema: {
          type: "object",
          properties: {
            subjects: {
              type: "array",
              items: { type: "string" },
              minItems: 6,
              maxItems: 14,
            },
          },
          required: ["subjects"],
        },
      },
      maxTokens: 1024,
    });

    await setCached(cacheKey, result);
    res.setHeader("X-Quota-Remaining", String(quota.remaining));
    return res.status(200).json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue.";
    return res.status(502).json({ error: "upstream_error", message });
  }
}
