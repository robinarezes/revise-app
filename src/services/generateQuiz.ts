import type { ExerciseQuestion, FlashCard, LessonCard, QcmQuestion } from "../types";
import { callClaudeTool } from "./anthropicClient";
import { callBackend } from "./backendClient";

type QuizGenerationResult = {
  qcm: QcmQuestion[];
  flashcards: FlashCard[];
  lessonCards: LessonCard[];
  exercises: ExerciseQuestion[];
};

const TOOL_NAME = "save_study_material";

export async function generateQuiz(params: {
  apiKey: string | null;
  lessonTitle: string;
  lessonText: string;
  qcmCount?: number;
  flashcardCount?: number;
  lessonCardCount?: number;
  exerciseCount?: number;
}): Promise<QuizGenerationResult> {
  const {
    apiKey,
    lessonTitle,
    lessonText,
    qcmCount = 8,
    flashcardCount = 8,
    lessonCardCount = 6,
    exerciseCount = 5,
  } = params;

  if (!apiKey) {
    return callBackend<QuizGenerationResult>("/api/quiz", { lessonTitle, lessonText });
  }

  return callClaudeTool<QuizGenerationResult>({
    apiKey,
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
      name: TOOL_NAME,
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
}
