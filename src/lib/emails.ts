import { escapeHtml } from "@/lib/notify";
import { formatDate, formatMoney, type Locale } from "@/lib/config/locale";
import type { Currency } from "@/lib/config/plans";

type DigestInput = {
  businessName: string;
  locale: Locale;
  currency: Currency;
  todayUrl: string;
  shoot: { minutes: number; url: string } | null;
  posts: { date: string; platform: string; hook: string }[];
  lastWeek: { enquiries: number; bookings: number };
  roi: { revenue: number; planPrice: number };
  summary: string | null;
};

const PLATFORM: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", google_business: "Google", whatsapp_status: "WhatsApp status" };

export function weeklyDigestEmail(d: DigestInput) {
  const money = (n: number) => formatMoney(n, d.currency, d.locale);
  const posts = d.posts
    .map((p) => `<li style="margin:0 0 6px">${escapeHtml(formatDate(p.date, d.locale))} · ${escapeHtml(PLATFORM[p.platform] ?? p.platform)}: ${escapeHtml(p.hook)}</li>`)
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#fbfaf7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <p style="font-size:14px;color:#57534e;margin:0">${escapeHtml(d.businessName)}</p>
  <h1 style="font-size:22px;margin:4px 0 16px">Your plan for this week</h1>
  ${
    d.shoot
      ? `<div style="background:#fff;border:1px solid #e7e5e0;border-radius:16px;padding:16px;margin-bottom:12px">
    <p style="margin:0;font-weight:600">Shoot Day: about ${d.shoot.minutes} minutes</p>
    <p style="margin:4px 0 0;font-size:14px;color:#57534e">Film everything for the week in one go. <a href="${d.shoot.url}" style="color:#0f766e">See the shot list</a></p>
  </div>`
      : ""
  }
  <div style="background:#fff;border:1px solid #e7e5e0;border-radius:16px;padding:16px;margin-bottom:12px">
    <p style="margin:0 0 8px;font-weight:600">This week's posts</p>
    ${posts ? `<ul style="padding-left:18px;margin:0;font-size:14px">${posts}</ul>` : `<p style="margin:0;font-size:14px;color:#57534e">No posts planned. Build next month's plan in Booked.</p>`}
  </div>
  <div style="background:#fff;border:1px solid #e7e5e0;border-radius:16px;padding:16px;margin-bottom:12px;font-size:14px">
    <p style="margin:0 0 4px;font-weight:600">Last week</p>
    <p style="margin:0">${d.lastWeek.enquiries} enquir${d.lastWeek.enquiries === 1 ? "y" : "ies"} tracked or logged, ${d.lastWeek.bookings} booking${d.lastWeek.bookings === 1 ? "" : "s"}.</p>
    <p style="margin:4px 0 0">This month: ${money(d.roi.revenue)} logged revenue vs ${money(d.roi.planPrice)} plan cost.</p>
    ${d.summary ? `<p style="margin:8px 0 0;color:#57534e">${escapeHtml(d.summary)}</p>` : ""}
  </div>
  <a href="${d.todayUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px">Open Today</a>
  <p style="font-size:12px;color:#78716c;margin-top:24px">Figures are tracked or logged by you, not every enquiry. Booked doesn't post for you. Turn off this email in Settings.</p>
</div></body></html>`;
  const text = [
    `Your plan for this week, ${d.businessName}`,
    d.shoot ? `Shoot Day: about ${d.shoot.minutes} minutes. ${d.shoot.url}` : "",
    "This week's posts:",
    ...d.posts.map((p) => `- ${p.date} ${PLATFORM[p.platform] ?? p.platform}: ${p.hook}`),
    `Last week: ${d.lastWeek.enquiries} enquiries, ${d.lastWeek.bookings} bookings.`,
    `This month: ${money(d.roi.revenue)} logged revenue vs ${money(d.roi.planPrice)} plan cost.`,
    `Open Today: ${d.todayUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { subject: "Your plan for this week", html, text };
}
