import type { VercelRequest, VercelResponse } from "@vercel/node";
import type Stripe from "stripe";
import { getStripe } from "./_lib/stripe.js";
import { getServiceClient } from "./_lib/supabaseService.js";

// Stripe needs the raw, unparsed request body to verify the webhook
// signature, so we disable Vercel's default JSON body parsing here.
export const config = {
  api: { bodyParser: false },
};

function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function setSubscriptionByCustomer(
  customerId: string,
  status: string,
  subscriptionId: string | null
) {
  const supabase = getServiceClient();
  await supabase
    .from("profiles")
    .update({
      subscription_status: status,
      stripe_subscription_id: subscriptionId,
    })
    .eq("stripe_customer_id", customerId);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers["stripe-signature"];
  if (!webhookSecret || typeof signature !== "string") {
    return res.status(400).send("Webhook non configuré.");
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Signature invalide.";
    return res.status(400).send(`Webhook Error: ${message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && typeof session.customer === "string") {
          const subscriptionId =
            typeof session.subscription === "string" ? session.subscription : null;
          await setSubscriptionByCustomer(session.customer, "active", subscriptionId);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;
        const status =
          subscription.status === "active" || subscription.status === "trialing"
            ? "active"
            : subscription.status;
        await setSubscriptionByCustomer(customerId, status, subscription.id);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;
        await setSubscriptionByCustomer(customerId, "canceled", null);
        break;
      }
      default:
        break;
    }
    return res.status(200).json({ received: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue.";
    return res.status(500).json({ error: "webhook_handler_error", message });
  }
}
