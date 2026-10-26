"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export function GenerateCalendar({
  businessId,
  resumeCalendarId,
  canGenerate,
  defaultMonth = "current",
  compact = false,
}: {
  businessId: string;
  resumeCalendarId?: string | null;
  canGenerate: boolean;
  defaultMonth?: "current" | "next";
  compact?: boolean;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [month, setMonth] = useState<"current" | "next">(defaultMonth);

  async function run(calendarId?: string | null) {
    setErr(null);
    setProgress({ done: 0, total: 0 });
    let id = calendarId ?? undefined;
    for (let i = 0; i < 8; i++) {
      const res = await fetch("/api/ai/calendar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessId, calendarId: id, month }),
      }).catch(() => null);
      const data = await res?.json().catch(() => null);
      if (!res?.ok || !data) {
        setErr(data?.error ?? "Something went wrong. Your progress is saved; try again.");
        setProgress(null);
        router.refresh();
        return;
      }
      id = data.calendarId;
      setProgress({ done: data.weeksDone, total: data.weeksTotal });
      if (data.done) break;
    }
    setProgress(null);
    router.push(`/business/${businessId}/calendar?cal=${id}`);
    router.refresh();
  }

  if (progress) {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 5;
    return (
      <Card className="flex flex-col gap-3" role="status">
        <CardTitle>Building your plan…</CardTitle>
        <CardDescription>
          {progress.total ? `Week ${Math.min(progress.done + 1, progress.total)} of ${progress.total}.` : "Starting."} This takes about a minute. Keep this screen open.
        </CardDescription>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </Card>
    );
  }

  if (resumeCalendarId) {
    return (
      <Card className="flex flex-col gap-3">
        <CardTitle>Your calendar isn&apos;t finished</CardTitle>
        <CardDescription>Pick up where it stopped. Weeks already planned are kept.</CardDescription>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button onClick={() => run(resumeCalendarId)} disabled={!canGenerate}>
          Finish building
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>{compact ? "Plan another month" : "Build your 30-day plan"}</CardTitle>
      {!compact && (
        <CardDescription>
          Posts in your voice, a weekly Shoot Day so filming takes one short session, Google posts if you have a profile, and fallback posts that need no filming.
        </CardDescription>
      )}
      <div className="flex gap-2" role="radiogroup" aria-label="Month">
        {(["current", "next"] as const).map((m) => (
          <Button key={m} variant={month === m ? "default" : "outline"} size="sm" role="radio" aria-checked={month === m} onClick={() => setMonth(m)}>
            {m === "current" ? "Rest of this month" : "Next month"}
          </Button>
        ))}
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {canGenerate ? (
        <Button onClick={() => run(null)}>Build my calendar</Button>
      ) : (
        <Link href="/settings#billing" className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground">
          Start your 7-day free trial
        </Link>
      )}
    </Card>
  );
}
