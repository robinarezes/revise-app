import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUserId } from "./_lib/auth.js";
import { getStripe } from "./_lib/stripe.js";
import { getServiceClient } from "./_lib/supabaseService.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const userId = await requireUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "unauthorized", message: "Connecte-toi pour continuer." });
  }

  try {
    const supabase = getServiceClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    const customerId = (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
    if (!customerId) {
      return res.status(400).json({ error: "no_subscription", message: "Aucun abonnement à gérer." });
    }

    const origin =
      (typeof req.headers.origin === "string" && req.headers.origin) || `https://${req.headers.host}`;

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/#/settings`,
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue.";
    return res.status(502).json({ error: "stripe_error", message });
  }
}
