import { supabase } from "../supabaseClient";

export type ImageContent = { base64: string; mediaType: string };

export class BackendError extends Error {}

// Calls our own /api backend (which holds the shared API key and enforces
// the free daily quota), authenticated with the current Supabase session.
export async function callBackend<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new BackendError("Tu dois être connecté pour utiliser cette fonctionnalité.");
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new BackendError("Impossible de contacter le serveur. Vérifie ta connexion internet.");
  }

  const data2 = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new BackendError(data2.message ?? `Erreur serveur (${response.status}).`);
  }
  return data2 as T;
}
