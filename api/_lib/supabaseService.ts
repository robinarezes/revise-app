import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Service-role client: bypasses RLS entirely. Only used server-side for
// operations with no authenticated user context (the Stripe webhook) or
// that must read/write columns the "authenticated" role can't touch
// (subscription status).
export function getServiceClient(): SupabaseClient {
  if (!client) {
    const url = process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY n'est pas configurée sur le serveur.");
    }
    client = createClient(url, serviceKey, { auth: { persistSession: false } });
  }
  return client;
}
