"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/input";

export function RegenerateWeekButton({ businessId, calendarId, weekStart, disabled }: { businessId: string; calendarId: string; weekStart: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end">
      <Button
        variant="ghost"
        size="sm"
        disabled={busy || disabled}
        onClick={async () => {
          if (!confirm("Replace this week's unposted drafts with a new plan? Posts you've marked posted stay.")) return;
          setBusy(true);
          setErr(null);
          const res = await fetch("/api/ai/calendar", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ businessId, calendarId, regenerateWeek: weekStart }),
          });
          setBusy(false);
          if (!res.ok) setErr((await res.json().catch(() => ({}))).error ?? "Couldn't regenerate.");
          router.refresh();
        }}
      >
        <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> {busy ? "Rewriting…" : "Regenerate week"}
      </Button>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

export function QuietSeasonToggle({ businessId, initial }: { businessId: string; initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  return (
    <Checkbox
      label="Quiet season mode (more retention and local-offer content in new plans)"
      checked={on}
      onChange={async (e) => {
        setOn(e.target.checked);
        await fetch(`/api/business/${businessId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fields: { quiet_season: e.target.checked } }),
        });
        router.refresh();
      }}
    />
  );
}
