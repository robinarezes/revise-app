// Record personnel par matière pour le Quiz général, gardé en local (pas
// besoin de synchro serveur pour une simple auto-comparaison).
function key(subject: string): string {
  return `revise:best:${subject}`;
}

export function getPersonalBest(subject: string): number {
  const raw = localStorage.getItem(key(subject));
  return raw ? Number(raw) || 0 : 0;
}

// Retourne true si ce score bat (ou égale un premier) le record.
export function reportScore(subject: string, score: number): boolean {
  const best = getPersonalBest(subject);
  if (score > best) {
    localStorage.setItem(key(subject), String(score));
    return true;
  }
  return false;
}
