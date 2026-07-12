import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callClaudeTool } from "./_lib/anthropic.js";
import { checkAndConsumeQuota } from "./_lib/quota.js";

const TOOL_NAME = "grade_answer";

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
        `Limite gratuite du jour atteinte (${quota.limit} leçons). Réessaie demain, ou ` +
        "ajoute ta propre clé API Claude dans Réglages pour un usage illimité.",
    });
  }

  const { question, idealAnswer, userAnswer } = req.body as {
    question: string;
    idealAnswer: string;
    userAnswer: string;
  };
  if (!question || !idealAnswer) {
    return res.status(400).json({ error: "bad_request", message: "Question manquante." });
  }

  try {
    const result = await callClaudeTool({
      system:
        "Tu es un professeur bienveillant qui corrige la réponse rédigée par un élève. " +
        "Tu juges le fond (les idées importantes sont-elles présentes et correctes), pas la forme " +
        "exacte des mots. Sois encourageant mais honnête.",
      userText:
        `Question posée : ${question}\n\n` +
        `Réponse de référence / points clés attendus : ${idealAnswer}\n\n` +
        `Réponse rédigée par l'élève : ${userAnswer || "(réponse vide)"}\n\n` +
        "Évalue cette réponse : \"correct\" si l'essentiel des points clés y est, \"partiel\" si une " +
        "partie seulement est correcte ou incomplète, \"incorrect\" si elle est fausse ou vide. " +
        "Donne un feedback court (1 à 3 phrases), bienveillant, qui explique ce qui est bon et ce qui " +
        "manque ou est faux.",
      tool: {
        name: TOOL_NAME,
        description: "Enregistre la correction de la réponse de l'élève.",
        input_schema: {
          type: "object",
          properties: {
            verdict: { type: "string", enum: ["correct", "partiel", "incorrect"] },
            feedback: { type: "string" },
          },
          required: ["verdict", "feedback"],
        },
      },
      maxTokens: 512,
    });

    res.setHeader("X-Quota-Remaining", String(quota.remaining));
    return res.status(200).json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue.";
    return res.status(502).json({ error: "upstream_error", message });
  }
}
