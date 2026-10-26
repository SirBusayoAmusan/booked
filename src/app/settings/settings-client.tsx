"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Business, Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/input";
import { subscribeToPush } from "@/components/push-prompt";

export function SettingsClient({ profile, business, subscribed, paused, vapidConfigured }: { profile: Profile; business: Business | null; subscribed: boolean; paused: boolean; vapidConfigured: boolean }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(profile.notification_prefs);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [voice, setVoice] = useState({
    voice_notes: business?.voice_notes ?? "",
    voice_samples: [0, 1, 2].map((i) => business?.voice_samples?.[i] ?? ""),
    banned_words: (business?.banned_words ?? []).join(", "),
    offers_enabled: business?.offers_enabled ?? false,
    licence: business?.licence_or_registration_ref ?? "",
  });

  const note = (k: string, v: string) => setMsg((m) => ({ ...m, [k]: v }));

  async function savePrefs(next: Partial<Profile["notification_prefs"]>) {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ notification_prefs: next }) });
    note("prefs", res.ok ? "Saved." : "Couldn't save.");
  }

  async function subscription(action: "pause" | "resume" | "cancel" | "undo_cancel") {
    if (action === "cancel" && !confirm("Cancel your subscription? You keep access until the end of this billing period, and you can export your data any time.")) return;
    note("billing", "Working…");
    const res = await fetch("/api/billing/subscription", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await res.json().catch(() => ({}));
    note("billing", res.ok ? "Done." : data.error ?? "Couldn't update.");
    router.refresh();
  }

  async function saveVoice() {
    if (!business) return;
    const res = await fetch(`/api/business/${business.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fields: {
          voice_notes: voice.voice_notes || null,
          voice_samples: voice.voice_samples.filter((s) => s.trim()),
          banned_words: voice.banned_words.split(",").map((w) => w.trim()).filter(Boolean),
          offers_enabled: voice.offers_enabled,
          licence_or_registration_ref: voice.licence || null,
        },
      }),
    });
    note("voice", res.ok ? "Saved. New posts will use this." : "Couldn't save.");
  }

  async function danger(kind: "purge" | "delete") {
    const typed = prompt(kind === "purge" ? "This deletes every enquiry and review request for your business. Type DELETE to confirm." : "This deletes your account and all your data, and cancels your subscription. Type DELETE to confirm.");
    if (typed !== "DELETE") return;
    const res = await fetch(kind === "purge" ? "/api/account/purge-enquiries" : "/api/account/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE", businessId: business?.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      note("danger", data.error ?? "Couldn't complete that.");
      return;
    }
    if (kind === "delete") {
      router.replace("/");
      router.refresh();
    }
    else note("danger", "Enquiry data deleted.");
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {subscribed && (
        <Card className="flex flex-col gap-2">
          <CardTitle>Manage your subscription</CardTitle>
          <a href="/api/billing/manage" className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-4 font-semibold">
            Update card, see receipts and invoices
          </a>
          {paused ? (
            <Button variant="outline" onClick={() => subscription("resume")}>
              Resume subscription
            </Button>
          ) : (
            <Button variant="outline" onClick={() => subscription("pause")}>
              Pause for a quiet season
            </Button>
          )}
          <Button variant="ghost" onClick={() => subscription("cancel")}>
            Cancel subscription
          </Button>
          <CardDescription>Paused or canceled, you can still see your calendar and enquiries and export your data.</CardDescription>
          {msg.billing && <p className="text-sm">{msg.billing}</p>}
        </Card>
      )}

      <Card className="flex flex-col gap-2">
        <CardTitle>Notifications</CardTitle>
        <Checkbox label='Monday email: "Your plan for this week"' checked={prefs.digest_email} onChange={(e) => savePrefs({ digest_email: e.target.checked })} />
        <Label htmlFor="od">Remind me about an unanswered enquiry after</Label>
        <Select id="od" value={String(prefs.overdue_hours)} onChange={(e) => savePrefs({ overdue_hours: Number(e.target.value) })}>
          <option value="1">1 hour</option>
          <option value="2">2 hours</option>
          <option value="4">4 hours</option>
          <option value="24">1 day</option>
          <option value="0">Never</option>
        </Select>
        {vapidConfigured && (
          <>
            <Checkbox
              label="Push notifications on this phone"
              checked={prefs.push_enabled}
              onChange={async (e) => {
                if (e.target.checked) {
                  const ok = await subscribeToPush();
                  if (ok) setPrefs({ ...prefs, push_enabled: true });
                  else note("prefs", "Notifications are blocked in your browser settings.");
                } else savePrefs({ push_enabled: false });
              }}
            />
            {prefs.push_enabled && (
              <>
                <Checkbox label="Remind me on days a post is due" checked={prefs.post_day_push} onChange={(e) => savePrefs({ post_day_push: e.target.checked })} />
                {prefs.post_day_push && (
                  <Select aria-label="Reminder time" value={String(prefs.post_day_hour)} onChange={(e) => savePrefs({ post_day_hour: Number(e.target.value) })}>
                    {Array.from({ length: 17 }, (_, i) => i + 5).map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}:00
                      </option>
                    ))}
                  </Select>
                )}
              </>
            )}
          </>
        )}
        {msg.prefs && <p className="text-sm">{msg.prefs}</p>}
      </Card>

      {business && (
        <Card className="flex flex-col gap-2">
          <CardTitle>Voice and rules</CardTitle>
          <Label htmlFor="vn">How you like to sound</Label>
          <Input id="vn" value={voice.voice_notes} onChange={(e) => setVoice({ ...voice, voice_notes: e.target.value })} />
          {voice.voice_samples.map((s, i) => (
            <Textarea
              key={i}
              aria-label={`Example caption ${i + 1}`}
              placeholder={`Example caption or message ${i + 1}`}
              value={s}
              onChange={(e) => setVoice({ ...voice, voice_samples: voice.voice_samples.map((x, j) => (j === i ? e.target.value : x)) })}
              className="min-h-16"
            />
          ))}
          <Label htmlFor="bw">Words to avoid (comma separated)</Label>
          <Input id="bw" value={voice.banned_words} onChange={(e) => setVoice({ ...voice, banned_words: e.target.value })} />
          <Label htmlFor="lic">Licence, insurance or registration details</Label>
          <Input id="lic" value={voice.licence} onChange={(e) => setVoice({ ...voice, licence: e.target.value })} />
          <CardDescription>Only add these if you really have them. Posts can mention being licensed or insured only when this is filled in.</CardDescription>
          <Checkbox label="I run offers (adds code words like 'say REEL for 10% off' to some posts)" checked={voice.offers_enabled} onChange={(e) => setVoice({ ...voice, offers_enabled: e.target.checked })} />
          <Button onClick={saveVoice}>Save</Button>
          {msg.voice && <p className="text-sm">{msg.voice}</p>}
        </Card>
      )}

      <Card className="flex flex-col gap-2">
        <CardTitle>Your data</CardTitle>
        <CardDescription>Your enquiries belong to you. Export or delete them any time.</CardDescription>
        {business && (
          <a href={`/api/enquiries/export.csv?businessId=${business.id}`} className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-4 font-semibold">
            Export enquiries (CSV)
          </a>
        )}
        <a href="/api/account/export" className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-4 font-semibold">
          Export everything (JSON)
        </a>
        {business && (
          <Button variant="outline" onClick={() => danger("purge")}>
            Delete all enquiry data
          </Button>
        )}
        <Button variant="destructive" onClick={() => danger("delete")}>
          Delete my account
        </Button>
        {msg.danger && <p className="text-sm">{msg.danger}</p>}
      </Card>
    </div>
  );
}
