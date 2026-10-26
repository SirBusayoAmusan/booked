import type { PlanId } from "@/lib/config/plans";
import type { SubscriptionStatus } from "@/lib/types";

export type BillingState = {
  subscription_status: SubscriptionStatus;
  plan_id?: PlanId;
  billing_customer_ref?: string | null;
  billing_membership_ref?: string | null;
  trial_ends_at?: string | null;
  past_due_since?: string | null;
  current_period_end?: string | null;
  referred_by?: string | null;
  billing_currency?: string | null;
};

export type WebhookResult =
  | { ok: true; duplicate?: boolean; userId?: string | null; type: string }
  | { ok: false; status: number; message: string };

// Provider-agnostic billing. Product code only talks to this interface, so
// Whop can be swapped for Stripe without touching features.
export interface BillingProvider {
  readonly id: "whop" | "stripe";
  createCheckout(userId: string, planId: PlanId, opts: { email: string | null; currency: string; affiliateCode?: string | null; returnPath?: string }): Promise<string>;
  getManageUrl(userId: string): Promise<string | null>;
  handleWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookResult>;
  cancelOrPause(userId: string, action: "pause" | "resume" | "cancel" | "undo_cancel"): Promise<void>;
}

export class BillingError extends Error {
  constructor(
    public userMessage: string,
    public status = 400,
  ) {
    super(userMessage);
  }
}
