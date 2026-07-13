import { callBackend } from "./backendClient";

export function startCheckout(plan: "monthly" | "yearly"): Promise<{ url: string }> {
  return callBackend<{ url: string }>("/api/stripe-checkout", { action: "checkout", plan });
}

export function openBillingPortal(): Promise<{ url: string }> {
  return callBackend<{ url: string }>("/api/stripe-checkout", { action: "portal" });
}

export function redeemPremiumCode(code: string): Promise<{ ok: true }> {
  return callBackend<{ ok: true }>("/api/stripe-checkout", { action: "redeem-code", code });
}
