import { getRedis } from "./redis.js";

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

// Shared, cross-visitor cache for AI-generated curriculum content (subject
// lists, topic lists, full lessons). Lets one person's generation (e.g. a
// lesson on Pythagore) be reused by everyone else instead of re-billing the
// API for the same content.
export async function getCached<T>(key: string): Promise<T | null> {
  const raw = await getRedis().get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function setCached<T>(key: string, value: T): Promise<void> {
  await getRedis().set(key, JSON.stringify(value), "EX", CACHE_TTL_SECONDS);
}
