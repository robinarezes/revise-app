import { callBackend } from "./backendClient";

export function startCheckout(plan: "monthly" | "yearly"): Promise<{ url: string }> {
  return callBackend<{ url: string }>("/api/create-checkout-session", { plan });
}

export function openBillingPortal(): Promise<{ url: string }> {
  return callBackend<{ url: string }>("/api/create-portal-session", {});
}
