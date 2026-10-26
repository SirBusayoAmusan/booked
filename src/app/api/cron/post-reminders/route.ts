import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized, localClock } from "@/lib/cron";
import { activeBusinesses, once } from "@/lib/cron-businesses";
import { sendPush } from "@/lib/notify";
import { todayIn } from "@/lib/utils";

// Hourly. Optional push at the owner's chosen hour on days a post is due.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const admin = createAdminClient();
  let sent = 0;
  for (const { business, profile } of await activeBusinesses()) {
    const prefs = profile.notification_prefs;
    if (!prefs?.push_enabled || !prefs.post_day_push) continue;
    if (localClock(business.timezone).hour !== (prefs.post_day_hour ?? 9)) continue;
    const today = todayIn(business.timezone);
    const { data: due } = await admin
      .from("posts")
      .select("id, hook, calendars!inner(status)")
      .eq("business_id", business.id)
      .neq("calendars.status", "archived")
      .eq("publish_date", today)
      .in("status", ["draft", "ready"])
      .limit(1);
    if (!due?.length || !(await once(`postday:${business.id}:${today}`, 30 * 86_400))) continue;
    await sendPush(profile.user_id, { title: "Post due today", body: due[0].hook ?? "Today's post is ready to copy.", url: `/business/${business.id}/posts/${due[0].id}` });
    sent++;
  }
  return Response.json({ sent });
}
