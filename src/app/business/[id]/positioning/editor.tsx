"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { FactSheet, Positioning } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function PositioningEditor({
  businessId,
  factSheet,
  positioning,
  confirmed,
  canGenerate,
}: {
  businessId: string;
  factSheet: FactSheet;
  positioning: Positioning;
  confirmed: boolean;
  canGenerate: boolean;
  hasCalendar: boolean;
}) {
  const router = useRouter();
  const [fs, setFs] = useState<FactSheet>(factSheet);
  const [pos, setPos] = useState<Positioning>(positioning);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(confirmed);

  async function confirm() {
    setSaving(true);
    setErr(null);
    const res = await fetch(`/api/business/${businessId}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fact_sheet: fs, positioning: pos }),
    });
    setSaving(false);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? "Couldn't save.");
      return;
    }
    setDone(true);
    router.refresh();
  }

  const setService = (i: number, k: "name" | "price_or_range" | "duration", v: string) =>
    setFs({ ...fs, services: fs.services.map((s, j) => (j === i ? { ...s, [k]: v || (k === "name" ? "" : null) } : s)) });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Your positioning and fact sheet</h1>
        <p className="text-sm text-muted-foreground">
          Booked only uses the facts on this page. Fix anything that&apos;s wrong, then confirm.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <CardTitle>Positioning</CardTitle>
        <Textarea aria-label="Positioning statement" value={pos.positioning_statement} onChange={(e) => setPos({ ...pos, positioning_statement: e.target.value })} />
        <div>
          <p className="text-sm font-medium">Ideal customer</p>
          <p className="text-sm text-muted-foreground">{pos.ideal_customer.who}</p>
          {pos.ideal_customer.pain_in_their_words.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
              {pos.ideal_customer.pain_in_their_words.map((p) => (
                <li key={p}>&ldquo;{p}&rdquo;</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-sm font-medium">Content pillars</p>
          <ul className="mt-1 flex flex-col gap-2">
            {pos.pillars.map((p, i) => (
              <li key={i} className="flex items-center gap-2">
                <Input aria-label={`Pillar ${i + 1}`} value={p.name} onChange={(e) => setPos({ ...pos, pillars: pos.pillars.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <Badge variant="secondary">{p.purpose}</Badge>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-medium">Platform mix</p>
          <p className="text-muted-foreground">
            Primary: {pos.platform_mix.primary}. Where people get in touch: {pos.platform_mix.conversion_channel}. {pos.platform_mix.reasoning}
          </p>
        </div>
        {pos.missing_proof_tasks.length > 0 && (
          <div className="text-sm">
            <p className="font-medium">Proof to collect</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {pos.missing_proof_tasks.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}
        {pos.assumptions.length > 0 && (
          <div className="text-sm">
            <p className="font-medium">Assumptions to check</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {pos.assumptions.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>Fact sheet</CardTitle>
        <CardDescription>Prices here are the only prices Booked will ever write. Leave a price blank if you quote case by case.</CardDescription>
        {fs.services.map((s, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <Input aria-label="Service" value={s.name} onChange={(e) => setService(i, "name", e.target.value)} />
            <div className="flex gap-2">
              <Input aria-label="Price or range" placeholder="Price or range" value={s.price_or_range ?? ""} onChange={(e) => setService(i, "price_or_range", e.target.value)} />
              <Input aria-label="Duration" placeholder="Duration" value={s.duration ?? ""} onChange={(e) => setService(i, "duration", e.target.value)} />
            </div>
            <Button variant="ghost" size="sm" className="self-end" onClick={() => setFs({ ...fs, services: fs.services.filter((_, j) => j !== i) })}>
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          </div>
        ))}
        <Button variant="outline" onClick={() => setFs({ ...fs, services: [...fs.services, { name: "", price_or_range: null, duration: null, notes: null }] })}>
          <Plus className="h-4 w-4" /> Add service
        </Button>
        <Label htmlFor="area">Service area</Label>
        <Input id="area" value={fs.service_area} onChange={(e) => setFs({ ...fs, service_area: e.target.value })} />
        <Label htmlFor="hours">Opening hours</Label>
        <Input id="hours" value={fs.opening_hours ?? ""} onChange={(e) => setFs({ ...fs, opening_hours: e.target.value || null })} />
        <Label htmlFor="diff">What makes you different (one per line, your words)</Label>
        <Textarea id="diff" value={fs.differentiators_stated_by_owner.join("\n")} onChange={(e) => setFs({ ...fs, differentiators_stated_by_owner: lines(e.target.value) })} />
        <Label htmlFor="dns">Never say (one per line)</Label>
        <Textarea id="dns" value={fs.do_not_say.join("\n")} onChange={(e) => setFs({ ...fs, do_not_say: lines(e.target.value) })} />
        {fs.unknowns_to_ask_owner.length > 0 && (
          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <p className="font-medium">Questions for you</p>
            <ul className="list-disc pl-5">
              {fs.unknowns_to_ask_owner.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
            <p className="mt-1">Add the answers above. Until then, posts use a [placeholder] you fill in.</p>
          </div>
        )}
      </Card>

      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button onClick={confirm} disabled={saving}>
        {saving ? "Saving…" : done ? "Save changes" : "Confirm fact sheet and positioning"}
      </Button>

      {done && (
        <Card className="flex flex-col gap-2">
          <CardTitle>Next: your 30-day plan</CardTitle>
          {canGenerate ? (
            <a className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground" href={`/business/${businessId}/calendar?generate=1`}>
              Build my 30-day calendar
            </a>
          ) : (
            <>
              <CardDescription>Start your 7-day free trial to build your first calendar and weekly Shoot Day plan.</CardDescription>
              <a className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground" href="/settings#billing">
                Start your 7-day free trial
              </a>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
