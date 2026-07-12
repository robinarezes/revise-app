import { callBackend } from "./backendClient";

export type SimplifyResult = { simplifiedText: string };

export function simplifyLesson(params: {
  lessonTitle: string;
  lessonText: string;
}): Promise<SimplifyResult> {
  return callBackend<SimplifyResult>("/api/simplify", params);
}
