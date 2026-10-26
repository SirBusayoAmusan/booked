import "server-only";
import { runAi } from "./client";
import { businessContext, systemPrompt } from "./prompts";
import { CalendarSchema, PostSchema, type CalendarOut } from "./schemas";
import { ON_CAMERA_RE, cadenceFor, shootBudgetMinutes } from "@/lib/calendar";
import type { Business, Platform, Post } from "@/lib/types";

type Example = { kind: string; before: string; after: string };

export type WeekPlanInput = {
  business: Business;
  userId: string;
  monthStart: string;
  week: { week_start: string; from: string; to: string };
  weekIndex: number;
  platforms: Platform[];
  previousHooks: string[];
  styleExamples: Example[];
  lastReview: { summary?: string | null; recommendations?: unknown } | null;
  getFoundOpen: string[];
};

const CALENDAR_TASK = `Plan one week of social posts for this business, plus one Shoot Day plan that batches all the week's filming into a single session.

Rules for the plan:
- Cadence must fit weekly_hours_available. Write the number of primary-platform posts given in <week>, plus 1 Google Business Profile post if google_business is in allowed_platforms. Reuse one idea across platforms where it fits.
- Across the month mix roughly 35% attract, 30% trust, 25% convert, 10% retain. In quiet season shift toward retain and local-offer content.
- Group every filmed post's shots into the shoot_day: location groups, props, shots, each shot pointing at a post ref. estimated_minutes must not exceed the shoot budget.
- Include at least 1 fallback post that needs no filming (text post, or reusing an existing photo). Give it an empty shot_list.
- If faces_on_camera is false, never plan talking-to-camera or face-on-camera shots; use hands, tools, results and voiceover instead.
- Assign a short promo_code_word (one memorable word, capitals) to convert posts only when offers_enabled is true; otherwise promo_code_word is null.
- Instagram captions can't hold clickable links: point to "link in bio" or a code word, never paste a URL. Facebook and Google posts can say "tap the link".
- Don't depend on setup the owner hasn't finished (see get_found_open): no "find us on Google" if they have no profile, no "book online" if they have no booking link.
- Each post: a strong first-line hook, a caption in the owner's voice, on-screen text lines, a shot list, up to 5 relevant local hashtags (none for google_business), one CTA, the asset needed, and needs_owner_confirmation listing every price, offer, availability or claim the owner must check.
- Every post's publish_date must be between <week> from and to, inclusive. Spread posts across different days.
- Post refs must be unique, like "w1p1", "w1p2".`;

export async function generateCalendarWeek(input: WeekPlanInput) {
  const b = input.business;
  const primaryCount = cadenceFor(b.weekly_hours_available);
  const budget = shootBudgetMinutes(b.weekly_hours_available);
  const includeGbp = input.platforms.includes("google_business");
  const proofThin = !(b.proof_assets ?? []).some((p) => p.permission_confirmed);

  const prompt = `${businessContext(b, input.styleExamples)}
<positioning>
${JSON.stringify(b.positioning_summary, null, 2)}
</positioning>
<week>
${JSON.stringify({
  month_start: input.monthStart,
  week_number: input.weekIndex + 1,
  week_start: input.week.week_start,
  from: input.week.from,
  to: input.week.to,
  primary_posts_this_week: primaryCount,
  google_business_posts_this_week: includeGbp ? 1 : 0,
  shoot_budget_minutes: budget,
  allowed_platforms: input.platforms,
  quiet_season: b.quiet_season,
  proof_is_thin: proofThin,
  include_proof_collection_tasks: proofThin && input.weekIndex === 0,
  get_found_open: input.getFoundOpen,
})}
</week>
<hooks_already_used_this_month>
${input.previousHooks.join("\n") || "(none yet)"}
</hooks_already_used_this_month>
${input.lastReview ? `<last_month_review>\n${JSON.stringify(input.lastReview)}\n</last_month_review>` : ""}
Return the week's strategy, exactly one shoot_days entry for week_start ${input.week.week_start}, and the posts.`;

  return runAi({
    kind: "calendar",
    userId: input.userId,
    businessId: b.id,
    schema: CalendarSchema,
    system: systemPrompt(CALENDAR_TASK, b),
    prompt,
    maxTokens: 16000,
    validate: (out) => validateWeek(out, { ...input.week, platforms: input.platforms, budget, facesOnCamera: b.faces_on_camera, minPosts: Math.min(primaryCount, 2) }),
  });
}

export function validateWeek(
  out: CalendarOut,
  w: { from: string; to: string; platforms: Platform[]; budget: number; facesOnCamera: boolean; minPosts: number },
): string | null {
  if (out.posts.length < w.minPosts) return `Plan at least ${w.minPosts} posts.`;
  const refs = new Set<string>();
  for (const p of out.posts) {
    if (refs.has(p.ref)) return `Duplicate post ref ${p.ref}.`;
    refs.add(p.ref);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.publish_date) || p.publish_date < w.from || p.publish_date > w.to)
      return `Post ${p.ref} date ${p.publish_date} is outside ${w.from} to ${w.to}.`;
    if (!w.platforms.includes(p.platform)) return `Post ${p.ref} uses ${p.platform}, which isn't allowed. Use: ${w.platforms.join(", ")}.`;
    if (!w.facesOnCamera && p.shot_list.some((s) => ON_CAMERA_RE.test(s))) return `Post ${p.ref} needs the owner on camera, but they said no.`;
  }
  if (!out.posts.some((p) => p.shot_list.length === 0)) return "Include at least one fallback post with an empty shot_list (no filming).";
  const sd = out.shoot_days[0];
  if (sd && sd.estimated_minutes > w.budget + 5) return `Shoot day is ${sd.estimated_minutes} minutes; the budget is ${w.budget}.`;
  for (const g of sd?.location_groups ?? []) for (const s of g.shots) if (!refs.has(s.post_ref)) return `Shot "${s.description}" points at unknown post ${s.post_ref}.`;
  return null;
}

// regenerate_post: one post, optionally with an owner instruction.
export async function regeneratePost(opts: {
  business: Business;
  userId: string;
  post: Post;
  instruction: string | null;
  platforms: Platform[];
  styleExamples: Example[];
}) {
  const b = opts.business;
  const p = opts.post;
  return runAi({
    kind: "regenerate",
    userId: opts.userId,
    businessId: b.id,
    schema: PostSchema,
    system: systemPrompt(
      `Rewrite this one post. Keep the same publish_date, platform and ref unless the instruction says otherwise. Follow the owner's instruction if given. Apply all the usual post rules: hook, caption in the owner's voice, one CTA, up to 5 hashtags, needs_owner_confirmation for any price, offer or claim. ${
        b.faces_on_camera ? "" : "The owner is not comfortable on camera: no face-on-camera shots."
      } ${b.offers_enabled ? "" : "promo_code_word must be null."} Instagram captions can't hold clickable links.`,
      b,
    ),
    prompt: `${businessContext(b, opts.styleExamples)}
<pillars>${JSON.stringify(b.positioning_summary?.pillars ?? [])}</pillars>
<allowed_platforms>${opts.platforms.join(", ")}</allowed_platforms>
<current_post>
${JSON.stringify({
  ref: p.ref ?? "p1",
  publish_date: p.publish_date,
  platform: p.platform,
  pillar: p.pillar,
  format: p.format,
  hook: p.hook,
  caption: p.caption,
  on_screen_text: p.on_screen_text,
  shot_list: p.shot_list,
  hashtags: p.hashtags,
  cta_type: p.cta_type,
  promo_code_word: p.promo_code_word,
  asset_needed: p.asset_needed,
})}
</current_post>
<owner_instruction>${opts.instruction?.slice(0, 300) || "Write a genuinely different angle."}</owner_instruction>`,
    validate: (out) => {
      if (!opts.platforms.includes(out.platform)) return `Platform ${out.platform} isn't allowed.`;
      if (!b.faces_on_camera && out.shot_list.some((s) => ON_CAMERA_RE.test(s))) return "No face-on-camera shots.";
      return null;
    },
  });
}
