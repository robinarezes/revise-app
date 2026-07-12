import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!client) {
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY non configurées sur le serveur.");
    }
    client = createClient(url, anonKey);
  }
  return client;
}

// Verifies a Supabase access token server-side and returns the user id, or
// null if the token is missing/invalid. Used to key the free daily quota to
// a real account instead of an anonymous visitor id.
export async function getUserIdFromToken(token: string): Promise<string | null> {
  const { data, error } = await getClient().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
