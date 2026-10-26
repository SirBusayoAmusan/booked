import { COUNTRY_DEFAULTS, type Country } from "@/lib/config/locale";
import type { Presence } from "@/lib/config/checklist";
import type { Service } from "@/lib/types";

export type OnboardingAnswers = {
  name?: string;
  trade?: string;
  country?: Country;
  timezone?: string;
  about?: string;
  happy_customers_say?: string;
  city?: string;
  service_area?: string;
  neighbourhoods?: string;
  languages?: string;
  services?: Service[];
  best_customer?: string;
  booking_tool?: "square" | "jobber" | "booksy" | "fresha" | "calendly" | "other" | "none";
  external_booking_url?: string;
  presence?: Presence;
  booking_method?: "whatsapp" | "call" | "form" | "dm" | "text";
  phone?: string;
  whatsapp_number?: string;
  platforms?: string[];
  tried_posting?: string;
  weekly_hours?: number;
  faces_on_camera?: boolean;
  voice_samples?: string[];
  voice_notes?: string;
  proof?: string;
  proof_permission?: boolean;
  regulated_notes?: string;
  banned_words?: string;
  licence_ref?: string;
  google_review_url?: string;
};

export const ONBOARDING_STEPS = [
  { id: "basics", title: "Let's start with the basics" },
  { id: "about", title: "What does your business do, and what do happy customers say about you?" },
  { id: "area", title: "Where do you work, which neighbourhoods do you serve, and what languages do your customers speak?" },
  { id: "services", title: "List your main services with a price or range and how long each takes." },
  { id: "best_customer", title: "Tell me about your best customer: who were they and how did they find you?" },
  { id: "booking_tool", title: "Where do customers book or pay you today?" },
  { id: "presence", title: "Which of these do you already have?" },
  { id: "contact", title: "How do people contact or book you today?" },
  { id: "platforms", title: "Which platforms are you on, and what have you tried posting?" },
  { id: "time", title: "How many hours a week can you really give this, and are you comfortable on camera?" },
  { id: "voice", title: "Paste 3 captions or messages you have written, or tell me how you like to sound." },
  { id: "proof", title: "What real proof can you share (photos, reviews, results) and do you have permission to share it?" },
  { id: "regulated", title: "Anything regulated or off-limits in your trade?" },
  { id: "review_link", title: "What is your Google review link, if you have one?" },
] as const;

const splitList = (s?: string) =>
  (s ?? "")
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 50);

const clean = (s?: string | null, max = 4000) => (s ?? "").trim().slice(0, max) || null;

const isUrl = (s?: string) => {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

// Maps raw onboarding answers onto business columns. Only known, cleaned
// fields are written; everything else stays in onboarding_answers.
export function answersToBusinessPatch(a: OnboardingAnswers) {
  const patch: Record<string, unknown> = {};
  if (a.name !== undefined) patch.name = clean(a.name, 120) ?? "";
  if (a.trade !== undefined) patch.trade = clean(a.trade, 120);
  if (a.country && a.country in COUNTRY_DEFAULTS) {
    const d = COUNTRY_DEFAULTS[a.country];
    patch.country = a.country;
    patch.locale = d.locale;
    patch.currency = d.currency;
  }
  if (a.timezone) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: a.timezone });
      patch.timezone = a.timezone;
    } catch {
      /* ignore invalid tz */
    }
  }
  if (a.city !== undefined) patch.city = clean(a.city, 120);
  if (a.service_area !== undefined) patch.service_area = clean(a.service_area, 500);
  if (a.neighbourhoods !== undefined) patch.neighbourhoods = splitList(a.neighbourhoods);
  if (a.languages !== undefined) patch.languages = splitList(a.languages);
  if (a.services !== undefined)
    patch.services = a.services
      .filter((s) => s && s.name?.trim())
      .slice(0, 30)
      .map((s) => ({
        name: s.name.trim().slice(0, 120),
        price_or_range: clean(s.price_or_range, 60),
        duration: clean(s.duration, 60),
        notes: clean(s.notes, 300),
      }));
  if (a.best_customer !== undefined || a.about !== undefined)
    patch.ideal_customer_notes = clean([a.best_customer].filter(Boolean).join("\n"), 2000);
  if (a.booking_tool) patch.booking_tool = a.booking_tool;
  if (a.external_booking_url !== undefined) patch.external_booking_url = isUrl(a.external_booking_url) ? a.external_booking_url!.trim() : null;
  if (a.booking_method) patch.booking_method = a.booking_method;
  if (a.phone !== undefined) patch.phone = clean(a.phone, 40);
  if (a.whatsapp_number !== undefined) patch.whatsapp_number = clean(a.whatsapp_number, 40);
  if (a.platforms !== undefined)
    patch.platforms = a.platforms.filter((p) => ["instagram", "facebook", "tiktok", "google_business", "whatsapp_status"].includes(p));
  if (a.weekly_hours !== undefined) patch.weekly_hours_available = Math.min(10, Math.max(0.5, Number(a.weekly_hours) || 1));
  if (a.faces_on_camera !== undefined) patch.faces_on_camera = Boolean(a.faces_on_camera);
  if (a.voice_samples !== undefined) patch.voice_samples = a.voice_samples.map((s) => s.trim().slice(0, 2000)).filter(Boolean).slice(0, 5);
  if (a.voice_notes !== undefined) patch.voice_notes = clean(a.voice_notes, 2000);
  if (a.proof !== undefined || a.proof_permission !== undefined)
    patch.proof_assets = clean(a.proof)
      ? [{ type: "owner_described", description: clean(a.proof, 2000), url: null, permission_confirmed: Boolean(a.proof_permission) }]
      : [];
  if (a.regulated_notes !== undefined) patch.regulated_notes = clean(a.regulated_notes, 2000);
  if (a.banned_words !== undefined) patch.banned_words = splitList(a.banned_words);
  if (a.licence_ref !== undefined) patch.licence_or_registration_ref = clean(a.licence_ref, 200);
  if (a.google_review_url !== undefined) {
    patch.google_review_url = isUrl(a.google_review_url) ? a.google_review_url!.trim() : null;
    patch.review_platforms = patch.google_review_url ? [{ platform: "google", url: patch.google_review_url }] : [];
  }
  if (a.presence !== undefined || a.booking_tool !== undefined || a.google_review_url !== undefined) {
    const p: Presence = { ...(a.presence ?? {}) };
    if (a.booking_tool !== undefined) p.booking_tool = a.booking_tool !== "none";
    if (a.google_review_url !== undefined) p.review_link = isUrl(a.google_review_url);
    patch.presence = p;
  }
  return patch;
}
