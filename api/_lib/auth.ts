import type { VercelRequest } from "@vercel/node";
import { getUserIdFromToken } from "./supabaseAdmin.js";

// Extracts and verifies the Supabase access token from the Authorization
// header, returning the authenticated user's id (used to key the free
// daily quota) or null if missing/invalid.
export async function requireUserId(req: VercelRequest): Promise<string | null> {
  const authHeader = req.headers["authorization"];
  if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  if (!token) return null;
  return getUserIdFromToken(token);
}
