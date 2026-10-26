import type { Metadata } from "next";
import Link from "next/link";
import { Camera } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { getAccess } from "@/lib/billing/access";
import { formatDate } from "@/lib/config/locale";
import { addDays, cn, nextMonthStart, todayIn, weekStart } from "@/lib/utils";
import type { Calendar, Post, ShootDay } from "@/lib/types";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PLATFORM_LABEL, PlatformBadge, SafetyBadge, StatusBadge } from "@/components/post-badges";
import { GenerateCalendar } from "./generate";
import { QuietSeasonToggle, RegenerateWeekButton } from "./week-actions";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage(props: PageProps<"/business/[id]/calendar">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const { supabase, business, profile } = await requireBusiness(id);
  const access = getAccess(profile);
  const view = sp.view === "month" ? "month" : "list";
  const platform = typeof sp.platform === "string" ? sp.platform : null;

  const { data: calendars } = await supabase
    .from("calendars")
    .select("*")
    .eq("business_id", id)
    .neq("status", "archived")
    .order("month_start", { ascending: false });
  const cals = (calendars ?? []) as Calendar[];
  const calendar = cals.find((c) => c.id === sp.cal) ?? cals.find((c) => c.status === "active") ?? cals[0] ?? null;
  const draft = cals.find((c) => c.status === "draft");
  const draftIncomplete = draft && ((draft.generation_state as { weeks_done?: number; weeks?: unknown[] }).weeks_done ?? 0) < ((draft.generation_state as { weeks?: unknown[] }).weeks?.length ?? 0);

  if (!business.positioning_confirmed_at) {
    return (
      <Card>
        <CardTitle>Confirm your fact sheet first</CardTitle>
        <CardDescription>Your calendar is built only from facts you&apos;ve confirmed.</CardDescription>
        <Link href={`/business/${id}/positioning`} className="mt-3 inline-block font-semibold text-primary underline">
          Review fact sheet
        </Link>
      </Card>
    );
  }

  if (!calendar || sp.generate === "1") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">Calendar</h1>
        <GenerateCalendar businessId={id} canGenerate={access.canGenerate} resumeCalendarId={draftIncomplete ? draft!.id : null} />
      </div>
    );
  }

  let q = supabase.from("posts").select("*").eq("calendar_id", calendar.id).order("publish_date").order("created_at");
  if (platform) q = q.eq("platform", platform);
  const [{ data: postsData }, { data: shootData }] = await Promise.all([
    q,
    supabase.from("shoot_days").select("*").eq("calendar_id", calendar.id).order("week_start"),
  ]);
  const posts = (postsData ?? []) as Post[];
  const shootDays = (shootData ?? []) as ShootDay[];
  const today = todayIn(business.timezone);
  const monthLabel = formatDate(calendar.month_start, business.locale, { month: "long", year: "numeric" });
  const weeks = ((calendar.generation_state as { weeks?: { week_start: string; from: string; to: string }[] }).weeks ?? []).map((w) => ({
    ...w,
    posts: posts.filter((p) => p.publish_date >= w.from && p.publish_date <= w.to),
    shoot: shootDays.find((s) => s.week_start === w.week_start),
  }));
  const link = (params: Record<string, string | null>) => {
    const u = new URLSearchParams({ cal: calendar.id, view, ...(platform ? { platform } : {}) });
    for (const [k, v] of Object.entries(params)) {
      if (v === null) u.delete(k);
      else u.set(k, v);
    }
    return `/business/${id}/calendar?${u}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{monthLabel}</h1>
        <div className="flex rounded-xl border border-border p-1 text-sm">
          {(["list", "month"] as const).map((v) => (
            <Link key={v} href={link({ view: v })} className={cn("rounded-lg px-3 py-2", view === v && "bg-secondary font-semibold")} aria-current={view === v ? "page" : undefined}>
              {v === "list" ? "List" : "Month"}
            </Link>
          ))}
        </div>
      </div>

      {cals.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {cals.map((c) => (
            <Link key={c.id} href={`/business/${id}/calendar?cal=${c.id}`} className={cn("rounded-full border border-border px-3 py-2 text-sm whitespace-nowrap", c.id === calendar.id && "bg-secondary font-semibold")}>
              {formatDate(c.month_start, business.locale, { month: "short", year: "numeric" })}
              {c.status === "draft" ? " (building)" : ""}
            </Link>
          ))}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter by platform">
        <Link href={link({ platform: null })} className={cn("rounded-full border border-border px-3 py-2 text-sm whitespace-nowrap", !platform && "bg-secondary font-semibold")}>
          All
        </Link>
        {Array.from(new Set(posts.map((p) => p.platform).concat(platform ? [platform as Post["platform"]] : []))).map((p) => (
          <Link key={p} href={link({ platform: p })} className={cn("rounded-full border border-border px-3 py-2 text-sm whitespace-nowrap", platform === p && "bg-secondary font-semibold")}>
            {PLATFORM_LABEL[p] ?? p}
          </Link>
        ))}
      </div>

      {draftIncomplete && <GenerateCalendar businessId={id} canGenerate={access.canGenerate} resumeCalendarId={draft!.id} />}

      {view === "month" ? (
        <MonthGrid monthStart={calendar.month_start} posts={posts} businessId={id} today={today} />
      ) : (
        weeks.map((w) => (
          <section key={w.week_start} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Week of {formatDate(w.week_start, business.locale, { day: "numeric", month: "short" })}</h2>
              {w.to >= today && <RegenerateWeekButton businessId={id} calendarId={calendar.id} weekStart={w.week_start} disabled={!access.canGenerate} />}
            </div>
            {w.shoot && (
              <Link href={`/business/${id}/shoot/${w.week_start}`} className="flex items-center gap-3 rounded-2xl border border-border bg-secondary px-4 py-3">
                <Camera className="h-5 w-5 text-primary" aria-hidden />
                <span className="flex-1">
                  <span className="block font-medium">Shoot Day</span>
                  <span className="block text-sm text-muted-foreground">About {w.shoot.estimated_minutes} minutes covers this week</span>
                </span>
                <span className="text-sm text-muted-foreground">{w.shoot.status === "done" ? "Done" : "Open"}</span>
              </Link>
            )}
            {w.posts.length === 0 && <p className="text-sm text-muted-foreground">No posts{platform ? " on this platform" : ""} this week.</p>}
            <ul className="flex flex-col gap-2">
              {w.posts.map((p) => (
                <li key={p.id}>
                  <Link href={`/business/${id}/posts/${p.id}`} className="block rounded-2xl border border-border bg-card p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className={cn(p.publish_date === today && "font-semibold text-primary")}>
                        {p.publish_date === today ? "Today" : formatDate(p.publish_date, business.locale)}
                      </span>
                      <PlatformBadge platform={p.platform} />
                      <StatusBadge status={p.status} />
                      {p.safety_status !== "pass" && <SafetyBadge status={p.safety_status} />}
                      {p.no_filming && <span>No filming</span>}
                    </div>
                    <p className="mt-1 font-medium">{p.hook}</p>
                    {p.pillar && <p className="text-xs text-muted-foreground">{p.pillar}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <Card className="flex flex-col gap-2">
        <QuietSeasonToggle businessId={id} initial={business.quiet_season} />
      </Card>
      {calendar.status === "active" && calendar.month_start < nextMonthStart(today) && (
        <GenerateCalendar businessId={id} canGenerate={access.canGenerate} defaultMonth="next" compact />
      )}
      <p className="text-center text-xs text-muted-foreground">
        Booked doesn&apos;t post for you. Copy each post and share it yourself, or paste it into your scheduler.
      </p>
    </div>
  );
}

function MonthGrid({ monthStart: ms, posts, businessId, today }: { monthStart: string; posts: Post[]; businessId: string; today: string }) {
  const end = nextMonthStart(ms);
  const days: string[] = [];
  for (let d = weekStart(new Date(ms + "T00:00:00Z")); d < end || new Date(d + "T00:00:00Z").getUTCDay() !== 1; d = addDays(d, 1)) days.push(d);
  const byDay = new Map<string, Post[]>();
  for (const p of posts) byDay.set(p.publish_date, [...(byDay.get(p.publish_date) ?? []), p]);
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((d) => {
          const inMonth = d >= ms && d < end;
          const dayPosts = byDay.get(d) ?? [];
          return (
            <div key={d} className={cn("min-h-16 rounded-lg border border-border p-1 text-xs", !inMonth && "opacity-40", d === today && "border-primary")}>
              <span className={cn("font-medium", d === today && "text-primary")}>{Number(d.slice(8))}</span>
              <div className="mt-1 flex flex-col gap-1">
                {dayPosts.map((p) => (
                  <Link
                    key={p.id}
                    href={`/business/${businessId}/posts/${p.id}`}
                    className={cn("block truncate rounded px-1 py-0.5", p.status === "posted" ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" : "bg-secondary")}
                    title={p.hook ?? ""}
                  >
                    {(PLATFORM_LABEL[p.platform] ?? p.platform).slice(0, 2)}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
