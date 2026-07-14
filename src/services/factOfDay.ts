import { callBackend } from "./backendClient";

export type FactOfDay = { fact: string; theme: string };

export async function getFactOfDay(): Promise<FactOfDay> {
  return callBackend<FactOfDay>("/api/ai", { action: "fact-of-day" });
}
