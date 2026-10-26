import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AiError } from "@/lib/ai/client";
import { getAccess } from "@/lib/billing/access";
import type { Feature } from "@/lib/config/plans";
import type { Profile } from "@/lib/types";

export type AiKind =
  | "fact_sheet"
  | "positioning"
  | "setup_guidance"
  | "calendar"
  | "regenerate"
  | "reply"
  | "review_request"
  | "weekly_review"
  | "safety_review";

// Onboarding AI runs before the trial starts, so owners see their fact sheet
// and positioning first. Capped so it can't be farmed.
const ONBOARDING_KINDS: AiKind[] = ["fact_sheet", "positioning", "setup_guidance"];
const PRE_TRIAL_ONBOARDING_RUNS = 8;

function monthStartIso() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export function hasFeature(profile: Profile, feature: Feature) {
  return getAccess(profile).plan.features.includes(feature);
}

// Enforces billing state and monthly plan limits before an AI call.
export async function assertCanRun(supabase: SupabaseClient, profile: Profile, kind: AiKind, businessId: string) {
  const access = getAccess(profile);

  if (ONBOARDING_KINDS.includes(kind) && !access.canGenerate) {
    const { count } = await supabase
      .from("ai_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.user_id)
      .in("kind", ONBOARDING_KINDS);
    if ((count ?? 0) >= PRE_TRIAL_ONBOARDING_RUNS)
      throw new AiError("Start your free trial to keep going.", "not_allowed");
    return;
  }

  if (!access.canGenerate) {
    throw new AiError(
      profile.subscription_status === "none" ? "Start your 7-day free trial to use this." : "Generation is paused on your account. Check billing in Settings.",
      "not_allowed",
    );
  }

  const limits = access.plan.limits;
  const since = monthStartIso();
  const countRuns = async (k: AiKind) => {
    const { count } = await supabase
      .from("ai_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.user_id)
      .eq("kind", k)
      .eq("status", "ok")
      .gte("created_at", since);
    return count ?? 0;
  };

  if (kind === "calendar") {
    const { count } = await supabase
      .from("calendars")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", since);
    if ((count ?? 0) >= limits.calendars_per_month)
      throw new AiError(`Your plan includes ${limits.calendars_per_month} calendar${limits.calendars_per_month === 1 ? "" : "s"} a month.`, "limit_reached");
  }
  if (kind === "regenerate" && (await countRuns("regenerate")) >= limits.regenerations_per_month)
    throw new AiError(`You've used all ${limits.regenerations_per_month} regenerations this month.`, "limit_reached");
  if (kind === "reply" && (await countRuns("reply")) >= limits.reply_helper_runs_per_month)
    throw new AiError(`You've used all ${limits.reply_helper_runs_per_month} Reply Helper drafts this month.`, "limit_reached");
  if (kind === "review_request") {
    const { count } = await supabase
      .from("review_requests")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", since);
    if ((count ?? 0) >= limits.review_requests_per_month)
      throw new AiError(`You've used all ${limits.review_requests_per_month} review requests this month.`, "limit_reached");
  }
  if (kind === "weekly_review" && !access.plan.features.includes("weekly_review"))
    throw new AiError("The weekly review with recommendations is on the Growth plan.", "not_allowed");
}
