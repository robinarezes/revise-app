import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

// Uses UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN, auto-injected by
// Vercel when a Redis (Upstash) database is connected to the project.
export function getRedis(): Redis {
  if (!redis) redis = Redis.fromEnv();
  return redis;
}
