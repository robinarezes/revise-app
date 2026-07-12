import { callClaudeTool, type ImageContent } from "./anthropicClient";
import { callBackend } from "./backendClient";

export type ClassificationResult = {
  subject: string;
  title: string;
  extractedText: string;
};

const TOOL_NAME = "save_lesson_classification";

export async function classifyLesson(params: {
  apiKey: string | null;
  images: ImageContent[];
  existingSubjects: string[];
}): Promise<ClassificationResult> {
  const { apiKey, images, existingSubjects } = params;

  if (!apiKey) {
    return callBackend<ClassificationResult>("/api/classify", { images, existingSubjects });
  }

  const subjectsHint =
    existingSubjects.length > 0
      ? `Matières déjà existantes dans l'app : ${existingSubjects.join(", ")}. Réutilise l'une d'elles si elle correspond, sinon propose un nom court et clair pour une nouvelle matière.`
      : "Aucune matière n'existe encore dans l'app, propose un nom court et clair pour cette nouvelle matière.";

  return callClaudeTool<ClassificationResult>({
    apiKey,
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
}
