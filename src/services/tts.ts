import { callBackendBlob } from "./backendClient";

export const TTS_VOICES = [
  { value: "alloy", label: "Alloy (neutre)" },
  { value: "nova", label: "Nova (féminine)" },
  { value: "shimmer", label: "Shimmer (féminine douce)" },
  { value: "echo", label: "Echo (masculine)" },
  { value: "onyx", label: "Onyx (masculine grave)" },
  { value: "fable", label: "Fable (expressive)" },
] as const;

export function synthesizeSpeech(text: string, voice: string): Promise<Blob> {
  return callBackendBlob("/api/ai", { action: "tts", text, voice });
}
