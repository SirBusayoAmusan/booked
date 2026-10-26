import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/lib/cron";
import { escapeHtml, sendEmail, sendPush } from "@/lib/notify";
import { appUrl } from "@/lib/utils";

export const maxDuration = 60;

// "New enquiry not contacted after N hours" reminder (N is per owner,
// default 2). One reminder per enquiry: push if subscribed, else email.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const admin = createAdminClient();
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { data: rows } = await admin
    .from("enquiries")
    .select("id, name, created_at, business_id, businesses!inner(owner_id, name)")
    .eq("status", "new")
    .is("first_contacted_at", null)
    .is("overdue_notified_at", null)
    .gte("created_at", since)
    .lte("created_at", new Date(Date.now() - 30 * 60_000).toISOString())
    .limit(500);

  const owners = new Map<string, { email: string | null; prefs: { overdue_hours?: number; push_enabled?: boolean } } | null>();
  let sent = 0;
  for (const e of rows ?? []) {
    const biz = e.businesses as unknown as { owner_id: string; name: string };
    if (!owners.has(biz.owner_id)) {
      const { data } = await admin.from("profiles").select("email, notification_prefs").eq("user_id", biz.owner_id).maybeSingle();
      owners.set(biz.owner_id, data ? { email: data.email, prefs: data.notification_prefs ?? {} } : null);
    }
    const owner = owners.get(biz.owner_id);
    if (!owner) continue;
    const hours = owner.prefs.overdue_hours ?? 2;
    if (hours <= 0 || Date.now() - new Date(e.created_at).getTime() < hours * 3_600_000) continue;

    const url = `/business/${e.business_id}/enquiries`;
    const who = e.name || "Someone";
    const pushed = await sendPush(biz.owner_id, { title: "Enquiry waiting", body: `${who} is still waiting for a reply.`, url });
    if (!pushed && owner.email) {
      await sendEmail(
        owner.email,
        `${who} is waiting for a reply`,
        `<p>${escapeHtml(who)} sent ${escapeHtml(biz.name)} an enquiry and hasn't heard back yet. Quick replies win more jobs.</p><p><a href="${appUrl(url)}">Open your enquiries</a></p>`,
      );
    }
    await admin.from("enquiries").update({ overdue_notified_at: new Date().toISOString() }).eq("id", e.id);
    sent++;
  }
  return Response.json({ checked: rows?.length ?? 0, sent });
}
