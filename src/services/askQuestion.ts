import { callClaudeTool } from "./anthropicClient";
import { callBackend } from "./backendClient";

export type ChatTurn = { question: string; answer: string };
export type AskResult = { answer: string };

const TOOL_NAME = "answer_question";

export async function askQuestion(params: {
  apiKey: string | null;
  lessonTitle: string;
  lessonText: string;
  question: string;
  history: ChatTurn[];
}): Promise<AskResult> {
  const { apiKey, lessonTitle, lessonText, question, history } = params;

  if (!apiKey) {
    return callBackend<AskResult>("/api/ask", { lessonTitle, lessonText, question, history });
  }

  const historyText =
    history.length > 0
      ? "\n\nÉchanges précédents dans cette conversation :\n" +
        history
          .slice(-5)
          .map((h) => `Q: ${h.question}\nR: ${h.answer}`)
          .join("\n\n")
      : "";

  return callClaudeTool<AskResult>({
    apiKey,
    system:
      "Tu es un tuteur qui répond aux questions d'un élève à propos d'une leçon précise. " +
      "Réponds uniquement à partir du contenu de la leçon fourni, de façon claire, concise et " +
      "bienveillante. Si la question sort du cadre de la leçon, dis-le simplement.",
    userText:
      `Leçon : "${lessonTitle}"\n\nContenu de la leçon :\n${lessonText}${historyText}\n\n` +
      `Question de l'élève : ${question}`,
    tool: {
      name: TOOL_NAME,
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
}
