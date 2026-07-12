import { getRedis } from "./redis.js";

const DAILY_QUOTA = Number(process.env.DAILY_QUOTA ?? 5);
const KEY_TTL_SECONDS = 60 * 60 * 26; // a little over a day, as a safety margin

function todayKey(visitorId: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `quota:${visitorId}:${day}`;
}

export type QuotaResult = { allowed: boolean; remaining: number; limit: number };

// Increments today's usage counter for this visitor and reports whether
// they're still within the free daily quota. Soft/anonymous: identified by
// a client-generated id, not a hardened anti-abuse mechanism.
export async function checkAndConsumeQuota(visitorId: string): Promise<QuotaResult> {
  const key = todayKey(visitorId);
  const count = await getRedis().incr(key);
  if (count === 1) {
    await getRedis().expire(key, KEY_TTL_SECONDS);
  }
  return {
    allowed: count <= DAILY_QUOTA,
    remaining: Math.max(0, DAILY_QUOTA - count),
    limit: DAILY_QUOTA,
  };
}
