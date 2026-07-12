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

// Sends a single-turn message to Claude and forces the response through a
// tool call so the result is always well-formed JSON matching `tool.input_schema`.
// Calling the API directly from a browser requires this explicit opt-in header,
// since Anthropic blocks browser-origin requests by default (CORS).
export async function callClaudeTool<T>(params: {
  apiKey: string;
  system: string;
  userText: string;
  images?: ImageContent[];
  tool: ToolDefinition;
  maxTokens?: number;
}): Promise<T> {
  const { apiKey, system, userText, images = [], tool, maxTokens = 2048 } = params;

  const content: ContentBlock[] = [
    ...images.map((img) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
    })),
    { type: "text" as const, text: userText },
  ];

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
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
  } catch (e) {
    throw new AnthropicError(
      "Impossible de contacter l'API Claude. Vérifie ta connexion internet."
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new AnthropicError("Clé API invalide. Vérifie-la dans les réglages.");
    }
    const errBody = await response.text();
    throw new AnthropicError(`Erreur de l'API Claude (${response.status}) : ${errBody}`);
  }

  const data = await response.json();
  const toolUse = (data.content ?? []).find(
    (block: { type: string }) => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new AnthropicError("Réponse inattendue de Claude (pas de résultat structuré).");
  }
  return toolUse.input as T;
}
