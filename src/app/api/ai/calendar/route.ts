import { z } from "zod";
import { aiErrorResponse, error, json, parseBody, routeAuth } from "@/lib/api";
import { generateCalendarWeek } from "@/lib/ai/calendar-fns";
import { assertCanRun, hasFeature } from "@/lib/limits";
import { getAccess } from "@/lib/billing/access";
import { allowedPlatforms, weeksForMonth } from "@/lib/calendar";
import { dedupeCodeWords, postRow } from "@/lib/posts";
import { getSafetyConfig } from "@/lib/safety/config";
import { nextChecklistItems } from "@/lib/config/checklist";
import { monthStart, nextMonthStart, todayIn } from "@/lib/utils";
import type { Calendar } from "@/lib/types";

// Week-by-week generation keeps each request well inside serverless limits.
// The client calls this repeatedly until `done` is true, showing progress.
export const maxDuration = 60;

const Body = z.object({
  businessId: z.string().uuid(),
  calendarId: z.string().uuid().optional(),
  month: z.enum(["current", "next"]).optional(),
  regenerateWeek: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

type Week = { week_start: string; from: string; to: string };
type GenState = { weeks: Week[]; weeks_done: number; error?: string | null };

export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return error("Invalid input.");
  const auth = await routeAuth(body.businessId);
  if (!auth.ok) return auth.res;
  const { supabase, business: b, profile, user } = auth;
  if (!b.positioning_confirmed_at) return error("Confirm your fact sheet and positioning first.", 409);

  try {
    let calendar: Calendar;
    let state: GenState;

    if (!body.calendarId) {
      await assertCanRun(supabase, profile, "calendar", b.id);
      const today = todayIn(b.timezone);
      const ms = body.month === "next" ? nextMonthStart(today) : monthStart(today);
      const weeks = weeksForMonth(ms, today);
      if (weeks.length === 0) return error("Nothing left to plan this month. Plan next month instead.", 409);
      state = { weeks, weeks_done: 0 };
      const { data, error: err } = await supabase
        .from("calendars")
        .insert({ business_id: b.id, month_start: ms, status: "draft", generation_state: state })
        .select("*")
        .single();
      if (err || !data) return error("Couldn't start your calendar.", 500);
      calendar = data as Calendar;
    } else {
      const { data } = await supabase.from("calendars").select("*").eq("id", body.calendarId).eq("business_id", b.id).maybeSingle();
      if (!data) return error("Calendar not found.", 404);
      calendar = data as Calendar;
      state = calendar.generation_state as unknown as GenState;
    }

    // Which week to (re)generate.
    let week: Week | undefined;
    let weekIndex: number;
    if (body.regenerateWeek) {
      await assertCanRun(supabase, profile, "regenerate", b.id);
      weekIndex = state.weeks.findIndex((w) => w.week_start === body.regenerateWeek);
      week = state.weeks[weekIndex];
      if (!week) return error("That week isn't in this calendar.", 404);
      const today = todayIn(b.timezone);
      week = { ...week, from: [week.from, today].sort().at(-1)! };
      if (week.from > week.to) return error("That week is already over.", 409);
      // Replace only posts that haven't been posted yet.
      await supabase.from("posts").delete().eq("calendar_id", calendar.id).gte("publish_date", week.from).lte("publish_date", week.to).in("status", ["draft", "ready", "skipped"]);
      await supabase.from("shoot_days").delete().eq("calendar_id", calendar.id).eq("week_start", week.week_start);
    } else {
      if (!getAccess(profile).canGenerate) return error("Generation is paused on your account.", 403);
      weekIndex = state.weeks_done;
      week = state.weeks[weekIndex];
      if (!week) return json({ calendarId: calendar.id, weeksDone: state.weeks_done, weeksTotal: state.weeks.length, done: true });
    }

    const [{ data: prior }, { data: examples }, { data: lastReview }, config] = await Promise.all([
      supabase.from("posts").select("hook").eq("calendar_id", calendar.id),
      hasFeature(profile, "voice_learning")
        ? supabase.from("style_examples").select("kind, before, after").eq("business_id", b.id).eq("kind", "caption").order("created_at", { ascending: false }).limit(5)
        : Promise.resolve({ data: [] }),
      supabase.from("weekly_reviews").select("summary, recommendations").eq("business_id", b.id).order("week_start", { ascending: false }).limit(1).maybeSingle(),
      getSafetyConfig(),
    ]);

    const platforms = allowedPlatforms(b, hasFeature(profile, "gbp_pack"));
    const getFoundOpen = nextChecklistItems(b.setup_checklist_state?.status ?? {}, { trade: b.trade, limit: 10 }).map((i) => i.id);

    const out = await generateCalendarWeek({
      business: b,
      userId: user.id,
      monthStart: calendar.month_start,
      week,
      weekIndex,
      platforms,
      previousHooks: (prior ?? []).map((p) => p.hook).filter(Boolean) as string[],
      styleExamples: (examples ?? []) as { kind: string; before: string; after: string }[],
      lastReview: lastReview ?? null,
      getFoundOpen,
    });

    const sd = out.shoot_days[0];
    const filmed = out.posts.filter((p) => p.shot_list.length > 0);
    let shootDayId: string | null = null;
    if (sd && filmed.length > 0) {
      const { data: shootDay } = await supabase
        .from("shoot_days")
        .insert({
          calendar_id: calendar.id,
          business_id: b.id,
          week_start: week.week_start,
          estimated_minutes: Math.round(sd.estimated_minutes),
          plan: { location_groups: sd.location_groups },
        })
        .select("id")
        .single();
      shootDayId = shootDay?.id ?? null;
    }

    const rows = out.posts.map((p) => postRow(p, b, config, { calendar_id: calendar.id, shoot_day_id: shootDayId }));
    await dedupeCodeWords(supabase, b.id, rows);
    const { data: inserted, error: insErr } = await supabase.from("posts").insert(rows).select("id, ref");
    if (insErr) throw new Error("Couldn't save posts: " + insErr.message);

    // Point each shot at the post it feeds.
    if (shootDayId && sd) {
      const idByRef = new Map((inserted ?? []).map((r) => [r.ref, r.id]));
      const plan = {
        location_groups: sd.location_groups.map((g) => ({ ...g, shots: g.shots.map((s) => ({ ...s, post_id: idByRef.get(s.post_ref) ?? null })) })),
      };
      await supabase.from("shoot_days").update({ plan }).eq("id", shootDayId);
    }

    if (!body.regenerateWeek) state = { ...state, weeks_done: state.weeks_done + 1, error: null };
    const done = state.weeks_done >= state.weeks.length;
    const patch: Record<string, unknown> = { generation_state: state };
    if (weekIndex === 0 && !body.regenerateWeek) patch.strategy = out.strategy;
    if (done && calendar.status === "draft") {
      patch.status = "active";
      await supabase.from("calendars").update({ status: "archived" }).eq("business_id", b.id).eq("month_start", calendar.month_start).eq("status", "active");
    }
    await supabase.from("calendars").update(patch).eq("id", calendar.id);

    return json({ calendarId: calendar.id, weeksDone: state.weeks_done, weeksTotal: state.weeks.length, done });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
