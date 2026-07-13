import { callBackend } from "./backendClient";

export type SummarizeResult = { summaryText: string };

export function summarizeLesson(params: {
  lessonTitle: string;
  lessonText: string;
}): Promise<SummarizeResult> {
  return callBackend<SummarizeResult>("/api/ai", { action: "summarize", ...params });
}
