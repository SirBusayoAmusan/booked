import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/utils";
import { SOURCE_LABEL } from "@/lib/enquiries";
import type { Business } from "@/lib/types";
import { weeklyReview } from "@/lib/ai/weekly-fns";
import { getAccess } from "@/lib/billing/access";
import { getPlan } from "@/lib/config/plans";
import type { Profile } from "@/lib/types";

export type WeekMetrics = {
  week_start: string;
  posts_planned: number;
  posts_posted: number;
  tracked_clicks: number;
  booking_link_clicks: number;
  enquiries_total: number;
  enquiries_by_source: Record<string, number>;
  bookings: number;
  logged_revenue: number;
  review_requests_sent: number;
  reviews_self_reported: number;
  posts: { post_id: string; hook: string; platform: string; pillar: string | null; status: string; tracked_clicks: number; tracked_enquiries: number }[];
};

// Numbers for one Monday-start week. Everything is "tracked" or "logged":
// Booked only counts what it can see or what the owner recorded.
export async function weekMetrics(db: SupabaseClient, business: Pick<Business, "id">, weekStartIso: string): Promise<WeekMetrics> {
  const from = weekStartIso;
  const to = addDays(weekStartIso, 7);
  const fromTs = `${from}T00:00:00Z`;
  const toTs = `${to}T00:00:00Z`;
  const [{ data: posts }, { data: clicks }, { data: enquiries }, { data: booked }, { data: reqs }] = await Promise.all([
    db.from("posts").select("id, hook, platform, pillar, status, calendars!inner(status)").eq("business_id", business.id).neq("calendars.status", "archived").gte("publish_date", from).lt("publish_date", to),
    db.from("link_clicks").select("post_id, kind").eq("business_id", business.id).gte("clicked_at", fromTs).lt("clicked_at", toTs),
    db.from("enquiries").select("id, source, post_id").eq("business_id", business.id).gte("created_at", fromTs).lt("created_at", toTs),
    db.from("enquiries").select("value_usd").eq("business_id", business.id).in("status", ["booked", "completed"]).gte("booked_at", fromTs).lt("booked_at", toTs),
    db.from("review_requests").select("status, sent_at").eq("business_id", business.id).gte("created_at", fromTs).lt("created_at", toTs),
  ]);

  const bySource: Record<string, number> = {};
  for (const e of enquiries ?? []) bySource[SOURCE_LABEL[e.source] ?? e.source] = (bySource[SOURCE_LABEL[e.source] ?? e.source] ?? 0) + 1;

  // Clicks and enquiries per post include ones that arrive this week for
  // posts from earlier weeks too.
  const postIds = new Set((posts ?? []).map((p) => p.id));
  const clickCount = new Map<string, number>();
  for (const c of clicks ?? []) if (c.post_id && c.kind === "tracked_link") clickCount.set(c.post_id, (clickCount.get(c.post_id) ?? 0) + 1);
  const enqCount = new Map<string, number>();
  for (const e of enquiries ?? []) if (e.post_id) enqCount.set(e.post_id, (enqCount.get(e.post_id) ?? 0) + 1);
  const extraIds = [...new Set([...clickCount.keys(), ...enqCount.keys()])].filter((id) => !postIds.has(id));
  const { data: extra } = extraIds.length ? await db.from("posts").select("id, hook, platform, pillar, status").in("id", extraIds) : { data: [] };

  const rows = [...(posts ?? []), ...(extra ?? [])].map((p) => ({
    post_id: p.id,
    hook: p.hook ?? "",
    platform: p.platform,
    pillar: p.pillar,
    status: p.status,
    tracked_clicks: clickCount.get(p.id) ?? 0,
    tracked_enquiries: enqCount.get(p.id) ?? 0,
  }));
  rows.sort((a, b) => b.tracked_enquiries - a.tracked_enquiries || b.tracked_clicks - a.tracked_clicks);

  return {
    week_start: weekStartIso,
    posts_planned: (posts ?? []).filter((p) => p.status !== "skipped").length,
    posts_posted: (posts ?? []).filter((p) => p.status === "posted").length,
    tracked_clicks: (clicks ?? []).filter((c) => c.kind === "tracked_link").length,
    booking_link_clicks: (clicks ?? []).filter((c) => c.kind === "booking_link").length,
    enquiries_total: (enquiries ?? []).length,
    enquiries_by_source: bySource,
    bookings: (booked ?? []).length,
    logged_revenue: (booked ?? []).reduce((s, r) => s + Number(r.value_usd ?? 0), 0),
    review_requests_sent: (reqs ?? []).filter((r) => r.status === "sent_by_owner" || r.status === "reviewed_self_reported").length,
    reviews_self_reported: (reqs ?? []).filter((r) => r.status === "reviewed_self_reported").length,
    posts: rows,
  };
}

// Plain summary used on plans without the AI weekly review, and as a
// fallback. States only numbers from the metrics.
export function basicSummary(m: WeekMetrics) {
  const parts = [`You posted ${m.posts_posted} of ${m.posts_planned} planned posts.`];
  parts.push(`${m.enquiries_total} enquir${m.enquiries_total === 1 ? "y was" : "ies were"} logged or tracked, with ${m.bookings} booking${m.bookings === 1 ? "" : "s"}.`);
  if (m.tracked_clicks) parts.push(`Tracked links got ${m.tracked_clicks} click${m.tracked_clicks === 1 ? "" : "s"}.`);
  if (m.review_requests_sent) parts.push(`You sent ${m.review_requests_sent} review request${m.review_requests_sent === 1 ? "" : "s"}.`);
  return parts.join(" ");
}


// Builds (or rebuilds) the stored weekly review for one week. Uses the AI
// review on plans that include it, and a plain summary otherwise.
export async function buildWeeklyReview(db: SupabaseClient, business: Business, profile: Profile, weekStartIso: string) {
  const [week, ...previous] = await Promise.all([0, 1, 2, 3].map((i) => weekMetrics(db, business, addDays(weekStartIso, -7 * i))));
  const monthStart = weekStartIso.slice(0, 8) + "01";
  const { data: monthBooked } = await db
    .from("enquiries")
    .select("value_usd")
    .eq("business_id", business.id)
    .in("status", ["booked", "completed"])
    .gte("booked_at", `${monthStart}T00:00:00Z`)
    .lt("booked_at", `${addDays(weekStartIso, 7)}T00:00:00Z`);
  const roi = {
    week_bookings: week.bookings,
    week_revenue: week.logged_revenue,
    month_bookings: (monthBooked ?? []).length,
    month_revenue: (monthBooked ?? []).reduce((s, r) => s + Number(r.value_usd ?? 0), 0),
    plan_price: getPlan(profile.plan_id).prices[business.currency],
    currency: business.currency,
  };

  let summary = basicSummary(week);
  let topPosts = week.posts.filter((p) => p.tracked_enquiries > 0 || p.tracked_clicks > 0).slice(0, 3).map((p) => ({ post_id: p.post_id, why_it_likely_worked: "" }));
  let recommendations: { action: string; reason: string; post_ids: string[] }[] = [];
  let nextWeekFocus: string | null = null;

  const access = getAccess(profile);
  if (access.canGenerate && access.plan.features.includes("weekly_review")) {
    try {
      const out = await weeklyReview({ business, userId: profile.user_id, week, previous });
      summary = out.summary;
      topPosts = out.top_posts;
      recommendations = out.recommendations;
      nextWeekFocus = out.next_week_focus;
    } catch (e) {
      console.error("weekly review AI failed; using plain summary", e);
    }
  }

  const row = {
    business_id: business.id,
    week_start: weekStartIso,
    metrics: { ...week, previous: previous.map(({ posts: _p, ...rest }) => rest) },
    roi,
    top_posts: topPosts,
    recommendations,
    summary,
    next_week_focus: nextWeekFocus,
  };
  const { data } = await db.from("weekly_reviews").upsert(row, { onConflict: "business_id,week_start" }).select("*").single();
  return data;
}
