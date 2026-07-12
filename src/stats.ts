const STATS_KEY = "revise:stats";

export type Stats = {
  xp: number;
  streak: number;
  lastActiveDate: string | null;
};

const DEFAULT_STATS: Stats = { xp: 0, streak: 0, lastActiveDate: null };

export function getStats(): Stats {
  const raw = localStorage.getItem(STATS_KEY);
  if (!raw) return { ...DEFAULT_STATS };
  return { ...DEFAULT_STATS, ...JSON.parse(raw) };
}

function saveStats(stats: Stats): void {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function dateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// Call once per study action (lesson added, quiz finished). Bumps the streak
// by one the first time it's called on a new day, resets it if a day was skipped.
export function recordActivity(): Stats {
  const stats = getStats();
  const today = dateStr(0);
  if (stats.lastActiveDate === today) {
    // already counted today
  } else if (stats.lastActiveDate === dateStr(-1)) {
    stats.streak += 1;
  } else {
    stats.streak = 1;
  }
  stats.lastActiveDate = today;
  saveStats(stats);
  return stats;
}

export function addXp(amount: number): Stats {
  const stats = getStats();
  stats.xp += amount;
  saveStats(stats);
  return stats;
}
