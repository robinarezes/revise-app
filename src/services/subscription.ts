import { callBackend } from "./backendClient";

export function startCheckout(plan: "monthly" | "yearly"): Promise<{ url: string }> {
  return callBackend<{ url: string }>("/api/stripe-checkout", { action: "checkout", plan });
}

export function openBillingPortal(): Promise<{ url: string }> {
  return callBackend<{ url: string }>("/api/stripe-checkout", { action: "portal" });
}
