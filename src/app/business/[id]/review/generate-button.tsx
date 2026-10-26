"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function GenerateReviewButton({ businessId, weekStart, hasReview }: { businessId: string; weekStart: string; hasReview: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          const res = await fetch("/api/ai/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ businessId, weekStart }) });
          setBusy(false);
          if (!res.ok) setErr((await res.json().catch(() => ({}))).error ?? "Couldn't build the review.");
          router.refresh();
        }}
      >
        {busy ? "Writing…" : hasReview ? "Refresh review" : "Write this week's review"}
      </Button>
      {err && <p className="text-sm text-destructive">{err}</p>}
    </>
  );
}
