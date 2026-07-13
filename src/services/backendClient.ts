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

// Calls our own /api backend (which holds the shared API key and enforces
// the free daily quota), authenticated with the current Supabase session.
export async function callBackend<T>(path: string, body: unknown): Promise<T> {
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

  const data2 = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = response.status === 401 ? "unauthenticated" : data2.error;
    throw new BackendError(data2.message ?? `Erreur serveur (${response.status}).`, code);
  }
  return data2 as T;
}
