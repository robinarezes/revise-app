import { callClaudeTool } from "./anthropicClient";
import { callBackend } from "./backendClient";

export type Verdict = "correct" | "partiel" | "incorrect";

export type Correction = {
  verdict: Verdict;
  feedback: string;
};

const TOOL_NAME = "grade_answer";

export async function correctAnswer(params: {
  apiKey: string | null;
  question: string;
  idealAnswer: string;
  userAnswer: string;
}): Promise<Correction> {
  const { apiKey, question, idealAnswer, userAnswer } = params;

  if (!apiKey) {
    return callBackend<Correction>("/api/correct", { question, idealAnswer, userAnswer });
  }

  return callClaudeTool<Correction>({
    apiKey,
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
}
