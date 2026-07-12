import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callClaudeTool } from "./_lib/anthropic.js";
import { requireUserId } from "./_lib/auth.js";
import { checkAndConsumeQuota } from "./_lib/quota.js";

type SimplifyResult = { simplifiedText: string };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const userId = await requireUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "unauthorized", message: "Connecte-toi pour continuer." });
  }

  const quota = await checkAndConsumeQuota(userId);
  if (!quota.allowed) {
    return res.status(429).json({
      error: "quota_exceeded",
      message: `Limite gratuite du jour atteinte (${quota.limit}). Réessaie demain.`,
    });
  }

  const { lessonTitle, lessonText } = req.body as { lessonTitle: string; lessonText: string };

  if (!lessonText) {
    return res.status(400).json({ error: "bad_request", message: "Leçon manquante." });
  }

  try {
    const result = await callClaudeTool<SimplifyResult>({
      system:
        "Tu réécris des leçons scolaires en version ultra-simplifiée pour un élève dyslexique. " +
        "Règles strictes : phrases très courtes (moins de 12 mots), une seule idée par phrase, " +
        "vocabulaire simple et concret, pas de phrases imbriquées. Structure le texte avec des " +
        "tirets ou puces (une idée par ligne) plutôt que des paragraphes denses. Garde tout le " +
        "contenu important de la leçon, ne raccourcis pas le fond, seulement la forme. " +
        "Mets en évidence les mots-clés essentiels avec **le mot** (comme en Markdown).",
      userText: `Leçon : "${lessonTitle}"\n\nContenu original :\n${lessonText}`,
      tool: {
        name: "save_simplified_lesson",
        description: "Enregistre la version simplifiée de la leçon.",
        input_schema: {
          type: "object",
          properties: {
            simplifiedText: { type: "string" },
          },
          required: ["simplifiedText"],
        },
      },
      maxTokens: 2048,
    });

    res.setHeader("X-Quota-Remaining", String(quota.remaining));
    return res.status(200).json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue.";
    return res.status(502).json({ error: "upstream_error", message });
  }
}
