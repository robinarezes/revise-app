import { callBackend, callBackendStream } from "./backendClient";

export type CurriculumSubjects = { subjects: string[] };
export type CurriculumTopics = { topics: string[] };

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

// Streams the lesson body as it's generated instead of waiting for the full
// text: onProgress fires repeatedly with the text accumulated so far, so the
// caller can show it being written live. Resolves with the final full text.
export async function streamCurriculumLesson(
  grade: string,
  subject: string,
  topic: string,
  onProgress: (textSoFar: string) => void
): Promise<string> {
  let full = "";
  await callBackendStream("/api/curriculum", { action: "lesson", grade, subject, topic }, (chunk) => {
    full += chunk;
    onProgress(full);
  });
  return full;
}
