import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized, localClock } from "@/lib/cron";
import { activeBusinesses, once } from "@/lib/cron-businesses";
import { sendEmail, sendPush } from "@/lib/notify";
import { appUrl, nextMonthStart, todayIn } from "@/lib/utils";

// From the 25th, reminds owners once to plan next month. The new calendar
// uses last month's weekly review as context automatically.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const admin = createAdminClient();
  let sent = 0;
  for (const { business, profile } of await activeBusinesses()) {
    const today = todayIn(business.timezone);
    if (Number(today.slice(8)) < 25 || localClock(business.timezone).hour < 9) continue;
    const next = nextMonthStart(today);
    const { count } = await admin.from("calendars").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("month_start", next);
    if (count) continue;
    if (!(await once(`month:${business.id}:${next}`, 400 * 86_400))) continue;
    const url = `/business/${business.id}/calendar?generate=1`;
    const pushed = await sendPush(profile.user_id, { title: "Plan next month", body: "Build next month's calendar. It takes about a minute.", url });
    if (!pushed && profile.email) {
      await sendEmail(profile.email, "Time to plan next month", `<p>Next month starts soon. Build your calendar in about a minute; it uses what worked this month.</p><p><a href="${appUrl(url)}">Plan next month</a></p>`);
    }
    sent++;
  }
  return Response.json({ sent });
}
