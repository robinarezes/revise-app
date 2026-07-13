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

  const { plan } = req.body as { plan?: "monthly" | "yearly" };
  const priceId =
    plan === "yearly" ? process.env.STRIPE_PRICE_ID_YEARLY : process.env.STRIPE_PRICE_ID_MONTHLY;
  if (!priceId) {
    return res.status(500).json({
      error: "not_configured",
      message: "L'abonnement n'est pas encore configuré sur le serveur.",
    });
  }

  try {
    const stripe = getStripe();
    const supabase = getServiceClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    let customerId = (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
    if (!customerId) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      const customer = await stripe.customers.create({
        email: authUser.user?.email ?? undefined,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
    }

    const origin =
      (typeof req.headers.origin === "string" && req.headers.origin) || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/#/settings?upgraded=1`,
      cancel_url: `${origin}/#/settings`,
      client_reference_id: userId,
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue.";
    return res.status(502).json({ error: "stripe_error", message });
  }
}
