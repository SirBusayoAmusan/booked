import type { Metadata } from "next";
import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { getAccess } from "@/lib/billing/access";
import { formatDate, formatMoney } from "@/lib/config/locale";
import { computeRoi } from "@/lib/roi";
import { weekMetrics } from "@/lib/weekly";
import { addDays, nextMonthStart, todayIn, weekStart } from "@/lib/utils";
import type { WeeklyReview } from "@/lib/types";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PlatformBadge } from "@/components/post-badges";
import { RoiCard } from "@/components/roi-card";
import { GenerateReviewButton } from "./generate-button";

export const metadata: Metadata = { title: "Weekly review" };

export default async function WeeklyReviewPage(props: PageProps<"/business/[id]/review">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const { supabase, business, profile } = await requireBusiness(id);
  const access = getAccess(profile);
  const today = todayIn(business.timezone);
  const thisWeek = weekStart(new Date(today + "T00:00:00Z"));
  const ws = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? weekStart(new Date(sp.week + "T00:00:00Z")) : addDays(thisWeek, -7);
  const monthStart = today.slice(0, 8) + "01";

  const [m, { data: stored }, roi] = await Promise.all([
    weekMetrics(supabase, business, ws),
    supabase.from("weekly_reviews").select("*").eq("business_id", id).eq("week_start", ws).maybeSingle(),
    computeRoi(supabase, business, profile, `${monthStart}T00:00:00Z`, `${nextMonthStart(today)}T00:00:00Z`),
  ]);
  const review = stored as WeeklyReview | null;
  const hookById = new Map(m.posts.map((p) => [p.post_id, p]));
  const aiPlan = access.plan.features.includes("weekly_review");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Weekly review</h1>
          <p className="text-sm text-muted-foreground">Week of {formatDate(ws, business.locale, { day: "numeric", month: "long" })}</p>
        </div>
        <div className="flex gap-1 text-sm">
          <Link className="flex h-11 items-center rounded-xl border border-border px-3" href={`?week=${addDays(ws, -7)}`} aria-label="Previous week">
            ←
          </Link>
          {ws < thisWeek && (
            <Link className="flex h-11 items-center rounded-xl border border-border px-3" href={`?week=${addDays(ws, 7)}`} aria-label="Next week">
              →
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Posts done" value={`${m.posts_posted} / ${m.posts_planned}`} />
        <Stat label="Tracked clicks" value={m.tracked_clicks} />
        <Stat label="Book now clicks" value={m.booking_link_clicks} />
        <Stat label="Enquiries (tracked + logged)" value={m.enquiries_total} />
        <Stat label="Bookings logged" value={m.bookings} />
        <Stat label="Logged revenue" value={formatMoney(m.logged_revenue, business.currency, business.locale)} />
        <Stat label="Review requests sent" value={m.review_requests_sent} />
      </div>

      {Object.keys(m.enquiries_by_source).length > 0 && (
        <Card className="flex flex-col gap-1">
          <CardTitle>Enquiries by source</CardTitle>
          {Object.entries(m.enquiries_by_source).map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span>{k}</span>
              <span className="font-semibold">{v}</span>
            </div>
          ))}
        </Card>
      )}

      <RoiCard roi={roi} locale={business.locale} />

      <Card className="flex flex-col gap-2">
        <CardTitle>{review?.summary ? "Summary" : "Your review"}</CardTitle>
        {review?.summary ? <p className="text-sm">{review.summary}</p> : <CardDescription>No review written for this week yet.</CardDescription>}
        {review?.next_week_focus && (
          <p className="text-sm">
            <span className="font-medium">Next week: </span>
            {review.next_week_focus}
          </p>
        )}
        {review && review.recommendations.length > 0 && (
          <ol className="list-decimal pl-5 text-sm">
            {review.recommendations.slice(0, 3).map((r, i) => (
              <li key={i} className="mb-1">
                <span className="font-medium">{r.action}</span> <span className="text-muted-foreground">{r.reason}</span>
              </li>
            ))}
          </ol>
        )}
        <GenerateReviewButton businessId={id} weekStart={ws} hasReview={Boolean(review)} />
        {!aiPlan && <CardDescription>Recommendations come with the Growth plan. You still get the numbers every week.</CardDescription>}
      </Card>

      <Card className="flex flex-col gap-2">
        <CardTitle>Top posts by tracked enquiries</CardTitle>
        {m.posts.filter((p) => p.tracked_enquiries || p.tracked_clicks).length === 0 ? (
          <CardDescription>No tracked clicks or enquiries this week. Use your tracked link in your bio and stories, and Quick Log the DMs and calls.</CardDescription>
        ) : (
          <ul className="flex flex-col gap-2">
            {m.posts
              .filter((p) => p.tracked_enquiries || p.tracked_clicks)
              .slice(0, 5)
              .map((p) => {
                const why = review?.top_posts.find((t) => t.post_id === p.post_id)?.why_it_likely_worked;
                return (
                  <li key={p.post_id}>
                    <Link href={`/business/${id}/posts/${p.post_id}`} className="block rounded-xl border border-border p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <PlatformBadge platform={p.platform} />
                        <span className="text-xs text-muted-foreground">
                          {p.tracked_enquiries} enquir{p.tracked_enquiries === 1 ? "y" : "ies"} · {p.tracked_clicks} click{p.tracked_clicks === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="mt-1 font-medium">{hookById.get(p.post_id)?.hook}</p>
                      {why && <p className="text-xs text-muted-foreground">{why}</p>}
                    </Link>
                  </li>
                );
              })}
          </ul>
        )}
        <CardDescription>Figures are tracked, not total. Many enquiries come through DMs and calls; Quick Log them so this gets more accurate.</CardDescription>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-3">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}
