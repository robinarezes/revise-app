import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callClaudeTool, streamClaudeText } from "./_lib/anthropic.js";
import { requireUserId } from "./_lib/auth.js";
import { getCached, setCached } from "./_lib/cache.js";
import { checkAndConsumeQuota } from "./_lib/quota.js";

// Merges the subjects/topics/lesson curriculum endpoints into one function
// (see api/ai.ts for why: staying under the hobby-plan function count).

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
      case "subjects": {
        const { grade, lv1, lv2 } = req.body as { grade: string; lv1?: string; lv2?: string };
        if (!grade) {
          return res.status(400).json({ error: "bad_request", message: "Classe manquante." });
        }
        const cacheKey = `curriculum:subjects:${grade}:${lv1 ?? ""}:${lv2 ?? ""}`;
        const cached = await getCached<{ subjects: string[] }>(cacheKey);
        if (cached) return res.status(200).json(cached);

        const quota = await checkAndConsumeQuota(userId);
        if (!quota.allowed) {
          return res.status(429).json({
            error: "quota_exceeded",
            message: `Limite gratuite du jour atteinte (${quota.limit}). Réessaie demain.`,
          });
        }
        const languagesHint =
          lv1 || lv2
            ? ` L'élève étudie ${[lv1 && `${lv1} en LV1`, lv2 && `${lv2} en LV2`].filter(Boolean).join(" et ")} : ` +
              "utilise ces noms de langue précis plutôt que \"Langue Vivante A/B\" génériques."
            : "";
        const result = await callClaudeTool<{ subjects: string[] }>({
          system: "Tu es un assistant qui connaît précisément le programme scolaire français.",
          userText:
            `Pour un élève de ${grade} (système scolaire français), liste les matières scolaires ` +
            `principales enseignées à ce niveau, dans un ordre logique.${languagesHint}`,
          tool: {
            name: "save_subjects",
            description: "Enregistre la liste des matières du programme scolaire.",
            input_schema: {
              type: "object",
              properties: {
                subjects: { type: "array", items: { type: "string" }, minItems: 6, maxItems: 14 },
              },
              required: ["subjects"],
            },
          },
          maxTokens: 1024,
        });
        await setCached(cacheKey, result);
        res.setHeader("X-Quota-Remaining", String(quota.remaining));
        return res.status(200).json(result);
      }

      case "topics": {
        const { grade, subject } = req.body as { grade: string; subject: string };
        if (!grade || !subject) {
          return res.status(400).json({ error: "bad_request", message: "Classe ou matière manquante." });
        }
        const cacheKey = `curriculum:topics:${grade}:${subject}`;
        const cached = await getCached<{ topics: string[] }>(cacheKey);
        if (cached) return res.status(200).json(cached);

        const quota = await checkAndConsumeQuota(userId);
        if (!quota.allowed) {
          return res.status(429).json({
            error: "quota_exceeded",
            message: `Limite gratuite du jour atteinte (${quota.limit}). Réessaie demain.`,
          });
        }
        const result = await callClaudeTool<{ topics: string[] }>({
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
                topics: { type: "array", items: { type: "string" }, minItems: 6, maxItems: 16 },
              },
              required: ["topics"],
            },
          },
          maxTokens: 1536,
        });
        await setCached(cacheKey, result);
        res.setHeader("X-Quota-Remaining", String(quota.remaining));
        return res.status(200).json(result);
      }

      case "lesson": {
        const { grade, subject, topic } = req.body as { grade: string; subject: string; topic: string };
        if (!grade || !subject || !topic) {
          return res
            .status(400)
            .json({ error: "bad_request", message: "Classe, matière ou chapitre manquant." });
        }
        // Cross-visitor cache: a lesson generated once (e.g. "Théorème de
        // Pythagore" for 4e Mathématiques) is reused by everyone else. The
        // lesson's title is just the topic name (already a clean chapter
        // title from "topics"), so only the body text needs generating —
        // the QCM, flashcards, etc. are generated on demand when the
        // student taps "Réviser", via the "quiz" action.
        //
        // The response body is always plain text (the lesson body), even
        // on a cache hit, so the client can treat every call the same way:
        // read the stream and show it appearing progressively. A cache hit
        // just arrives as a single instant chunk.
        const cacheKey = `curriculum:lesson-text:${grade}:${subject}:${topic}`;
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

        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("X-Quota-Remaining", String(quota.remaining));
        res.status(200);

        let full = "";
        try {
          for await (const delta of streamClaudeText({
            system:
              "Tu es un professeur qui rédige des leçons complètes, claires et fidèles au programme " +
              "scolaire français.",
            userText:
              `Rédige le cours complet sur le chapitre "${topic}" du programme de ${subject} en ${grade} ` +
              "(programme scolaire français officiel), structuré en paragraphes clairs (définitions, " +
              "explications, exemples, formules si pertinent), comme un vrai cours qu'un professeur " +
              "donnerait à ses élèves. Mets en évidence les mots-clés et notions importantes en les " +
              "entourant de doubles astérisques, par exemple **mot-clé** (comme en Markdown), sans en " +
              "abuser (quelques mots par paragraphe). Reste fidèle au niveau scolaire demandé, sans être " +
              "ni trop simple ni trop avancé. Réponds uniquement avec le texte du cours lui-même, sans " +
              "titre ni phrase d'introduction du type \"Voici le cours\".",
            maxTokens: 3072,
          })) {
            full += delta;
            res.write(delta);
          }
        } catch (e) {
          if (!full) {
            const message = e instanceof Error ? e.message : "Erreur inconnue.";
            return res.status(502).json({ error: "upstream_error", message });
          }
          // Partial content already streamed to the client: just stop here
          // rather than trying to send a JSON error on top of it.
        }

        if (full) await setCached(cacheKey, full);
        return res.end();
      }

      default:
        return res.status(400).json({ error: "bad_request", message: "Action inconnue. Recharge la page (une mise à jour a peut-être eu lieu) puis réessaie." });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue.";
    return res.status(502).json({ error: "upstream_error", message });
  }
}
