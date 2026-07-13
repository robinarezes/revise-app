import { callBackend } from "./backendClient";

export type DiagramResult = { title: string; mermaid: string };

export function generateDiagram(params: {
  lessonTitle: string;
  lessonText: string;
}): Promise<DiagramResult> {
  return callBackend<DiagramResult>("/api/ai", { action: "diagram", ...params });
}
