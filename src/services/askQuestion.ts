import { callBackend } from "./backendClient";

export type ChatTurn = { question: string; answer: string };
export type AskResult = { answer: string };

export function askQuestion(params: {
  lessonTitle: string;
  lessonText: string;
  question: string;
  history: ChatTurn[];
}): Promise<AskResult> {
  return callBackend<AskResult>("/api/ai", { action: "ask", ...params });
}
