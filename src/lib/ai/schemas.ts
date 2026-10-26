import { z } from "zod";

// Output schemas for every AI function. These are sent to the API as the
// structured-output format and validated again here (spec: Zod for every AI
// output, retry once on failure). Keep them free of constraints the
// structured-output JSON Schema subset may not support; extra rules are
// checked in code after parsing.

export const ServiceSchema = z.object({
  name: z.string(),
  price_or_range: z.string().nullable(),
  duration: z.string().nullable(),
  notes: z.string().nullable(),
});

export const FactSheetSchema = z.object({
  services: z.array(ServiceSchema),
  service_area: z.string(),
  opening_hours: z.string().nullable(),
  differentiators_stated_by_owner: z.array(z.string()),
  do_not_say: z.array(z.string()),
  unknowns_to_ask_owner: z.array(z.string()),
});

export const PositioningSchema = z.object({
  positioning_statement: z.string(),
  ideal_customer: z.object({
    who: z.string(),
    pain_in_their_words: z.array(z.string()),
    where_they_are: z.array(z.string()),
  }),
  pillars: z.array(
    z.object({
      name: z.string(),
      purpose: z.enum(["attract", "trust", "convert", "retain"]),
      example_angles: z.array(z.string()),
    }),
  ),
  platform_mix: z.object({ primary: z.string(), conversion_channel: z.string(), reasoning: z.string() }),
  missing_proof_tasks: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export const PlatformEnum = z.enum(["instagram", "facebook", "tiktok", "google_business", "whatsapp_status"]);

export const PostSchema = z.object({
  ref: z.string(),
  publish_date: z.string(),
  platform: PlatformEnum,
  pillar: z.string(),
  format: z.enum(["reel", "carousel", "story", "photo", "text"]),
  hook: z.string(),
  caption: z.string(),
  on_screen_text: z.array(z.string()),
  shot_list: z.array(z.string()),
  hashtags: z.array(z.string()),
  cta_type: z.enum(["book", "dm", "call", "whatsapp", "save", "none"]),
  promo_code_word: z.string().nullable(),
  asset_needed: z.string(),
  needs_owner_confirmation: z.array(z.string()),
});

export const ShootDaySchema = z.object({
  week_start: z.string(),
  estimated_minutes: z.number(),
  location_groups: z.array(
    z.object({
      location: z.string(),
      props: z.array(z.string()),
      shots: z.array(z.object({ description: z.string(), post_ref: z.string() })),
    }),
  ),
});

export const CalendarSchema = z.object({
  strategy: z.object({
    pillars: z.array(z.string()),
    cadence: z.string(),
    monthly_offer: z.string().nullable(),
  }),
  shoot_days: z.array(ShootDaySchema),
  posts: z.array(PostSchema),
});

export const ReplySchema = z.object({
  options: z.array(
    z.object({
      label: z.enum(["short", "friendly"]),
      text: z.string(),
      placeholders_to_fill: z.array(z.string()),
    }),
  ),
});

export const ReviewRequestSchema = z.object({
  options: z.array(z.object({ channel: z.enum(["whatsapp", "sms", "email"]), text: z.string() })),
});

export const WeeklyReviewSchema = z.object({
  summary: z.string(),
  top_posts: z.array(z.object({ post_id: z.string(), why_it_likely_worked: z.string() })),
  recommendations: z.array(z.object({ action: z.string(), reason: z.string(), post_ids: z.array(z.string()) })),
  next_week_focus: z.string(),
});

export const SetupGuidanceSchema = z.object({
  checklist_items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      why_it_matters: z.string(),
      time_estimate_minutes: z.number(),
      depends_on: z.string().nullable(),
    }),
  ),
});

export const FabricatedProofSchema = z.object({
  findings: z.array(z.object({ quote: z.string(), reason: z.string() })),
});

export type FactSheetOut = z.infer<typeof FactSheetSchema>;
export type PositioningOut = z.infer<typeof PositioningSchema>;
export type CalendarOut = z.infer<typeof CalendarSchema>;
export type PostOut = z.infer<typeof PostSchema>;
