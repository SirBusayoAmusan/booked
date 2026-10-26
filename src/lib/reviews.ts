import type { Business } from "@/lib/types";

// The review link to use: Google by default, otherwise the first platform the
// owner added (for example Facebook recommendations). No in-house feedback
// form, so happy and unhappy customers get the same public link.
export function reviewLinkFor(b: Pick<Business, "google_review_url" | "review_platforms">): { platform: string; url: string } | null {
  if (b.google_review_url) return { platform: "google", url: b.google_review_url };
  const p = (b.review_platforms ?? []).find((r) => r.url);
  return p ? { platform: p.platform, url: p.url } : null;
}

// Plain templates that work without AI. Honest review, no rating hints, no
// rewards, sent by the owner to every real customer.
export function reviewTemplates(firstName: string, businessName: string, link: string) {
  const name = firstName.trim() || "there";
  return [
    { channel: "sms" as const, text: `Hi ${name}, thanks for choosing ${businessName}! If you have a minute, an honest review would really help: ${link}` },
    { channel: "whatsapp" as const, text: `Hi ${name}, thanks again for today. Would you mind leaving an honest review of how it went? ${link}` },
    { channel: "email" as const, text: `Hi ${name}, thank you for choosing ${businessName}. If you have a moment, I'd be grateful for an honest review here: ${link}` },
  ];
}
