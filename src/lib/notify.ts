import "server-only";
import webpush from "web-push";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/utils";

let vapidReady = false;
function setupVapid() {
  if (vapidReady) return true;
  const pub = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(appUrl() || "mailto:support@example.com", pub, priv);
  vapidReady = true;
  return true;
}

export async function sendPush(userId: string, payload: { title: string; body: string; url?: string }) {
  if (!setupVapid()) return 0;
  const admin = createAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, keys").eq("user_id", userId);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys as { p256dh: string; auth: string } }, JSON.stringify(payload));
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return sent;
}

export async function sendEmail(to: string, subject: string, html: string, text?: string) {
  if (!process.env.RESEND_API_KEY) {
    console.info(`[email skipped: no RESEND_API_KEY] to=${to} subject=${subject}`);
    return false;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "Booked <hello@example.com>",
    to,
    subject,
    html,
    text,
  });
  if (error) console.error("Resend error", error);
  return !error;
}

export async function getOwnerContact(ownerId: string) {
  const { data } = await createAdminClient().from("profiles").select("email, notification_prefs").eq("user_id", ownerId).maybeSingle();
  return data as { email: string | null; notification_prefs: { push_enabled?: boolean; digest_email?: boolean; overdue_hours?: number; post_day_push?: boolean; post_day_hour?: number } } | null;
}

export async function notifyNewEnquiry(ownerId: string, businessId: string, name: string) {
  await sendPush(ownerId, {
    title: "New enquiry",
    body: `${name} sent you an enquiry. Reply fast: quick replies win more jobs.`,
    url: `/business/${businessId}/enquiries`,
  });
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
