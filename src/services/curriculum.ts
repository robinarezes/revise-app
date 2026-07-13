import type { ExerciseQuestion, FlashCard, LessonCard, QcmQuestion } from "../types";
import { callBackend } from "./backendClient";

export type CurriculumSubjects = { subjects: string[] };
export type CurriculumTopics = { topics: string[] };
export type CurriculumLesson = {
  title: string;
  extractedText: string;
  lessonCards: LessonCard[];
  qcm: QcmQuestion[];
  flashcards: FlashCard[];
  exercises: ExerciseQuestion[];
};

// The curriculum feature always goes through the shared backend, since its
// whole point is a cache shared across everyone.
export function getCurriculumSubjects(
  grade: string,
  lv1: string | null,
  lv2: string | null
): Promise<CurriculumSubjects> {
  return callBackend<CurriculumSubjects>("/api/curriculum", { action: "subjects", grade, lv1, lv2 });
}

export function getCurriculumTopics(grade: string, subject: string): Promise<CurriculumTopics> {
  return callBackend<CurriculumTopics>("/api/curriculum", { action: "topics", grade, subject });
}

export function getCurriculumLesson(
  grade: string,
  subject: string,
  topic: string
): Promise<CurriculumLesson> {
  return callBackend<CurriculumLesson>("/api/curriculum", { action: "lesson", grade, subject, topic });
}
