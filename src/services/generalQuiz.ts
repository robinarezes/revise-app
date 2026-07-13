import type { QcmQuestion } from "../types";
import { callBackend } from "./backendClient";

export type GeneralQuiz = { qcm: QcmQuestion[] };

export function getGeneralQuiz(grade: string, subject: string): Promise<GeneralQuiz> {
  return callBackend<GeneralQuiz>("/api/general-quiz", { grade, subject });
}
