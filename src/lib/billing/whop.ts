import "server-only";
import { WhopClient, WhopEnvironment } from "@whop/sdk";
import { unwrapWebhook, WebhookVerificationError } from "@whop/sdk/helpers";
import type { Whop } from "@whop/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanId } from "@/lib/config/plans";
import { appUrl } from "@/lib/utils";
import { BillingError, type BillingProvider, type BillingState, type WebhookResult } from "./types";
import { mapWhopStatus } from "./status";

// Pinned API version: request and response shapes stay fixed until we
// deliberately move to a newer date (docs.whop.com/developer/api/versioning).
const API_VERSION = process.env.WHOP_API_VERSION_DATE || "2026-10-24";

let client: WhopClient | null = null;
function whop() {
  if (!process.env.WHOP_API_KEY) throw new BillingError("Billing isn't set up yet.", 503);
  client ??= new WhopClient({
    token: process.env.WHOP_API_KEY,
    environment: process.env.WHOP_ENVIRONMENT === "production" ? WhopEnvironment.Production : WhopEnvironment.Sandbox,
    apiVersionDate: API_VERSION,
  });
  return client;
}

// Variant (plan) ids per Booked plan, optionally per currency, e.g.
// WHOP_PLAN_ID_SOLO_GBP. Falls back to WHOP_PLAN_ID_SOLO.
export function whopPlanId(plan: PlanId, currency?: string | null) {
  const base = `WHOP_PLAN_ID_${plan.toUpperCase()}`;
  return (currency && process.env[`${base}_${currency.toUpperCase()}`]) || process.env[base] || null;
}

export function planFromWhopPlanId(whopPlan: string): PlanId | null {
  for (const plan of ["solo", "growth"] as PlanId[]) {
    for (const cur of ["", "_USD", "_GBP", "_AUD"]) {
      if (process.env[`WHOP_PLAN_ID_${plan.toUpperCase()}${cur}`] === whopPlan) return plan;
    }
  }
  return null;
}

async function membershipRefFor(userId: string) {
  const { data } = await createAdminClient().from("profiles").select("billing_membership_ref").eq("user_id", userId).maybeSingle();
  return data?.billing_membership_ref ?? null;
}

// Reads the membership from the API (webhook payloads can arrive out of
// order, and never include the affiliate) and stores the resulting state.
export async function syncMembership(membershipId: string, hintUserId?: string | null): Promise<string | null> {
  const m = await whop().memberships.retrieve({ id: membershipId });
  const admin = createAdminClient();
  let userId = (m.metadata?.app_user_id as string | undefined) ?? hintUserId ?? null;
  if (!userId) {
    const { data } = await admin.from("profiles").select("user_id").eq("billing_membership_ref", membershipId).maybeSingle();
    userId = data?.user_id ?? null;
  }
  if (!userId) return null;

  const status = mapWhopStatus(m);
  const { data: current } = await admin.from("profiles").select("past_due_since, referred_by, plan_id").eq("user_id", userId).maybeSingle();
  const state: BillingState = {
    subscription_status: status,
    plan_id: planFromWhopPlanId(m.plan_id) ?? (current?.plan_id as PlanId | undefined) ?? "solo",
    billing_customer_ref: m.user_id ?? m.member_id ?? null,
    billing_membership_ref: m.id,
    current_period_end: m.current_period_end ?? null,
    trial_ends_at: m.status === "trialing" ? (m.current_period_end ?? null) : null,
    past_due_since: status === "past_due" ? (current?.past_due_since ?? new Date().toISOString()) : null,
    referred_by: current?.referred_by ?? (m.affiliate ? m.affiliate.user_id : null),
    billing_currency: m.renewal_price?.currency ?? m.initial_price?.currency ?? null,
  };
  await admin.from("profiles").update({ ...state, billing_provider: "whop" }).eq("user_id", userId);
  return userId;
}

export const whopProvider: BillingProvider = {
  id: "whop",

  async createCheckout(userId, planId, opts) {
    const plan_id = whopPlanId(planId, opts.currency);
    if (!plan_id) throw new BillingError("That plan isn't available yet.", 503);
    const res = await whop().checkoutConfigurations.create({
      plan_id,
      // Links the membership back to this Booked account in webhooks.
      metadata: { app_user_id: userId, booked_plan: planId },
      redirect_url: appUrl(opts.returnPath ?? "/settings?checkout=done"),
      ...(opts.affiliateCode ? { affiliate_code: opts.affiliateCode } : {}),
    });
    if (!res.purchase_url) throw new BillingError("Couldn't start checkout. Please try again.", 502);
    return res.purchase_url;
  },

  async getManageUrl(userId) {
    const ref = await membershipRefFor(userId);
    if (!ref) return null;
    const m = await whop().memberships.retrieve({ id: ref });
    return m.manage_url ?? null;
  },

  async handleWebhook(rawBody, headers): Promise<WebhookResult> {
    let event: { id?: string; type: string; data: Record<string, unknown> };
    try {
      // Verifies the Standard Webhooks signature on the raw body and rejects
      // stale timestamps, before we trust anything in the payload.
      event = unwrapWebhook(rawBody, { headers, key: process.env.WHOP_WEBHOOK_SECRET });
    } catch (e) {
      if (e instanceof WebhookVerificationError) return { ok: false, status: 401, message: "Invalid signature" };
      return { ok: false, status: 500, message: "Webhook secret not configured" };
    }

    const eventId = headers["webhook-id"] ?? event.id;
    if (!eventId) return { ok: false, status: 400, message: "Missing event id" };
    const admin = createAdminClient();
    const { error: dup } = await admin.from("billing_events").insert({ provider: "whop", event_id: eventId, type: event.type });
    if (dup) {
      if (String(dup.code) === "23505") return { ok: true, duplicate: true, type: event.type };
      return { ok: false, status: 500, message: "Couldn't record event" };
    }

    try {
      let userId: string | null = null;
      if (event.type.startsWith("membership.")) {
        const m = event.data as unknown as Whop.Membership;
        userId = await syncMembership(m.id, (m.metadata?.app_user_id as string) ?? null);
      } else if (event.type === "payment.failed" || event.type === "payment.succeeded") {
        const p = event.data as unknown as Whop.Payment;
        if (p.membership_id) userId = await syncMembership(p.membership_id, (p.metadata?.app_user_id as string) ?? null);
      }
      return { ok: true, userId, type: event.type };
    } catch (e) {
      // Let Whop retry: forget the event so the retry isn't treated as a duplicate.
      await admin.from("billing_events").delete().eq("event_id", eventId);
      console.error("Whop webhook processing failed", e);
      return { ok: false, status: 500, message: "Processing failed" };
    }
  },

  async cancelOrPause(userId, action) {
    const id = await membershipRefFor(userId);
    if (!id) throw new BillingError("No subscription found.", 404);
    const api = whop().memberships;
    if (action === "pause") await api.pause({ id });
    else if (action === "resume") await api.resume({ id });
    else if (action === "cancel") await api.cancel({ id, cancel_at_period_end: true });
    else await api.update({ id, cancel_at_period_end: false });
    await syncMembership(id, userId);
  },
};
