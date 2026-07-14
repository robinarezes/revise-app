import type { QcmQuestion } from "../types";
import { callBackendNdjson } from "./backendClient";

export type Difficulty = "facile" | "moyen" | "difficile";

// Reçoit les questions une par une dès qu'elles sont prêtes (la première
// question s'affiche sans attendre les 8), au lieu d'attendre le quiz
// complet.
export function streamGeneralQuiz(
  grade: string,
  subject: string,
  options: { topics?: string[]; difficulty?: Difficulty },
  onQuestion: (question: QcmQuestion) => void
): Promise<void> {
  return callBackendNdjson<QcmQuestion>(
    "/api/ai",
    {
      action: "general-quiz",
      grade,
      subject,
      topics: options.topics,
      difficulty: options.difficulty,
    },
    onQuestion
  );
}
