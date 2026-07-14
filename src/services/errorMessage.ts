// `instanceof Error` peut être trompeur selon comment l'erreur a traversé
// les frontières de promesses/modules ; on retombe sur `.message` si présent
// avant d'abandonner, plutôt que d'afficher "Erreur inconnue" à tort.
export function errorMessage(e: unknown, fallback = "Erreur inconnue."): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  if (typeof e === "string" && e) return e;
  return fallback;
}
