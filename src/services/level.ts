// Niveau dérivé du XP total (aucune donnée serveur en plus) : courbe
// quadratique, chaque niveau demande un peu plus de XP que le précédent.
function xpForLevel(level: number): number {
  return 20 * (level - 1) * (level - 1);
}

export function levelInfo(xp: number): {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number;
} {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const xpIntoLevel = xp - base;
  const xpForNextLevel = next - base;
  return { level, xpIntoLevel, xpForNextLevel, progress: xpIntoLevel / xpForNextLevel };
}
