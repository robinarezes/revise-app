import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callClaudeTool } from "./_lib/anthropic.js";
import { checkAndConsumeQuota } from "./_lib/quota.js";

type ChatTurn = { question: string; answer: string };
type AskResult = { answer: string };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const visitorId = req.headers["x-visitor-id"];
  if (typeof visitorId !== "string" || !visitorId) {
    return res.status(400).json({ error: "missing_visitor_id" });
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

  const { lessonTitle, lessonText, question, history } = req.body as {
    lessonTitle: string;
    lessonText: string;
    question: string;
    history?: ChatTurn[];
  };

  if (!lessonText || !question) {
    return res.status(400).json({ error: "bad_request", message: "Leçon ou question manquante." });
  }

  const historyText =
    history && history.length > 0
      ? "\n\nÉchanges précédents dans cette conversation :\n" +
        history
          .slice(-5)
          .map((h) => `Q: ${h.question}\nR: ${h.answer}`)
          .join("\n\n")
      : "";

  try {
    const result = await callClaudeTool<AskResult>({
      system:
        "Tu es un tuteur qui répond aux questions d'un élève à propos d'une leçon précise. " +
        "Réponds uniquement à partir du contenu de la leçon fourni, de façon claire, concise et " +
        "bienveillante. Si la question sort du cadre de la leçon, dis-le simplement.",
      userText:
        `Leçon : "${lessonTitle}"\n\nContenu de la leçon :\n${lessonText}${historyText}\n\n` +
        `Question de l'élève : ${question}`,
      tool: {
        name: "answer_question",
        description: "Enregistre la réponse à la question de l'élève.",
        input_schema: {
          type: "object",
          properties: {
            answer: { type: "string" },
          },
          required: ["answer"],
        },
      },
      maxTokens: 1024,
    });

    res.setHeader("X-Quota-Remaining", String(quota.remaining));
    return res.status(200).json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue.";
    return res.status(502).json({ error: "upstream_error", message });
  }
}
