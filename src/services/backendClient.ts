import { supabase } from "../supabaseClient";

export type ImageContent = { base64: string; mediaType: string };

export class BackendError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

async function doFetch(path: string, body: unknown, token: string): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

// Shared plumbing: attach the session token, retry once on a stale token,
// and hand back the raw Response (still needs status/error handling by the
// caller, since the body shape differs between JSON and binary endpoints).
async function callBackendRaw(path: string, body: unknown): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new BackendError("Tu dois être connecté pour utiliser cette fonctionnalité.", "unauthenticated");
  }

  let response: Response;
  try {
    response = await doFetch(path, body, token);
  } catch {
    throw new BackendError("Impossible de contacter le serveur. Vérifie ta connexion internet.");
  }

  // The access token can expire (it's short-lived) even though the session
  // itself is still valid: refresh it once and retry before giving up.
  if (response.status === 401) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    const newToken = refreshed.session?.access_token;
    if (newToken) {
      try {
        response = await doFetch(path, body, newToken);
      } catch {
        throw new BackendError("Impossible de contacter le serveur. Vérifie ta connexion internet.");
      }
    }
  }

  return response;
}

// Calls our own /api backend (which holds the shared API key and enforces
// the free daily quota), authenticated with the current Supabase session.
export async function callBackend<T>(path: string, body: unknown): Promise<T> {
  const response = await callBackendRaw(path, body);
  const data2 = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = response.status === 401 ? "unauthenticated" : data2.error;
    throw new BackendError(data2.message ?? `Erreur serveur (${response.status}).`, code);
  }
  return data2 as T;
}

// Same as callBackend, but for endpoints that stream a plain-text body back
// progressively: onChunk fires for each piece of text as it arrives, so the
// caller can show it appearing live instead of waiting for the full reply.
export async function callBackendStream(
  path: string,
  body: unknown,
  onChunk: (chunk: string) => void
): Promise<void> {
  const response = await callBackendRaw(path, body);
  if (!response.ok || !response.body) {
    const data2 = await response.json().catch(() => ({}));
    const code = response.status === 401 ? "unauthenticated" : data2.error;
    throw new BackendError(data2.message ?? `Erreur serveur (${response.status}).`, code);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) onChunk(chunk);
  }
}

// Same as callBackendStream, but the body is NDJSON (one JSON object per
// line) : onItem fires for each line as soon as it's complete, instead of
// waiting for the whole response. Malformed lines are skipped rather than
// failing the whole call.
export async function callBackendNdjson<T>(
  path: string,
  body: unknown,
  onItem: (item: T) => void
): Promise<void> {
  let buffer = "";
  await callBackendStream(path, body, (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        onItem(JSON.parse(trimmed) as T);
      } catch {
        // Ligne coupée ou mal formée : on l'ignore plutôt que de casser
        // tout le quiz pour une question.
      }
    }
  });
  const trimmed = buffer.trim();
  if (trimmed) {
    try {
      onItem(JSON.parse(trimmed) as T);
    } catch {
      // Idem : dernière ligne incomplète, ignorée.
    }
  }
}

// Same as callBackend, but for endpoints that return a binary body (audio)
// instead of JSON.
export async function callBackendBlob(path: string, body: unknown): Promise<Blob> {
  const response = await callBackendRaw(path, body);
  if (!response.ok) {
    const data2 = await response.json().catch(() => ({}));
    const code = response.status === 401 ? "unauthenticated" : data2.error;
    throw new BackendError(data2.message ?? `Erreur serveur (${response.status}).`, code);
  }
  return response.blob();
}
