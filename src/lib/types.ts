import type { Country, Locale } from "./config/locale";
import type { Currency, PlanId } from "./config/plans";
import type { Presence } from "./config/checklist";

export type SubscriptionStatus = "none" | "trialing" | "active" | "past_due" | "paused" | "canceled";

export type Profile = {
  id: string;
  user_id: string;
  email: string | null;
  plan_id: PlanId;
  billing_provider: string;
  billing_customer_ref: string | null;
  billing_membership_ref: string | null;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string | null;
  past_due_since: string | null;
  current_period_end: string | null;
  referred_by: string | null;
  billing_currency: string | null;
  is_admin: boolean;
  notification_prefs: NotificationPrefs;
  created_at: string;
};

export type NotificationPrefs = {
  digest_email: boolean;
  overdue_hours: number;
  post_day_push: boolean;
  post_day_hour: number;
  push_enabled: boolean;
};

export type Service = { name: string; price_or_range: string | null; duration: string | null; notes: string | null };

export type ProofAsset = { type: string; description: string; url: string | null; permission_confirmed: boolean };

export type FactSheet = {
  services: Service[];
  service_area: string;
  opening_hours: string | null;
  differentiators_stated_by_owner: string[];
  do_not_say: string[];
  unknowns_to_ask_owner: string[];
};

export type Pillar = { name: string; purpose: "attract" | "trust" | "convert" | "retain"; example_angles: string[] };

export type Positioning = {
  positioning_statement: string;
  ideal_customer: { who: string; pain_in_their_words: string[]; where_they_are: string[] };
  pillars: Pillar[];
  platform_mix: { primary: string; conversion_channel: string; reasoning: string };
  missing_proof_tasks: string[];
  assumptions: string[];
};

export type Business = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  trade: string | null;
  city: string | null;
  service_area: string | null;
  neighbourhoods: string[];
  languages: string[];
  services: Service[];
  opening_hours: string | null;
  ideal_customer_notes: string | null;
  voice_notes: string | null;
  voice_samples: string[];
  banned_words: string[];
  faces_on_camera: boolean;
  weekly_hours_available: number;
  platforms: string[];
  booking_method: "whatsapp" | "call" | "form" | "dm" | "text";
  whatsapp_number: string | null;
  phone: string | null;
  google_review_url: string | null;
  google_business_url: string | null;
  regulated_notes: string | null;
  proof_assets: ProofAsset[];
  fact_sheet: FactSheet | null;
  fact_sheet_confirmed_at: string | null;
  positioning_summary: Positioning | null;
  positioning_confirmed_at: string | null;
  quiet_season: boolean;
  offers_enabled: boolean;
  country: Country;
  timezone: string;
  locale: Locale;
  currency: Currency;
  review_platforms: { platform: string; url: string }[];
  licence_or_registration_ref: string | null;
  booking_tool: "square" | "jobber" | "booksy" | "fresha" | "calendly" | "other" | "none";
  external_booking_url: string | null;
  presence: Presence;
  setup_checklist_state: Record<string, "done" | "todo" | "hidden">;
  onboarding_answers: Record<string, unknown>;
  onboarding_step: number;
  onboarding_completed_at: string | null;
  public_page_published: boolean;
  public_page_noindex: boolean;
  public_photos: { url: string; caption: string | null }[];
  created_at: string;
};

export type Platform = "instagram" | "facebook" | "tiktok" | "google_business" | "whatsapp_status";

export type SafetySeverity = "high" | "medium";
export type SafetyFinding = {
  rule_id: string;
  severity: SafetySeverity;
  message: string;
  match?: string;
  field?: string;
};
export type SafetyStatus = "pass" | "pass_with_changes" | "blocked";

export type Post = {
  id: string;
  calendar_id: string;
  business_id: string;
  shoot_day_id: string | null;
  ref: string | null;
  publish_date: string;
  platform: Platform;
  pillar: string | null;
  format: string | null;
  hook: string | null;
  caption: string;
  on_screen_text: string[];
  shot_list: string[];
  hashtags: string[];
  cta_type: string | null;
  promo_code_word: string | null;
  asset_needed: string | null;
  needs_owner_confirmation: string[];
  confirmed_items: string[];
  safety_status: SafetyStatus;
  safety_findings: SafetyFinding[];
  status: "draft" | "ready" | "posted" | "skipped";
  posted_at: string | null;
  tracking_code: string;
  original_caption: string | null;
  edited_caption: string | null;
  no_filming: boolean;
};

export type Calendar = {
  id: string;
  business_id: string;
  month_start: string;
  status: "draft" | "active" | "archived";
  strategy: { pillars?: string[]; cadence?: string; monthly_offer?: string | null };
  generation_state: { weeks_total?: number; weeks_done?: number; error?: string | null };
  created_at: string;
};

export type Shot = { description: string; post_ref: string; post_id?: string | null };
export type ShootPlan = { location_groups: { location: string; props: string[]; shots: Shot[] }[] };

export type ShootDay = {
  id: string;
  calendar_id: string;
  business_id: string;
  week_start: string;
  estimated_minutes: number;
  plan: ShootPlan;
  done_shots: string[];
  status: "planned" | "done" | "skipped";
};

export type EnquiryStatus = "new" | "contacted" | "booked" | "completed" | "lost";
export type EnquirySource = "tracked_link" | "public_page" | "code_word" | "manual";

export type Enquiry = {
  id: string;
  business_id: string;
  post_id: string | null;
  source: EnquirySource;
  source_note: string | null;
  name: string | null;
  contact: string | null;
  service_requested: string | null;
  message: string | null;
  status: EnquiryStatus;
  value_usd: number | null;
  first_contacted_at: string | null;
  booked_at: string | null;
  completed_at: string | null;
  notes: string | null;
  consent_to_contact: boolean;
  created_at: string;
};

export type SavedReply = { id: string; business_id: string; title: string; service: string | null; body: string; uses: number };

export type ReviewRequest = {
  id: string;
  business_id: string;
  enquiry_id: string | null;
  customer_first_name: string | null;
  channel: "sms" | "whatsapp" | "email" | "in_person_qr";
  message_used: string | null;
  status: "drafted" | "sent_by_owner" | "reviewed_self_reported" | "ignored";
  sent_at: string | null;
  created_at: string;
};

export type WeeklyReview = {
  id: string;
  business_id: string;
  week_start: string;
  metrics: Record<string, unknown>;
  roi: { logged_revenue?: number; plan_price?: number; currency?: string; bookings?: number };
  top_posts: { post_id: string; why_it_likely_worked: string }[];
  recommendations: { action: string; reason: string; post_ids: string[] }[];
  summary: string | null;
  next_week_focus: string | null;
  email_sent_at: string | null;
};
