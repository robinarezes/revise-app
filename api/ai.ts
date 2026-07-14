import { createHash, randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callClaudeTool, streamClaudeText, type ImageContent } from "./_lib/anthropic.js";
import { requireUserId } from "./_lib/auth.js";
import { getCached, setCached } from "./_lib/cache.js";
import { todayParis } from "./_lib/date.js";
import { checkAndConsumeQuota } from "./_lib/quota.js";
import { getServiceClient } from "./_lib/supabaseService.js";

// Every "generation" endpoint used to be its own Vercel serverless function,
// but a hobby-plan project only gets a limited number of functions — once we
// passed that count, the newest ones silently 404'd instead of deploying.
// They're merged into this single dispatcher (keyed by "action") to stay
// comfortably under the limit as more AI features get added.

type ChatTurn = { question: string; answer: string };

function todayStr(): string {
  return todayParis();
}

// Claude sometimes reaches for LaTeX ($x^2$, \frac{}{}) or stray symbols the
// app doesn't render, showing up literally in the UI. Appended to prompts
// that produce text shown to students.
const NO_LATEX =
  " N'utilise jamais de notation LaTeX ni de signes dollar ($) pour les formules : écris-les en texte " +
  "normal (ex: \"x²\", \"racine carrée de x\", \"a/b\"), sans code ni caractères spéciaux superflus.";

// Sans ça, Claude a tendance à renvoyer une première question quasi
// identique d'une génération à l'autre pour un même sujet (le "Roi Soleil"
// ressort presque toujours en premier pour l'Histoire, par ex.). On force
// un point de départ différent à chaque appel avec un thème tiré au hasard
// et un identifiant unique que le modèle ne peut pas ignorer.
const VARIETY_THEMES = [
  "un événement ou une découverte peu connue",
  "un chiffre ou une statistique surprenante",
  "une invention ou une innovation",
  "un lieu ou une carte",
  "un personnage moins célèbre que les plus évidents",
  "une comparaison entre deux choses",
  "une anecdote ou un détail insolite",
  "une notion pratique ou du quotidien",
];

function varietyInstruction(): string {
  const theme = VARIETY_THEMES[Math.floor(Math.random() * VARIETY_THEMES.length)];
  return (
    ` Génération unique n°${randomUUID().slice(0, 8)} : n'utilise jamais la question la plus classique ` +
    `ou la plus attendue sur ce sujet, surtout pas comme première question. Commence plutôt par ${theme}, ` +
    "puis varie librement le reste. Deux générations différentes ne doivent jamais partager leur première " +
    "question."
  );
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
            "Tu lis fidèlement le contenu des photos (OCR) et tu le résumes sans rien inventer." +
            NO_LATEX,
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
        const { lessonTitle, lessonText, difficulty } = req.body as {
          lessonTitle: string;
          lessonText: string;
          difficulty?: "facile" | "moyen" | "difficile";
        };
        if (!lessonTitle || !lessonText) {
          return res.status(400).json({ error: "bad_request", message: "Leçon manquante." });
        }
        // Deux personnes qui révisent la même leçon (même texte, souvent
        // depuis Programme) au même niveau de difficulté partagent le même
        // QCM/flashcards/exercices au lieu de re-générer (et re-facturer)
        // à chaque fois.
        const quizCacheKey =
          `quiz:${createHash("sha256").update(lessonText).digest("hex")}:${difficulty ?? "moyen"}`;
        const cachedQuiz = await getCached<unknown>(quizCacheKey);
        if (cachedQuiz) return res.status(200).json(cachedQuiz);

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
        const difficultyHint =
          difficulty === "facile"
            ? " Niveau demandé : facile — reste sur les notions les plus simples et évidentes de la leçon."
            : difficulty === "difficile"
              ? " Niveau demandé : difficile — pousse davantage sur les détails, nuances et pièges " +
                "possibles du contenu."
              : " Niveau demandé : moyen — équilibre entre notions de base et approfondissement.";
        const result = await callClaudeTool({
          system:
            "Tu es un assistant pédagogique qui aide un élève à comprendre et apprendre une leçon " +
            "par cœur, en créant du contenu de révision clair, précis et fidèle au contenu fourni." +
            NO_LATEX,
          userText:
            `Leçon : "${lessonTitle}"\n\nContenu de la leçon :\n${lessonText}\n\n${difficultyHint}\n\n` +
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
        await setCached(quizCacheKey, result);
        res.setHeader("X-Quota-Remaining", String(quota.remaining));
        return res.status(200).json(result);
      }

      case "summarize": {
        const { lessonTitle, lessonText } = req.body as { lessonTitle: string; lessonText: string };
        if (!lessonText) {
          return res.status(400).json({ error: "bad_request", message: "Leçon manquante." });
        }
        // Même leçon (surtout celles venant de Programme, partagées entre
        // utilisateurs) -> même résumé, pas besoin de re-générer.
        const summaryCacheKey = `summary:${createHash("sha256").update(lessonText).digest("hex")}`;
        const cachedSummary = await getCached<{ summaryText: string }>(summaryCacheKey);
        if (cachedSummary) return res.status(200).json(cachedSummary);

        const quota = await checkAndConsumeQuota(userId);
        if (!quota.allowed) {
          return res.status(429).json({
            error: "quota_exceeded",
            message: `Limite gratuite du jour atteinte (${quota.limit}). Réessaie demain.`,
          });
        }
        const result = await callClaudeTool<{ summaryText: string }>({
          system:
            "Tu résumes des leçons scolaires à l'essentiel pour un élève pressé, sans rien inventer et " +
            "sans perdre les informations vraiment importantes." +
            NO_LATEX,
          userText:
            `Leçon : "${lessonTitle}"\n\nContenu complet :\n${lessonText}\n\n` +
            "Rédige un résumé très court (4 à 8 puces maximum, chacune une phrase courte) qui ne garde " +
            "que le principal : définitions clés, notions essentielles, formules ou dates si vraiment " +
            "importantes. Utilise des tirets \"- \" en début de ligne. Mets en évidence les mots-clés " +
            "avec **le mot** (comme en Markdown). Pas d'introduction ni de conclusion, juste les puces.",
          tool: {
            name: "save_summary",
            description: "Enregistre le résumé de la leçon.",
            input_schema: {
              type: "object",
              properties: { summaryText: { type: "string" } },
              required: ["summaryText"],
            },
          },
          maxTokens: 768,
        });
        await setCached(summaryCacheKey, result);
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
            "Mets en évidence les mots-clés essentiels avec **le mot** (comme en Markdown)." +
            NO_LATEX,
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

      case "diagram": {
        const { lessonTitle, lessonText } = req.body as { lessonTitle: string; lessonText: string };
        if (!lessonTitle || !lessonText) {
          return res.status(400).json({ error: "bad_request", message: "Leçon manquante." });
        }
        const { data: profile } = await getServiceClient()
          .from("profiles")
          .select("subscription_status")
          .eq("id", userId)
          .maybeSingle();
        if ((profile as { subscription_status?: string } | null)?.subscription_status !== "active") {
          return res.status(403).json({
            error: "premium_required",
            message: "La création de schémas est réservée aux membres Premium.",
          });
        }
        const quota = await checkAndConsumeQuota(userId);
        if (!quota.allowed) {
          return res.status(429).json({
            error: "quota_exceeded",
            message: `Limite gratuite du jour atteinte (${quota.limit}). Réessaie demain.`,
          });
        }
        const result = await callClaudeTool<{ title: string; mermaid: string }>({
          system:
            "Tu crées des schémas pédagogiques au format Mermaid.js pour aider un élève à visualiser " +
            "une leçon (flowchart, carte mentale ou diagramme selon ce qui convient le mieux). " +
            "Le code Mermaid doit être valide et se limiter aux notions présentes dans la leçon.",
          userText:
            `Leçon : "${lessonTitle}"\n\nContenu de la leçon :\n${lessonText}\n\n` +
            "Crée un schéma qui résume visuellement les notions clés et leurs liens (utilise un " +
            "flowchart Mermaid : \"graph TD\" ou \"graph LR\", avec des nœuds courts et des flèches " +
            "annotées si utile). Réponds uniquement avec le code Mermaid valide (sans balises markdown " +
            "``` autour), et un titre court pour ce schéma.",
          tool: {
            name: "save_diagram",
            description: "Enregistre le schéma généré.",
            input_schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                mermaid: { type: "string", description: "Code Mermaid.js valide, sans balises markdown." },
              },
              required: ["title", "mermaid"],
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
        // the daily quiz is only generated once per grade+subject+day. Streamé
        // question par question (une ligne JSON par question) au lieu
        // d'attendre les 5 questions d'un coup : la première question
        // s'affiche dès qu'elle arrive.
        const cacheKey = `daily:${grade}:${subject}:${todayStr()}`;
        const cached = await getCached<string>(cacheKey);
        if (cached) {
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          return res.status(200).end(cached);
        }
        const quota = await checkAndConsumeQuota(userId);
        if (!quota.allowed) {
          return res.status(429).json({
            error: "quota_exceeded",
            message: `Limite gratuite du jour atteinte (${quota.limit}). Réessaie demain.`,
          });
        }
        const isSchoolSubject = !["culture générale", "culture generale"].includes(
          subject.trim().toLowerCase()
        );

        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("X-Quota-Remaining", String(quota.remaining));
        res.status(200);

        let full = "";
        try {
          for await (const delta of streamClaudeText({
            system:
              "Tu es un professeur qui prépare un petit quiz quotidien de révision, sur des notions " +
              "de base, pour un élève. Le quiz est renouvelé chaque jour : deux quiz générés à des " +
              "dates différentes ne doivent jamais se ressembler, même pour la même matière et le même " +
              "niveau. Tu réponds uniquement avec des lignes JSON, une question par ligne, sans jamais " +
              "rien ajouter d'autre (pas de texte, pas de \`\`\`, pas de numérotation)." +
              NO_LATEX,
            userText:
              `Nous sommes le ${todayStr()}. Génère le quiz quotidien du jour : 5 questions à choix ` +
              `multiples ${isSchoolSubject ? `en ${subject}` : "de culture générale (histoire, géographie, sciences, actualité, arts, sport, monde...)"}` +
              `, pour un élève de ${grade}${isSchoolSubject ? " (programme scolaire français)" : ""}. ` +
              "Choisis des questions variées et surprenantes plutôt que les plus évidentes/classiques du " +
              "sujet, pour que ce quiz soit vraiment différent de celui d'hier et de demain : change les " +
              "notions abordées, l'angle des questions et leur ordre de difficulté à chaque génération. " +
              "Les questions doivent rester simples et rapides à répondre. 4 options par question, une " +
              "seule bonne réponse (correctIndex entre 0 et 3), avec une courte explication." +
              varietyInstruction() +
              "\n\nRéponds avec EXACTEMENT 5 lignes, rien d'autre. Chaque ligne est un objet JSON sur " +
              "une seule ligne (sans retour à la ligne à l'intérieur), au format exact : " +
              `{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}`,
            maxTokens: 2400,
          })) {
            full += delta;
            res.write(delta);
          }
        } catch (e) {
          if (!full) {
            const message = e instanceof Error ? e.message : "Erreur inconnue.";
            return res.status(502).json({ error: "upstream_error", message });
          }
        }

        if (full.trim()) await setCached(cacheKey, full);
        return res.end();
      }

      case "general-quiz": {
        const { grade, subject, topics, difficulty } = req.body as {
          grade: string;
          subject: string;
          topics?: string[];
          difficulty?: "facile" | "moyen" | "difficile";
        };
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
        const lower = subject.trim().toLowerCase();
        const isAllSubjects = ["toutes les matières", "toutes les matieres"].includes(lower);
        const isCulture = ["culture générale", "culture generale"].includes(lower);
        const multiSubjects = subject.includes(",") ? subject.split(",").map((s) => s.trim()) : null;

        const difficultyHint =
          difficulty === "facile"
            ? " Niveau demandé : facile — questions simples et directes, sur les notions de base."
            : difficulty === "difficile"
              ? " Niveau demandé : difficile — questions plus poussées, pièges et subtilités, moins " +
                "évidentes."
              : " Niveau demandé : moyen — un mélange équilibré de questions simples et plus poussées.";

        const scopeText = isAllSubjects
          ? `Génère un quiz de 8 questions à choix multiples mélangeant plusieurs matières différentes ` +
            `du programme scolaire français, pour un élève de ${grade} (une matière différente à chaque ` +
            "question si possible)."
          : multiSubjects
            ? `Génère un quiz de 8 questions à choix multiples mélangeant ces matières : ` +
              `${multiSubjects.join(", ")}, pour un élève de ${grade} (programme scolaire français), en ` +
              "répartissant les questions entre elles."
            : isCulture
              ? `Génère un quiz de 8 questions à choix multiples de culture générale (histoire, ` +
                `géographie, sciences, actualité, arts, sport, monde...), adapté à un jeune de ${grade}.`
              : topics && topics.length > 0
                ? `Génère un quiz de 8 questions à choix multiples en ${subject}, pour un élève de ${grade} ` +
                  `(programme scolaire français), portant uniquement sur ces chapitres précis : ` +
                  `${topics.join(", ")}.`
                : `Génère un quiz de 8 questions à choix multiples en ${subject}, pour un élève de ${grade} ` +
                  "(programme scolaire français), couvrant des notions variées de cette matière à ce niveau " +
                  "(différentes de questions trop basiques).";

        // Pas de cache ici (contrairement au quiz du jour) : chaque partie
        // doit être différente pour rester rejouable à volonté.
        const result = await callClaudeTool({
          system:
            "Tu es un professeur qui prépare un quiz de révision varié pour un élève, afin de tester " +
            "ses connaissances générales dans une matière. Cet élève peut relancer un nouveau quiz autant " +
            "de fois qu'il veut : chaque génération doit être clairement différente des précédentes, " +
            "sinon le quiz devient inintéressant à rejouer." +
            NO_LATEX,
          userText:
            scopeText +
            difficultyHint +
            " 4 options par question, une seule bonne réponse (correctIndex entre 0 et 3), avec une " +
            "courte explication. Varie les sujets abordés d'une question à l'autre." +
            varietyInstruction(),
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

      case "tts": {
        const { text, voice } = req.body as { text: string; voice?: string };
        if (!text) {
          return res.status(400).json({ error: "bad_request", message: "Texte manquant." });
        }
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return res.status(500).json({
            error: "not_configured",
            message: "La voix n'est pas encore configurée sur le serveur.",
          });
        }
        const quota = await checkAndConsumeQuota(userId);
        if (!quota.allowed) {
          return res.status(429).json({
            error: "quota_exceeded",
            message: `Limite gratuite du jour atteinte (${quota.limit}). Réessaie demain ou passe en illimité.`,
          });
        }
        // Strip the **keyword** markup used for highlighting so it isn't
        // read aloud as "étoile étoile", and stay under OpenAI's ~4096
        // character input limit for a single TTS request.
        const cleaned = text.replace(/\*\*([^*]+)\*\*/g, "$1").slice(0, 4000);
        const openaiRes = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "tts-1",
            input: cleaned,
            voice: voice || "alloy",
          }),
        });
        if (!openaiRes.ok) {
          const errText = await openaiRes.text();
          return res.status(502).json({
            error: "upstream_error",
            message: `Erreur de la voix (${openaiRes.status}) : ${errText.slice(0, 200)}`,
          });
        }
        const audioBuffer = Buffer.from(await openaiRes.arrayBuffer());
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("X-Quota-Remaining", String(quota.remaining));
        return res.status(200).send(audioBuffer);
      }

      case "leaderboard": {
        const service = getServiceClient();

        // Classement hebdomadaire (repart de zéro chaque lundi, heure de
        // Paris) : donne à tout le monde une raison de revenir chaque
        // semaine, plutôt qu'un classement à vie où les premiers arrivés
        // sont indétrônables.
        const dow = new Date(`${todayParis()}T00:00:00Z`).getUTCDay();
        const diffToMonday = dow === 0 ? -6 : 1 - dow;
        const weekStart = todayParis(diffToMonday);

        const { data: results, error: resultsError } = await service
          .from("daily_quiz_results")
          .select("user_id, xp_earned")
          .gte("quiz_date", weekStart);
        if (resultsError) throw resultsError;

        const totals = new Map<string, number>();
        for (const row of (results ?? []) as { user_id: string; xp_earned: number }[]) {
          totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + row.xp_earned);
        }
        if (totals.size === 0) {
          return res
            .status(200)
            .json({ ranking: [], me: { points: 0, rank: null, needsUsername: false }, weekStart });
        }

        const { data: profiles, error: profilesError } = await service
          .from("profiles")
          .select("id, username")
          .in("id", Array.from(totals.keys()));
        if (profilesError) throw profilesError;
        const usernameById = new Map(
          ((profiles ?? []) as { id: string; username: string | null }[]).map((p) => [p.id, p.username])
        );

        // Un pseudo est requis pour apparaître dans le classement : sinon
        // tout le monde s'affiche sous le même nom générique "Élève", ce qui
        // ressemble à des faux comptes plutôt qu'à de vrais joueurs.
        const ranking = Array.from(totals.entries())
          .map(([id, points]) => ({ userId: id, username: usernameById.get(id) ?? null, points }))
          .filter((entry) => !!entry.username)
          .sort((a, b) => b.points - a.points)
          .slice(0, 50)
          .map((entry, i) => ({ ...entry, rank: i + 1 }));

        const myPoints = totals.get(userId) ?? 0;
        const myEntry = ranking.find((r) => r.userId === userId);
        const me = {
          points: myPoints,
          rank: myEntry?.rank ?? null,
          needsUsername: myPoints > 0 && !usernameById.get(userId),
        };
        // Anonymize other players in the response: only reveal userId for
        // the requester's own row (front-end needs it to highlight "you").
        const publicRanking = ranking.map((r) => ({
          rank: r.rank,
          username: r.username,
          points: r.points,
          isMe: r.userId === userId,
        }));
        return res.status(200).json({ ranking: publicRanking, me, weekStart });
      }

      default:
        return res.status(400).json({ error: "bad_request", message: "Action inconnue. Recharge la page (une mise à jour a peut-être eu lieu) puis réessaie." });
    }
  } catch (e) {
    // Supabase's PostgrestError isn't an Error instance, so it needs its own
    // check to surface a real message instead of a generic fallback.
    const message =
      e instanceof Error
        ? e.message
        : e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : "Erreur inconnue.";
    return res.status(502).json({ error: "upstream_error", message });
  }
}
