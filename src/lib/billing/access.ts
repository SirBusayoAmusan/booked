import { PAST_DUE_GRACE_DAYS, TRIAL_PLAN, getPlan, type Plan } from "@/lib/config/plans";
import type { Profile } from "@/lib/types";

export type Access = {
  canGenerate: boolean;
  readOnly: boolean;
  plan: Plan;
  banner: { tone: "info" | "warning" | "danger"; text: string; cta?: { label: string; href: string } } | null;
};

// Access rules per subscription state (spec: billing.access_rules).
// - trialing/active: full access within plan limits
// - past_due: read access + banner; generation disabled after the grace period
// - canceled/paused/none: read-only, generation disabled
export function getAccess(profile: Pick<Profile, "subscription_status" | "plan_id" | "past_due_since" | "trial_ends_at">, now = new Date()): Access {
  const status = profile.subscription_status;
  const plan = status === "trialing" ? getPlan(TRIAL_PLAN) : getPlan(profile.plan_id);

  if (status === "active") return { canGenerate: true, readOnly: false, plan, banner: null };

  if (status === "trialing") {
    const ends = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
    const daysLeft = ends ? Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / 86_400_000)) : null;
    return {
      canGenerate: true,
      readOnly: false,
      plan,
      banner:
        daysLeft !== null && daysLeft <= 3
          ? { tone: "info", text: `Your free trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`, cta: { label: "Billing", href: "/settings#billing" } }
          : null,
    };
  }

  if (status === "past_due") {
    const since = profile.past_due_since ? new Date(profile.past_due_since) : now;
    const inGrace = now.getTime() - since.getTime() < PAST_DUE_GRACE_DAYS * 86_400_000;
    return {
      canGenerate: inGrace,
      readOnly: false,
      plan,
      banner: {
        tone: "danger",
        text: inGrace
          ? "Your last payment didn't go through. Update your card to keep generating plans."
          : "Your last payment didn't go through, so new plans and drafts are paused. Your data is safe.",
        cta: { label: "Update payment", href: "/api/billing/manage" },
      },
    };
  }

  const text =
    status === "paused"
      ? "Your subscription is paused. You can still see your calendar, enquiries and export your data."
      : status === "canceled"
        ? "Your subscription has ended. You can still see your calendar, enquiries and export your data."
        : "Start your 7-day free trial to generate your plan.";
  return {
    canGenerate: false,
    readOnly: true,
    plan,
    banner: { tone: status === "none" ? "info" : "warning", text, cta: { label: status === "none" ? "Start free trial" : "Choose a plan", href: "/settings#billing" } },
  };
}
