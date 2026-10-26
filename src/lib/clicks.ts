import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, privacyHash } from "@/lib/hash";

// Logs a click without storing raw IPs or user agents.
export async function logClick(opts: { businessId: string; postId: string | null; kind: "tracked_link" | "booking_link"; headers: Headers }) {
  const ua = opts.headers.get("user-agent") ?? "";
  // Skip obvious link-preview bots so tracked counts stay honest.
  if (/bot|crawler|spider|preview|facebookexternalhit|whatsapp|slackbot|discordbot|telegrambot/i.test(ua)) return;
  const referrer = opts.headers.get("referer");
  let refHost: string | null = null;
  try {
    refHost = referrer ? new URL(referrer).host : null;
  } catch {
    refHost = null;
  }
  await createAdminClient().from("link_clicks").insert({
    business_id: opts.businessId,
    post_id: opts.postId,
    kind: opts.kind,
    referrer: refHost,
    ua_hash: privacyHash(clientIp(opts.headers) + "|" + ua, "click"),
  });
}
