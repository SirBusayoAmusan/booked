import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized, localClock } from "@/lib/cron";
import { activeBusinesses } from "@/lib/cron-businesses";
import { buildWeeklyReview } from "@/lib/weekly";
import { weeklyDigestEmail } from "@/lib/emails";
import { sendEmail } from "@/lib/notify";
import { computeRoi } from "@/lib/roi";
import { addDays, appUrl, nextMonthStart, todayIn, weekStart } from "@/lib/utils";
import type { WeeklyReview } from "@/lib/types";

export const maxDuration = 300;

// Runs hourly. Sends each owner "Your plan for this week" on Monday morning
// in their own timezone (7:00 to 11:59), once per week.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const admin = createAdminClient();
  const force = new URL(request.url).searchParams.get("force") === "1";
  let sent = 0;
  const started = Date.now();

  for (const { business, profile } of await activeBusinesses()) {
    if (Date.now() - started > 240_000) break; // leave the rest for the next run
    if (!profile.notification_prefs?.digest_email || !profile.email) continue;
    const { hour, weekday } = localClock(business.timezone);
    if (!force && !(weekday === 1 && hour >= 7 && hour < 12)) continue;

    const today = todayIn(business.timezone);
    const thisWeek = weekStart(new Date(today + "T00:00:00Z"));
    const lastWeek = addDays(thisWeek, -7);
    const { data: existing } = await admin.from("weekly_reviews").select("*").eq("business_id", business.id).eq("week_start", lastWeek).maybeSingle();
    if (existing?.email_sent_at && !force) continue;

    try {
      const review = (existing?.summary ? existing : await buildWeeklyReview(admin, business, profile, lastWeek)) as WeeklyReview | null;
      const [{ data: posts }, { data: shoot }, roi] = await Promise.all([
        admin.from("posts").select("publish_date, platform, hook, calendars!inner(status)").eq("business_id", business.id).neq("calendars.status", "archived").gte("publish_date", thisWeek).lte("publish_date", addDays(thisWeek, 6)).order("publish_date"),
        admin.from("shoot_days").select("estimated_minutes, week_start, calendars!inner(status)").eq("business_id", business.id).neq("calendars.status", "archived").eq("week_start", thisWeek).maybeSingle(),
        computeRoi(admin, business, profile, `${today.slice(0, 8)}01T00:00:00Z`, `${nextMonthStart(today)}T00:00:00Z`),
      ]);
      const m = (review?.metrics ?? {}) as { enquiries_total?: number; bookings?: number };
      const email = weeklyDigestEmail({
        businessName: business.name,
        locale: business.locale,
        currency: business.currency,
        todayUrl: appUrl(`/business/${business.id}/today`),
        shoot: shoot ? { minutes: shoot.estimated_minutes, url: appUrl(`/business/${business.id}/shoot/${thisWeek}`) } : null,
        posts: (posts ?? []).map((p) => ({ date: p.publish_date, platform: p.platform, hook: p.hook ?? "" })),
        lastWeek: { enquiries: m.enquiries_total ?? 0, bookings: m.bookings ?? 0 },
        roi: { revenue: roi.revenue, planPrice: roi.planPrice },
        summary: review?.summary ?? null,
      });
      if (await sendEmail(profile.email, email.subject, email.html, email.text)) {
        await admin.from("weekly_reviews").update({ email_sent_at: new Date().toISOString() }).eq("business_id", business.id).eq("week_start", lastWeek);
        sent++;
      }
    } catch (e) {
      console.error("digest failed for", business.id, e);
    }
  }
  return Response.json({ sent });
}
