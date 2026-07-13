import type { QcmQuestion } from "../types";
import { callBackend } from "./backendClient";

export type DailyQuiz = { qcm: QcmQuestion[] };

export function getDailyQuiz(grade: string, subject: string): Promise<DailyQuiz> {
  return callBackend<DailyQuiz>("/api/ai", { action: "daily-quiz", grade, subject });
}
