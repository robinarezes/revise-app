import type { QcmQuestion } from "../types";
import { callBackend, callBackendNdjson } from "./backendClient";

export type DailyQuiz = { qcm: QcmQuestion[] };

export function getDailyQuiz(grade: string, subject: string): Promise<DailyQuiz> {
  return callBackend<DailyQuiz>("/api/ai", { action: "daily-quiz", grade, subject });
}

// Reçoit les questions une par une dès qu'elles sont prêtes (la première
// question s'affiche sans attendre les 5), au lieu d'attendre le quiz
// complet.
export function streamDailyQuiz(
  grade: string,
  subject: string,
  onQuestion: (question: QcmQuestion) => void
): Promise<void> {
  return callBackendNdjson<QcmQuestion>(
    "/api/ai",
    { action: "daily-quiz", grade, subject },
    onQuestion
  );
}
