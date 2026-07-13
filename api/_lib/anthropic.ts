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

// Same idea, but streams the plain-text response as it's generated (no tool
// use, since partial JSON can't be shown to the user as it arrives). Yields
// each text delta so the caller can forward it straight to the client.
export async function* streamClaudeText(params: {
  system: string;
  userText: string;
  maxTokens?: number;
}): AsyncGenerator<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnthropicError("ANTHROPIC_API_KEY n'est pas configurée sur le serveur.");
  }

  const { system, userText, maxTokens = 3072 } = params;

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
      messages: [{ role: "user", content: userText }],
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const errBody = await response.text().catch(() => "");
    throw new AnthropicError(`Erreur de l'API Claude (${response.status}) : ${errBody}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6);
      try {
        const event = JSON.parse(payload) as {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          yield event.delta.text ?? "";
        }
      } catch {
        // Ignore a fragment split across two chunks; the buffer above keeps
        // any incomplete trailing line for the next read.
      }
    }
  }
}
