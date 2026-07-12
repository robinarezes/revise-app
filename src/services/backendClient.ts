import { getVisitorId } from "../visitorId";

export class BackendError extends Error {}

// Calls our own /api backend (which holds the shared API key and enforces
// the free daily quota), used when the visitor hasn't supplied their own key.
export async function callBackend<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-visitor-id": getVisitorId(),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new BackendError("Impossible de contacter le serveur. Vérifie ta connexion internet.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new BackendError(data.message ?? `Erreur serveur (${response.status}).`);
  }
  return data as T;
}
