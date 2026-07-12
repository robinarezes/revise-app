import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callClaudeTool, type ImageContent } from "./_lib/anthropic.js";
import { checkAndConsumeQuota } from "./_lib/quota.js";

const TOOL_NAME = "save_lesson_classification";

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

  const { images, existingSubjects } = req.body as {
    images: ImageContent[];
    existingSubjects: string[];
  };

  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: "bad_request", message: "Aucune image fournie." });
  }

  const subjectsHint =
    existingSubjects && existingSubjects.length > 0
      ? `Matières déjà existantes dans l'app : ${existingSubjects.join(", ")}. Réutilise l'une d'elles si elle correspond, sinon propose un nom court et clair pour une nouvelle matière.`
      : "Aucune matière n'existe encore dans l'app, propose un nom court et clair pour cette nouvelle matière.";

  try {
    const result = await callClaudeTool({
      system:
        "Tu es un assistant qui aide un élève à organiser ses cours photographiés. " +
        "Tu lis fidèlement le contenu des photos (OCR) et tu le résumes sans rien inventer.",
      userText:
        `Voici une ou plusieurs photos d'une même leçon. ${subjectsHint}\n\n` +
        "Détermine la matière scolaire, un titre court pour cette leçon, et transcris/résume " +
        "fidèlement tout le contenu utile (définitions, formules, dates, notions clés) sous forme " +
        "de texte structuré qui servira ensuite à générer des questions de révision.",
      images,
      tool: {
        name: TOOL_NAME,
        description: "Enregistre le résultat du classement d'une leçon photographiée.",
        input_schema: {
          type: "object",
          properties: {
            subject: {
              type: "string",
              description: "Nom de la matière scolaire (ex: Mathématiques, Histoire).",
            },
            title: { type: "string", description: "Titre court de la leçon (5-8 mots)." },
            extractedText: {
              type: "string",
              description:
                "Texte structuré extrait/résumé des photos, complet et fidèle, utilisable pour générer des questions.",
            },
          },
          required: ["subject", "title", "extractedText"],
        },
      },
      maxTokens: 4096,
    });

    res.setHeader("X-Quota-Remaining", String(quota.remaining));
    return res.status(200).json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue.";
    return res.status(502).json({ error: "upstream_error", message });
  }
}
