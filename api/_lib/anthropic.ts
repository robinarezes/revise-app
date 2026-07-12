const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-5";

export type ImageContent = { base64: string; mediaType: string };

export class AnthropicError extends Error {}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

type ToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

// Server-side call to Claude using the app's own API key (never exposed to
// the browser). No CORS header needed here since this runs server-to-server.
export async function callClaudeTool<T>(params: {
  system: string;
  userText: string;
  images?: ImageContent[];
  tool: ToolDefinition;
  maxTokens?: number;
}): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnthropicError("ANTHROPIC_API_KEY n'est pas configurée sur le serveur.");
  }

  const { system, userText, images = [], tool, maxTokens = 2048 } = params;

  const content: ContentBlock[] = [
    ...images.map((img) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
    })),
    { type: "text" as const, text: userText },
  ];

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new AnthropicError(`Erreur de l'API Claude (${response.status}) : ${errBody}`);
  }

  const data = (await response.json()) as {
    content?: { type: string; input?: unknown }[];
  };
  const toolUse = (data.content ?? []).find((block) => block.type === "tool_use");
  if (!toolUse) {
    throw new AnthropicError("Réponse inattendue de Claude (pas de résultat structuré).");
  }
  return toolUse.input as T;
}
