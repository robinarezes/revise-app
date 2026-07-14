// Suivi local (par appareil) des thèmes de culture générale déjà essayés en
// mode Adulte : sert juste à afficher une coche sur les thèmes explorés et
// suggérer ceux qui ne le sont pas encore, pas besoin de le stocker côté serveur.
const STORAGE_KEY = "revise:explored-themes";

function readSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function getExploredThemes(): Set<string> {
  return readSet();
}

export function markThemeExplored(theme: string): void {
  const set = readSet();
  if (set.has(theme)) return;
  set.add(theme);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Stockage indisponible (navigation privée...) : tant pis, pas bloquant.
  }
}
