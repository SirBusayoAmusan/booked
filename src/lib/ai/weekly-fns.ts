import "server-only";
import { runAi } from "./client";
import { systemPrompt } from "./prompts";
import { WeeklyReviewSchema } from "./schemas";
import type { WeekMetrics } from "@/lib/weekly";
import type { Business } from "@/lib/types";

const nums = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

// weekly_review: grounded only in the numbers given.
export async function weeklyReview(opts: { business: Business; userId: string; week: WeekMetrics; previous: WeekMetrics[] }) {
  const totalEnquiries = [opts.week, ...opts.previous].reduce((s, w) => s + w.enquiries_total, 0);
  const allowedNumbers = new Set(nums(JSON.stringify([opts.week, opts.previous])).concat([1, 2, 3, 4, 5, 7]));
  const postIds = new Set([opts.week, ...opts.previous].flatMap((w) => w.posts.map((p) => p.post_id)));
  return runAi({
    kind: "weekly_review",
    userId: opts.userId,
    businessId: opts.business.id,
    schema: WeeklyReviewSchema,
    cache: true,
    effort: "low",
    system: systemPrompt(
      `Write the owner's weekly review. State only numbers present in the input; never estimate or add up new totals. Call figures "tracked" or "logged", never "total". ${
        totalEnquiries < 5
          ? "There are fewer than 5 enquiries in total across these weeks, so say there isn't enough data yet to judge which posts work, and give directional suggestions only."
          : ""
      } Give at most 3 recommendations, each tied to a specific post, pillar or habit (posting consistency, replying fast, logging DMs, asking for reviews). top_posts must use post_id values from the input. Keep it short and encouraging, owner to owner.`,
      opts.business,
    ),
    prompt: `<this_week>\n${JSON.stringify(opts.week)}\n</this_week>\n<previous_weeks>\n${JSON.stringify(opts.previous)}\n</previous_weeks>`,
    validate: (out) => {
      if (out.recommendations.length > 3) return "At most 3 recommendations.";
      for (const t of out.top_posts) if (!postIds.has(t.post_id)) return `Unknown post_id ${t.post_id}.`;
      for (const r of out.recommendations) for (const id of r.post_ids) if (!postIds.has(id)) return `Unknown post_id ${id}.`;
      const bad = nums(out.summary + " " + out.next_week_focus).filter((n) => !allowedNumbers.has(n));
      if (bad.length) return `These numbers aren't in the input: ${bad.join(", ")}.`;
      return null;
    },
  });
}
