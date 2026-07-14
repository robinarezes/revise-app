import type { QcmQuestion } from "../types";
import { callBackend } from "./backendClient";

export type GeneralQuiz = { qcm: QcmQuestion[] };
export type Difficulty = "facile" | "moyen" | "difficile";

export function getGeneralQuiz(
  grade: string,
  subject: string,
  options?: { topics?: string[]; difficulty?: Difficulty }
): Promise<GeneralQuiz> {
  return callBackend<GeneralQuiz>("/api/ai", {
    action: "general-quiz",
    grade,
    subject,
    topics: options?.topics,
    difficulty: options?.difficulty,
  });
}
