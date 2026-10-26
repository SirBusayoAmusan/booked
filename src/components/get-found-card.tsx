"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type GetFoundItem = { id: string; title: string; why_it_matters: string; time_estimate_minutes: number; notes?: string; href?: string };

export function GetFoundCard({ businessId, items, disclaimer }: { businessId: string; items: GetFoundItem[]; disclaimer: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  if (items.length === 0) return null;

  async function mark(item: string, status: "done" | "hidden") {
    setBusy(item);
    await fetch(`/api/business/${businessId}/checklist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ item, status }),
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <CardTitle>Get found</CardTitle>
        <CardDescription>A few setup steps so customers can find you, contact you and review you.</CardDescription>
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((i) => (
          <li key={i.id} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{i.title}</p>
              <span className="shrink-0 text-xs text-muted-foreground">~{i.time_estimate_minutes} min</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{i.why_it_matters}</p>
            {i.notes && <p className="mt-1 text-xs text-muted-foreground">{i.notes}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {i.href && (
                <a href={i.href} className="inline-flex h-11 items-center rounded-xl bg-secondary px-3 text-sm font-semibold">
                  Open
                </a>
              )}
              <Button size="sm" variant="outline" disabled={busy === i.id} onClick={() => mark(i.id, "done")}>
                <Check className="h-4 w-4" /> Done
              </Button>
              <Button size="sm" variant="ghost" disabled={busy === i.id} onClick={() => mark(i.id, "hidden")}>
                Not for me
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{disclaimer}</p>
    </Card>
  );
}
