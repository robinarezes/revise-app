import { callBackend } from "./backendClient";

export type Verdict = "correct" | "partiel" | "incorrect";

export type Correction = {
  verdict: Verdict;
  feedback: string;
};

export function correctAnswer(params: {
  question: string;
  idealAnswer: string;
  userAnswer: string;
}): Promise<Correction> {
  return callBackend<Correction>("/api/ai", { action: "correct", ...params });
}
