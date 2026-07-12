import { Redis } from "ioredis";

let client: Redis | null = null;

// Uses REDIS_URL, auto-injected by Vercel when a Redis database is
// connected to the project (Storage tab).
export function getRedis(): Redis {
  if (!client) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error("REDIS_URL n'est pas configurée sur le serveur.");
    }
    client = new Redis(url);
  }
  return client;
}
