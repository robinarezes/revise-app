import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUserId } from "./_lib/auth.js";
import { getStripe } from "./_lib/stripe.js";
import { getServiceClient } from "./_lib/supabaseService.js";

// Merges create-checkout-session and create-portal-session into one function
// (see api/ai.ts for why: staying under the hobby-plan function count).

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const userId = await requireUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "unauthorized", message: "Connecte-toi pour continuer." });
  }

  const { action } = req.body as { action?: string };

  try {
    const supabase = getServiceClient();

    if (action === "redeem-code") {
      const { code } = req.body as { code?: string };
      const normalized = (code ?? "").trim();
      if (!normalized) {
        return res.status(400).json({ error: "bad_request", message: "Code manquant." });
      }
      // Case-insensitive match: codes can be created with any casing in
      // Supabase, and students shouldn't have to type them exactly.
      const escaped = normalized.replace(/[%_\\]/g, (m) => `\\${m}`);

      const { data: codeRow } = await supabase
        .from("premium_codes")
        .select("code, redeemed_by")
        .ilike("code", escaped)
        .maybeSingle();

      if (!codeRow || (codeRow as { redeemed_by: string | null }).redeemed_by) {
        return res.status(400).json({ error: "invalid_code", message: "Code invalide ou déjà utilisé." });
      }

      await supabase
        .from("premium_codes")
        .update({ redeemed_by: userId, redeemed_at: new Date().toISOString() })
        .eq("code", (codeRow as { code: string }).code);
      await supabase.from("profiles").update({ subscription_status: "active" }).eq("id", userId);

      return res.status(200).json({ ok: true });
    }

    const stripe = getStripe();
    const origin =
      (typeof req.headers.origin === "string" && req.headers.origin) || `https://${req.headers.host}`;

    if (action === "checkout") {
      const { plan } = req.body as { plan?: "monthly" | "yearly" };
      const priceId =
        plan === "yearly" ? process.env.STRIPE_PRICE_ID_YEARLY : process.env.STRIPE_PRICE_ID_MONTHLY;
      if (!priceId) {
        return res.status(500).json({
          error: "not_configured",
          message: "L'abonnement n'est pas encore configuré sur le serveur.",
        });
      }

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

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}/#/settings?upgraded=1`,
        cancel_url: `${origin}/#/settings`,
        client_reference_id: userId,
      });

      return res.status(200).json({ url: session.url });
    }

    if (action === "portal") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", userId)
        .maybeSingle();

      const customerId = (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
      if (!customerId) {
        return res.status(400).json({ error: "no_subscription", message: "Aucun abonnement à gérer." });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/#/settings`,
      });

      return res.status(200).json({ url: session.url });
    }

    return res.status(400).json({ error: "bad_request", message: "Action inconnue. Recharge la page (une mise à jour a peut-être eu lieu) puis réessaie." });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue.";
    return res.status(502).json({ error: "stripe_error", message });
  }
}
