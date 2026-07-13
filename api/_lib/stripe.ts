import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY n'est pas configurée sur le serveur.");
    }
    client = new Stripe(key);
  }
  return client;
}
