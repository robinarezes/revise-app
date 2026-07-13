import type { ExerciseQuestion, FlashCard, LessonCard, QcmQuestion } from "../types";
import { callBackend } from "./backendClient";

type QuizGenerationResult = {
  qcm: QcmQuestion[];
  flashcards: FlashCard[];
  lessonCards: LessonCard[];
  exercises: ExerciseQuestion[];
};

export function generateQuiz(params: {
  lessonTitle: string;
  lessonText: string;
}): Promise<QuizGenerationResult> {
  return callBackend<QuizGenerationResult>("/api/ai", { action: "quiz", ...params });
}
