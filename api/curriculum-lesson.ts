import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callClaudeTool } from "./_lib/anthropic.js";
import { getCached, setCached } from "./_lib/cache.js";
import { checkAndConsumeQuota } from "./_lib/quota.js";

type CurriculumLessonResult = {
  title: string;
  extractedText: string;
  lessonCards: { concept: string; explanation: string }[];
  qcm: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  }[];
  flashcards: { question: string; answer: string }[];
  exercises: { question: string; idealAnswer: string }[];
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const visitorId = req.headers["x-visitor-id"];
  if (typeof visitorId !== "string" || !visitorId) {
    return res.status(400).json({ error: "missing_visitor_id" });
  }

  const { grade, subject, topic } = req.body as {
    grade: string;
    subject: string;
    topic: string;
  };
  if (!grade || !subject || !topic) {
    return res.status(400).json({ error: "bad_request", message: "Classe, matière ou chapitre manquant." });
  }

  // This is the cross-visitor cache that lets a lesson generated once (e.g.
  // "Théorème de Pythagore" for 4e Mathématiques) be reused by everyone else
  // without spending API credits again.
  const cacheKey = `curriculum:lesson:${grade}:${subject}:${topic}`;
  const cached = await getCached<CurriculumLessonResult>(cacheKey);
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
    const result = await callClaudeTool<CurriculumLessonResult>({
      system:
        "Tu es un professeur qui rédige des leçons complètes, claires et fidèles au programme " +
        "scolaire français, puis prépare du matériel de révision à partir de cette leçon.",
      userText:
        `Rédige une leçon complète sur le chapitre "${topic}" du programme de ${subject} en ${grade} ` +
        "(programme scolaire français officiel).\n\n" +
        "Génère :\n" +
        `1. "title" : un titre court pour la leçon.\n` +
        `2. "extractedText" : le cours complet, structuré en paragraphes clairs (définitions, ` +
        "explications, exemples, formules si pertinent), comme un vrai cours qu'un professeur " +
        "donnerait à ses élèves.\n" +
        `3. "lessonCards" (6 cartes) : des flashcards qui RÉ-EXPLIQUENT la leçon notion par notion, ` +
        "avec un \"concept\" court et une \"explanation\" claire (2 à 4 phrases).\n" +
        `4. "qcm" (8 questions) : des questions à choix multiples avec 4 options et une seule bonne ` +
        "réponse (correctIndex entre 0 et 3), avec une courte explication.\n" +
        `5. "flashcards" (8 cartes) : des questions/réponses courtes pour la mémorisation par cœur.\n` +
        `6. "exercises" (5 questions) : des questions ouvertes avec leur "idealAnswer" (réponse de ` +
        "référence) pour corriger la réponse rédigée par l'élève.\n\n" +
        "Reste fidèle au niveau scolaire demandé, sans être ni trop simple ni trop avancé.",
      tool: {
        name: "save_curriculum_lesson",
        description: "Enregistre la leçon complète générée avec son matériel de révision.",
        input_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            extractedText: { type: "string" },
            lessonCards: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  concept: { type: "string" },
                  explanation: { type: "string" },
                },
                required: ["concept", "explanation"],
              },
            },
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
            },
            flashcards: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  answer: { type: "string" },
                },
                required: ["question", "answer"],
              },
            },
            exercises: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  idealAnswer: { type: "string" },
                },
                required: ["question", "idealAnswer"],
              },
            },
          },
          required: ["title", "extractedText", "lessonCards", "qcm", "flashcards", "exercises"],
        },
      },
      maxTokens: 8192,
    });

    await setCached(cacheKey, result);
    res.setHeader("X-Quota-Remaining", String(quota.remaining));
    return res.status(200).json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue.";
    return res.status(502).json({ error: "upstream_error", message });
  }
}
