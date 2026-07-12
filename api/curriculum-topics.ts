import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callClaudeTool } from "./_lib/anthropic.js";
import { getCached, setCached } from "./_lib/cache.js";
import { checkAndConsumeQuota } from "./_lib/quota.js";

type TopicsResult = { topics: string[] };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const visitorId = req.headers["x-visitor-id"];
  if (typeof visitorId !== "string" || !visitorId) {
    return res.status(400).json({ error: "missing_visitor_id" });
  }

  const { grade, subject } = req.body as { grade: string; subject: string };
  if (!grade || !subject) {
    return res.status(400).json({ error: "bad_request", message: "Classe ou matière manquante." });
  }

  const cacheKey = `curriculum:topics:${grade}:${subject}`;
  const cached = await getCached<TopicsResult>(cacheKey);
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
    const result = await callClaudeTool<TopicsResult>({
      system: "Tu es un assistant qui connaît précisément le programme scolaire français.",
      userText:
        `Pour un élève de ${grade} en ${subject} (programme scolaire français), liste les grands ` +
        "chapitres/notions du programme de cette matière à ce niveau, dans un ordre pédagogique " +
        "logique (du premier chapitre de l'année au dernier).",
      tool: {
        name: "save_topics",
        description: "Enregistre la liste des chapitres du programme.",
        input_schema: {
          type: "object",
          properties: {
            topics: {
              type: "array",
              items: { type: "string" },
              minItems: 6,
              maxItems: 16,
            },
          },
          required: ["topics"],
        },
      },
      maxTokens: 1536,
    });

    await setCached(cacheKey, result);
    res.setHeader("X-Quota-Remaining", String(quota.remaining));
    return res.status(200).json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue.";
    return res.status(502).json({ error: "upstream_error", message });
  }
}
