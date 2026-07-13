import { getRedis } from "./redis.js";
import { getServiceClient } from "./supabaseService.js";

const DAILY_QUOTA = Number(process.env.DAILY_QUOTA ?? 5);
const KEY_TTL_SECONDS = 60 * 60 * 26; // a little over a day, as a safety margin

function todayKey(userId: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `quota:${userId}:${day}`;
}

export type QuotaResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  unlimited?: boolean;
};

async function isSubscribed(userId: string): Promise<boolean> {
  try {
    const { data } = await getServiceClient()
      .from("profiles")
      .select("subscription_status")
      .eq("id", userId)
      .maybeSingle();
    return (data as { subscription_status?: string } | null)?.subscription_status === "active";
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY not configured yet, or a transient error:
    // fail back to the normal free quota rather than blocking every request.
    return false;
  }
}

// Increments today's usage counter for this authenticated user and reports
// whether they're still within the free daily quota. Subscribers skip the
// counter entirely.
export async function checkAndConsumeQuota(userId: string): Promise<QuotaResult> {
  if (await isSubscribed(userId)) {
    return { allowed: true, remaining: DAILY_QUOTA, limit: DAILY_QUOTA, unlimited: true };
  }
  const key = todayKey(userId);
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
