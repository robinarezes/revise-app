import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callClaudeTool, type ImageContent } from "./_lib/anthropic.js";
import { requireUserId } from "./_lib/auth.js";
import { getCached, setCached } from "./_lib/cache.js";
import { checkAndConsumeQuota } from "./_lib/quota.js";

// Every "generation" endpoint used to be its own Vercel serverless function,
// but a hobby-plan project only gets a limited number of functions — once we
// passed that count, the newest ones silently 404'd instead of deploying.
// They're merged into this single dispatcher (keyed by "action") to stay
// comfortably under the limit as more AI features get added.

type ChatTurn = { question: string; answer: string };

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

  const { action } = req.body as { action?: string };

  try {
    switch (action) {
      case "ask": {
        const { lessonTitle, lessonText, question, history } = req.body as {
          lessonTitle: string;
          lessonText: string;
          question: string;
          history?: ChatTurn[];
        };
        if (!lessonText || !question) {
          return res.status(400).json({ error: "bad_request", message: "Leçon ou question manquante." });
        }
        const quota = await checkAndConsumeQuota(userId);
        if (!quota.allowed) {
          return res.status(429).json({
            error: "quota_exceeded",
            message: `Limite gratuite du jour atteinte (${quota.limit}). Réessaie demain.`,
          });
        }
        const historyText =
          history && history.length > 0
            ? "\n\nÉchanges précédents dans cette conversation :\n" +
              history
                .slice(-5)
                .map((h) => `Q: ${h.question}\nR: ${h.answer}`)
                .join("\n\n")
            : "";
        const result = await callClaudeTool<{ answer: string }>({
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
              properties: { answer: { type: "string" } },
              required: ["answer"],
            },
          },
          maxTokens: 1024,
        });
        res.setHeader("X-Quota-Remaining", String(quota.remaining));
        return res.status(200).json(result);
      }

      case "classify": {
        const { images, existingSubjects } = req.body as {
          images: ImageContent[];
          existingSubjects: string[];
        };
        if (!Array.isArray(images) || images.length === 0) {
          return res.status(400).json({ error: "bad_request", message: "Aucune image fournie." });
        }
        const quota = await checkAndConsumeQuota(userId);
        if (!quota.allowed) {
          return res.status(429).json({
            error: "quota_exceeded",
            message: `Limite gratuite du jour atteinte (${quota.limit} leçons). Réessaie demain.`,
          });
        }
        const subjectsHint =
          existingSubjects && existingSubjects.length > 0
            ? `Matières déjà existantes dans l'app : ${existingSubjects.join(", ")}. Réutilise l'une d'elles si elle correspond, sinon propose un nom court et clair pour une nouvelle matière.`
            : "Aucune matière n'existe encore dans l'app, propose un nom court et clair pour cette nouvelle matière.";
        const result = await callClaudeTool({
          system:
            "Tu es un assistant qui aide un élève à organiser ses cours photographiés. " +
            "Tu lis fidèlement le contenu des photos (OCR) et tu le résumes sans rien inventer.",
          userText:
            `Voici une ou plusieurs photos d'une même leçon. ${subjectsHint}\n\n` +
            "Détermine la matière scolaire, un titre court pour cette leçon, et transcris/résume " +
            "fidèlement tout le contenu utile (définitions, formules, dates, notions clés) sous forme " +
            "de texte structuré qui servira ensuite à générer des questions de révision. Mets en " +
            "évidence les mots-clés et notions importantes en les entourant de doubles astérisques, " +
            "par exemple **mot-clé** (comme en Markdown), sans en abuser (quelques mots par paragraphe).",
          images,
          tool: {
            name: "save_lesson_classification",
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
      }

      case "correct": {
        const { question, idealAnswer, userAnswer } = req.body as {
          question: string;
          idealAnswer: string;
          userAnswer: string;
        };
        if (!question || !idealAnswer) {
          return res.status(400).json({ error: "bad_request", message: "Question manquante." });
        }
        const quota = await checkAndConsumeQuota(userId);
        if (!quota.allowed) {
          return res.status(429).json({
            error: "quota_exceeded",
            message: `Limite gratuite du jour atteinte (${quota.limit} leçons). Réessaie demain.`,
          });
        }
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
            name: "grade_answer",
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
      }

      case "quiz": {
        const { lessonTitle, lessonText } = req.body as { lessonTitle: string; lessonText: string };
        if (!lessonTitle || !lessonText) {
          return res.status(400).json({ error: "bad_request", message: "Leçon manquante." });
        }
        const quota = await checkAndConsumeQuota(userId);
        if (!quota.allowed) {
          return res.status(429).json({
            error: "quota_exceeded",
            message: `Limite gratuite du jour atteinte (${quota.limit} leçons). Réessaie demain.`,
          });
        }
        const qcmCount = 8;
        const flashcardCount = 8;
        const lessonCardCount = 6;
        const exerciseCount = 5;
        const result = await callClaudeTool({
          system:
            "Tu es un assistant pédagogique qui aide un élève à comprendre et apprendre une leçon " +
            "par cœur, en créant du contenu de révision clair, précis et fidèle au contenu fourni.",
          userText:
            `Leçon : "${lessonTitle}"\n\nContenu de la leçon :\n${lessonText}\n\n` +
            "Génère quatre types de contenu de révision à partir de cette leçon :\n\n" +
            `1. "lessonCards" (${lessonCardCount} cartes) : des flashcards qui RÉ-EXPLIQUENT la leçon, ` +
            "notion par notion, comme le ferait un professeur. Chaque carte a un \"concept\" court " +
            "(titre ou question introduisant la notion) et une \"explanation\" claire et pédagogique " +
            "(2 à 4 phrases) qui explique cette notion simplement. Elles couvrent ensemble tout le contenu " +
            "important de la leçon, dans un ordre logique.\n\n" +
            `2. "qcm" (${qcmCount} questions) : des questions à choix multiples avec 4 options plausibles ` +
            "et une seule bonne réponse (correctIndex entre 0 et 3), avec une courte explication.\n\n" +
            `3. "flashcards" (${flashcardCount} cartes) : des questions/réponses courtes pour tester la ` +
            "mémorisation par cœur (définitions, dates, formules, notions clés).\n\n" +
            `4. "exercises" (${exerciseCount} questions) : des questions ouvertes auxquelles l'élève doit ` +
            "répondre par écrit, avec leur \"idealAnswer\" (réponse de référence ou points clés attendus) " +
            "qui servira ensuite à corriger la réponse rédigée par l'élève.\n\n" +
            "Reste strictement fidèle au contenu fourni, n'invente rien.",
          tool: {
            name: "save_study_material",
            description: "Enregistre le matériel de révision généré pour une leçon.",
            input_schema: {
              type: "object",
              properties: {
                lessonCards: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      concept: { type: "string", description: "Titre ou question courte introduisant la notion." },
                      explanation: {
                        type: "string",
                        description: "Explication claire et pédagogique de la notion, 2 à 4 phrases.",
                      },
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
                      options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
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
                    properties: { question: { type: "string" }, answer: { type: "string" } },
                    required: ["question", "answer"],
                  },
                },
                exercises: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      idealAnswer: {
                        type: "string",
                        description:
                          "Réponse de référence ou points clés attendus, utilisés pour corriger la réponse de l'élève.",
                      },
                    },
                    required: ["question", "idealAnswer"],
                  },
                },
              },
              required: ["lessonCards", "qcm", "flashcards", "exercises"],
            },
          },
          maxTokens: 8192,
        });
        res.setHeader("X-Quota-Remaining", String(quota.remaining));
        return res.status(200).json(result);
      }

      case "simplify": {
        const { lessonTitle, lessonText } = req.body as { lessonTitle: string; lessonText: string };
        if (!lessonText) {
          return res.status(400).json({ error: "bad_request", message: "Leçon manquante." });
        }
        const quota = await checkAndConsumeQuota(userId);
        if (!quota.allowed) {
          return res.status(429).json({
            error: "quota_exceeded",
            message: `Limite gratuite du jour atteinte (${quota.limit}). Réessaie demain.`,
          });
        }
        const result = await callClaudeTool<{ simplifiedText: string }>({
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
              properties: { simplifiedText: { type: "string" } },
              required: ["simplifiedText"],
            },
          },
          maxTokens: 2048,
        });
        res.setHeader("X-Quota-Remaining", String(quota.remaining));
        return res.status(200).json(result);
      }

      case "daily-quiz": {
        const { grade, subject } = req.body as { grade: string; subject: string };
        if (!grade || !subject) {
          return res.status(400).json({ error: "bad_request", message: "Classe ou matière manquante." });
        }
        // Shared across every student in the same grade for the same day, so
        // the daily quiz is only generated once per grade+subject+day.
        const cacheKey = `daily:${grade}:${subject}:${todayStr()}`;
        const cached = await getCached<{ qcm: unknown[] }>(cacheKey);
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
        const result = await callClaudeTool({
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
                      options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
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
      }

      case "general-quiz": {
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
        // Pas de cache ici (contrairement au quiz du jour) : chaque partie
        // doit être différente pour rester rejouable à volonté.
        const result = await callClaudeTool({
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
                      options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
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
      }

      default:
        return res.status(400).json({ error: "bad_request", message: "Action inconnue." });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue.";
    return res.status(502).json({ error: "upstream_error", message });
  }
}
