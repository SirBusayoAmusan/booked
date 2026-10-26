// Test prices, not validated. Prices, trial length and limits live here, not
// in product code, so they can change without touching features.
export type PlanId = "solo" | "growth";
export type Currency = "USD" | "GBP" | "AUD";

export type PlanLimits = {
  businesses: number;
  calendars_per_month: number;
  regenerations_per_month: number;
  reply_helper_runs_per_month: number;
  review_requests_per_month: number;
};

export type Feature =
  | "calendar"
  | "shoot_day"
  | "safety_gate"
  | "tracking"
  | "enquiries"
  | "review_kit"
  | "weekly_review"
  | "gbp_pack"
  | "voice_learning";

export type Plan = {
  id: PlanId;
  name: string;
  prices: Record<Currency, number>;
  limits: PlanLimits;
  features: Feature[];
  includes: string[];
};

export const TRIAL_DAYS = 7;
export const PAST_DUE_GRACE_DAYS = 3;
export const ANNUAL_FREE_MONTHS = 2;

export const PLANS: Record<PlanId, Plan> = {
  solo: {
    id: "solo",
    name: "Solo",
    prices: { USD: 49, GBP: 39, AUD: 75 },
    limits: {
      businesses: 1,
      calendars_per_month: 1,
      regenerations_per_month: 20,
      reply_helper_runs_per_month: 60,
      review_requests_per_month: 50,
    },
    features: ["calendar", "shoot_day", "safety_gate", "tracking", "enquiries", "review_kit"],
    includes: ["Calendar", "Shoot Day", "Safety gate", "Tracked links and code words", "Enquiry inbox", "Review Kit"],
  },
  growth: {
    id: "growth",
    name: "Growth",
    prices: { USD: 99, GBP: 79, AUD: 149 },
    limits: {
      businesses: 1,
      calendars_per_month: 2,
      regenerations_per_month: 60,
      reply_helper_runs_per_month: 300,
      review_requests_per_month: 300,
    },
    features: [
      "calendar",
      "shoot_day",
      "safety_gate",
      "tracking",
      "enquiries",
      "review_kit",
      "weekly_review",
      "gbp_pack",
      "voice_learning",
    ],
    includes: [
      "Everything in Solo",
      "Weekly review with ROI",
      "Google Business Profile pack",
      "Voice learning from edits",
      "Priority email support",
    ],
  },
};

// During the trial owners get the full Growth feature set so they can judge it.
export const TRIAL_PLAN: PlanId = "growth";

export function getPlan(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) in PLANS ? (id as PlanId) : "solo"];
}

// Affiliate commission is configured in Whop, not here. This value is only
// shown on the partners FAQ and must match what is set in the Whop dashboard.
export const AFFILIATE_COMMISSION_NOTE = "Recurring commission, set in our Whop affiliate program.";

// AI usage costs per million tokens, used for the admin cost view.
export const AI_PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};
