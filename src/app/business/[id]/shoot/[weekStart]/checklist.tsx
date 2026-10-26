"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ShootPlan } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export function ShootChecklist({
  shootDayId,
  businessId,
  minutes,
  groups,
  done: initialDone,
  status: initialStatus,
}: {
  shootDayId: string;
  businessId: string;
  minutes: number;
  groups: ShootPlan["location_groups"];
  done: string[];
  status: "planned" | "done" | "skipped";
}) {
  const router = useRouter();
  const [done, setDone] = useState(new Set(initialDone));
  const [status, setStatus] = useState(initialStatus);
  const total = groups.reduce((n, g) => n + g.shots.length, 0);

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/shoot/${shootDayId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  }

  async function toggle(key: string) {
    const next = new Set(done);
    const on = !next.has(key);
    if (on) next.add(key);
    else next.delete(key);
    setDone(next);
    await patch({ shot: key, done: on });
    if (on && next.size === total && status !== "done") {
      setStatus("done");
      await patch({ status: "done" });
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex items-center justify-between gap-3">
        <div>
          <CardTitle>About {minutes} minutes</CardTitle>
          <CardDescription>
            {done.size} of {total} shots done. Film everything in one go, then post through the week.
          </CardDescription>
        </div>
        {status === "done" && <span className="text-sm font-semibold text-primary">Done</span>}
      </Card>
      {groups.map((g, gi) => (
        <Card key={gi} className="flex flex-col gap-2">
          <CardTitle>{g.location}</CardTitle>
          {g.props.length > 0 && <CardDescription>Bring: {g.props.join(", ")}</CardDescription>}
          <ul className="flex flex-col">
            {g.shots.map((s, si) => {
              const key = `${gi}:${si}`;
              const checked = done.has(key);
              return (
                <li key={key} className="flex items-start gap-3 border-t border-border py-2 first:border-0">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0 accent-[var(--primary)]"
                    checked={checked}
                    onChange={() => toggle(key)}
                    aria-label={s.description}
                    id={`shot-${key}`}
                  />
                  <label htmlFor={`shot-${key}`} className={checked ? "flex-1 text-sm text-muted-foreground line-through" : "flex-1 text-sm"}>
                    {s.description}
                  </label>
                  {s.post_id && (
                    <Link href={`/business/${businessId}/posts/${s.post_id}`} className="shrink-0 text-xs font-semibold text-primary underline">
                      Post
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
      {status === "planned" && (
        <Button
          variant="ghost"
          onClick={async () => {
            setStatus("skipped");
            await patch({ status: "skipped" });
            router.refresh();
          }}
        >
          Skip this week&apos;s shoot (use the no-filming posts)
        </Button>
      )}
    </div>
  );
}
