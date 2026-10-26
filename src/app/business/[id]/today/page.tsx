import type { Metadata } from "next";
import Link from "next/link";
import { Camera, Clock, Inbox, Star } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { getAccess } from "@/lib/billing/access";
import { CHECKLIST_DISCLAIMER, getFoundItemsForToday } from "@/lib/config/checklist";
import { formatDate } from "@/lib/config/locale";
import { isOverdue } from "@/lib/enquiries";
import { computeRoi } from "@/lib/roi";
import { addDays, nextMonthStart, nowMs, todayIn, weekStart } from "@/lib/utils";
import { localClock } from "@/lib/cron";
import type { Enquiry, Post, ShootDay } from "@/lib/types";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { GetFoundCard } from "@/components/get-found-card";
import { PlatformBadge, SafetyBadge, StatusBadge } from "@/components/post-badges";
import { RoiCard } from "@/components/roi-card";
import { PushPrompt } from "@/components/push-prompt";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage(props: PageProps<"/business/[id]/today">) {
  const { id } = await props.params;
  const { supabase, business, profile } = await requireBusiness(id);
  const access = getAccess(profile);
  const today = todayIn(business.timezone);
  const ws = weekStart(new Date(today + "T00:00:00Z"));
  const monthStart = today.slice(0, 8) + "01";
  const overdueHours = profile.notification_prefs?.overdue_hours ?? 2;
  const now = nowMs();

  const [{ data: postsData }, { data: shootData }, { data: newEnq }, { data: completed }, { data: reqs }, { count: calCount }, { count: weekEnquiries }, roi] = await Promise.all([
    supabase.from("posts").select("*, calendars!inner(status)").eq("business_id", id).neq("calendars.status", "archived").gte("publish_date", ws).lte("publish_date", addDays(ws, 6)).order("publish_date"),
    supabase.from("shoot_days").select("*, calendars!inner(status)").eq("business_id", id).neq("calendars.status", "archived").gte("week_start", ws).order("week_start").limit(2),
    supabase.from("enquiries").select("*").eq("business_id", id).eq("status", "new").order("created_at", { ascending: false }).limit(20),
    supabase.from("enquiries").select("id, name, service_requested, completed_at").eq("business_id", id).eq("status", "completed").gte("completed_at", new Date(now - 3 * 86_400_000).toISOString()),
    supabase.from("review_requests").select("enquiry_id").eq("business_id", id).not("enquiry_id", "is", null),
    supabase.from("calendars").select("id", { count: "exact", head: true }).eq("business_id", id).eq("status", "active").gte("month_start", monthStart),
    supabase.from("enquiries").select("id", { count: "exact", head: true }).eq("business_id", id).gte("created_at", ws + "T00:00:00Z"),
    computeRoi(supabase, business, profile, monthStart + "T00:00:00Z", nextMonthStart(today) + "T00:00:00Z"),
  ]);

  const weekPosts = (postsData ?? []) as Post[];
  const todayPosts = weekPosts.filter((p) => p.publish_date === today && p.status !== "skipped");
  const postedThisWeek = weekPosts.filter((p) => p.status === "posted").length;
  const shoot = ((shootData ?? []) as ShootDay[]).find((s) => s.week_start === ws) ?? null;
  const nextShoot = ((shootData ?? []) as ShootDay[]).find((s) => s.status === "planned") ?? null;
  const enquiries = (newEnq ?? []) as Enquiry[];
  const overdue = enquiries.filter((e) => isOverdue(e, overdueHours, now));
  const asked = new Set((reqs ?? []).map((r) => r.enquiry_id));
  const reviewPrompts = (completed ?? []).filter((c) => !asked.has(c.id));
  const getFound = getFoundItemsForToday(id, business.setup_checklist_state ?? {}, business.trade);
  const { weekday } = localClock(business.timezone);
  const fridayPrompt = (weekday === 5 || weekday === 6) && (weekEnquiries ?? 0) < 3;
  const base = `/business/${id}`;

  const nextAction = !business.positioning_confirmed_at
    ? { text: "Confirm your fact sheet so Booked can plan your month.", href: `${base}/positioning` }
    : overdue.length > 0
      ? { text: `Reply to ${overdue[0].name || "your newest enquiry"}. They've been waiting.`, href: `${base}/enquiries` }
      : reviewPrompts.length > 0
        ? { text: `Ask ${reviewPrompts[0].name?.split(" ")[0] || "your last customer"} for a review while the job is fresh.`, href: `${base}/reviews?enquiry=${reviewPrompts[0].id}` }
        : todayPosts.some((p) => p.status !== "posted")
          ? { text: "Post today's update. It's written and ready to copy.", href: `${base}/posts/${todayPosts.find((p) => p.status !== "posted")!.id}` }
          : shoot && shoot.status === "planned"
            ? { text: `Do this week's Shoot Day. About ${shoot.estimated_minutes} minutes.`, href: `${base}/shoot/${shoot.week_start}` }
            : !calCount
              ? { text: "Build this month's plan.", href: `${base}/calendar?generate=1` }
              : { text: "Got a DM or call today? Log it in 10 seconds.", href: `${base}/enquiries?log=1` };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Today</h1>
        <p className="text-sm text-muted-foreground">{formatDate(today, business.locale, { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>

      <Link href={nextAction.href} className="rounded-2xl bg-primary p-4 text-primary-foreground">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Next step</p>
        <p className="mt-1 font-semibold">{nextAction.text}</p>
      </Link>

      {getFound.length > 0 && <GetFoundCard businessId={id} items={getFound} disclaimer={CHECKLIST_DISCLAIMER} />}

      {enquiries.length > 0 && (
        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" aria-hidden />
            <CardTitle>
              {enquiries.length} new enquir{enquiries.length === 1 ? "y" : "ies"} to reply to
            </CardTitle>
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            {enquiries.slice(0, 3).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <span>{e.name || "Unnamed"}{e.service_requested ? ` · ${e.service_requested}` : ""}</span>
                {isOverdue(e, overdueHours, now) && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    <Clock className="h-3 w-3" /> waiting
                  </span>
                )}
              </li>
            ))}
          </ul>
          <Link href={`${base}/enquiries`} className="text-sm font-semibold text-primary underline">
            Open enquiries
          </Link>
        </Card>
      )}

      {reviewPrompts.length > 0 && (
        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" aria-hidden />
            <CardTitle>Ask for a review</CardTitle>
          </div>
          <CardDescription>Best within 24 hours of the job. Ask every customer, not just the ones you think are happy.</CardDescription>
          {reviewPrompts.slice(0, 3).map((r) => (
            <Link key={r.id} href={`${base}/reviews?enquiry=${r.id}`} className="text-sm font-semibold text-primary underline">
              Request a review from {r.name || "this customer"}
            </Link>
          ))}
        </Card>
      )}

      {shoot && (
        <Link href={`${base}/shoot/${shoot.week_start}`} className="block">
          <Card className="flex items-center gap-3">
            <Camera className="h-6 w-6 text-primary" aria-hidden />
            <div className="flex-1">
              <CardTitle>This week&apos;s Shoot Day</CardTitle>
              <CardDescription>
                {shoot.status === "done" ? "Done. Nice work." : shoot.status === "skipped" ? "Skipped. Use the no-filming posts." : `About ${shoot.estimated_minutes} minutes covers the whole week.`}
              </CardDescription>
            </div>
          </Card>
        </Link>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Today&apos;s posts</h2>
        {todayPosts.length === 0 ? (
          <Card>
            <CardDescription>
              Nothing due today.
              {nextShoot ? ` Your next shoot day is the week of ${formatDate(nextShoot.week_start, business.locale, { day: "numeric", month: "short" })}.` : ""}
            </CardDescription>
          </Card>
        ) : (
          todayPosts.map((p) => (
            <Link key={p.id} href={`${base}/posts/${p.id}`} className="block rounded-2xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <PlatformBadge platform={p.platform} />
                <StatusBadge status={p.status} />
                {p.safety_status !== "pass" && <SafetyBadge status={p.safety_status} />}
              </div>
              <p className="mt-1 font-medium">{p.hook}</p>
            </Link>
          ))
        )}
        {weekPosts.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {postedThisWeek} of {weekPosts.filter((p) => p.status !== "skipped").length} posts done this week.
          </p>
        )}
      </section>

      {fridayPrompt && (
        <Card className="flex flex-col gap-1">
          <CardTitle>Any DMs or calls this week?</CardTitle>
          <CardDescription>Most enquiries don&apos;t come through links. Log them so you can see what&apos;s working.</CardDescription>
          <Link href={`${base}/enquiries?log=1`} className="text-sm font-semibold text-primary underline">
            Quick Log
          </Link>
        </Card>
      )}

      <RoiCard roi={roi} locale={business.locale} href={`${base}/review`} />
      {access.canGenerate && <PushPrompt />}
    </div>
  );
}
