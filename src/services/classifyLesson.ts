import type { ImageContent } from "./backendClient";
import { callBackend } from "./backendClient";

export type ClassificationResult = {
  subject: string;
  title: string;
  extractedText: string;
};

export function classifyLesson(params: {
  images: ImageContent[];
  existingSubjects: string[];
}): Promise<ClassificationResult> {
  return callBackend<ClassificationResult>("/api/ai", { action: "classify", ...params });
}
