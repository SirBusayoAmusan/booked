"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { ONBOARDING_STEPS, type OnboardingAnswers } from "@/lib/onboarding";
import { COUNTRY_DEFAULTS, countryFromTimezone, type Country } from "@/lib/config/locale";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/input";

const PLATFORM_OPTIONS = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
  { id: "google_business", label: "Google Business Profile" },
  { id: "whatsapp_status", label: "WhatsApp status (optional)" },
];

const PRESENCE_OPTIONS = [
  { id: "google_business", label: "Google Business Profile" },
  { id: "facebook", label: "Facebook page" },
  { id: "instagram", label: "Instagram" },
  { id: "website", label: "Website" },
  { id: "card_payments", label: "A way to take card payments" },
] as const;

type Status = "idle" | "saving" | "saved" | "error";

export function OnboardingWizard({
  businessId,
  initialAnswers,
  initialStep,
}: {
  businessId: string;
  initialAnswers: OnboardingAnswers;
  initialStep: number;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<OnboardingAnswers>(initialAnswers);
  const [step, setStep] = useState(Math.min(initialStep, ONBOARDING_STEPS.length));
  const [saveStatus, setSaveStatus] = useState<Status>("idle");
  const [building, setBuilding] = useState<null | string>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const pending = useRef<Partial<OnboardingAnswers>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect timezone and country once, so digests go out in local time.
  useEffect(() => {
    if (!initialAnswers.timezone) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      update({ timezone: tz, country: initialAnswers.country ?? countryFromTimezone(tz) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function flush(extra?: { onboarding_step?: number }) {
    if (timer.current) clearTimeout(timer.current);
    const changes = pending.current;
    pending.current = {};
    if (Object.keys(changes).length === 0 && !extra) return true;
    setSaveStatus("saving");
    const res = await fetch(`/api/business/${businessId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ onboarding_answers: changes, ...extra }),
    }).catch(() => null);
    setSaveStatus(res?.ok ? "saved" : "error");
    return Boolean(res?.ok);
  }

  function update(changes: Partial<OnboardingAnswers>) {
    setAnswers((a) => ({ ...a, ...changes }));
    pending.current = { ...pending.current, ...changes };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(), 800);
  }

  async function go(next: number) {
    await flush({ onboarding_step: next });
    setStep(next);
    window.scrollTo({ top: 0 });
  }

  async function build() {
    setBuildError(null);
    await flush({ onboarding_step: ONBOARDING_STEPS.length });
    setBuilding("Building your fact sheet…");
    const fs = await fetch("/api/ai/fact-sheet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessId }),
    });
    if (!fs.ok) {
      setBuilding(null);
      setBuildError((await fs.json().catch(() => ({}))).error ?? "Something went wrong.");
      return;
    }
    setBuilding("Working out your positioning and content pillars…");
    const pos = await fetch("/api/ai/positioning", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessId }),
    });
    if (!pos.ok) {
      setBuilding(null);
      setBuildError((await pos.json().catch(() => ({}))).error ?? "Something went wrong.");
      return;
    }
    router.push(`/business/${businessId}/positioning`);
  }

  const total = ONBOARDING_STEPS.length;
  const current = ONBOARDING_STEPS[step];
  const progress = Math.round((step / total) * 100);

  if (building) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden />
        <p className="font-semibold" role="status">
          {building}
        </p>
        <p className="text-sm text-muted-foreground">This usually takes under a minute. Only facts you gave us are used.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-10 pt-4">
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {Math.min(step + 1, total)} of {total}
          </span>
          <span aria-live="polite">{saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Not saved, check your connection" : ""}</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {step === 0 && (
        <p className="mb-4 rounded-xl bg-secondary p-3 text-sm">
          Booked plans your marketing. You keep using your own booking and payment tools. Booked doesn&apos;t post for you or take bookings, and we never ask for your social media passwords.
        </p>
      )}

      {current ? (
        <section className="flex flex-1 flex-col gap-4">
          <h1 className="text-xl font-bold leading-snug">{current.title}</h1>
          <StepFields id={current.id} a={answers} update={update} />
          <div className="mt-auto flex gap-3 pt-6">
            {step > 0 && (
              <Button variant="outline" onClick={() => go(step - 1)}>
                Back
              </Button>
            )}
            <Button className="flex-1" onClick={() => go(step + 1)} disabled={step === 0 && !answers.name?.trim()}>
              {step === total - 1 ? "Review" : "Next"}
            </Button>
          </div>
        </section>
      ) : (
        <section className="flex flex-1 flex-col gap-4">
          <h1 className="text-xl font-bold">Ready to build your fact sheet</h1>
          <p className="text-sm text-muted-foreground">
            We&apos;ll turn your answers into a fact sheet and a positioning summary. You&apos;ll review both before anything else is created. Booked only uses facts you give it.
          </p>
          {buildError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{buildError}</p>}
          <div className="mt-auto flex gap-3 pt-6">
            <Button variant="outline" onClick={() => go(step - 1)}>
              Back
            </Button>
            <Button className="flex-1" onClick={build}>
              Build my fact sheet
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}

function StepFields({ id, a, update }: { id: string; a: OnboardingAnswers; update: (c: Partial<OnboardingAnswers>) => void }) {
  switch (id) {
    case "basics":
      return (
        <div className="flex flex-col gap-3">
          <Label htmlFor="name">Business name</Label>
          <Input id="name" value={a.name ?? ""} onChange={(e) => update({ name: e.target.value })} autoComplete="organization" />
          <Label htmlFor="trade">Your trade</Label>
          <Input id="trade" placeholder="e.g. mobile detailing, barber, cleaner" value={a.trade ?? ""} onChange={(e) => update({ trade: e.target.value })} />
          <Label htmlFor="country">Country</Label>
          <Select id="country" value={a.country ?? "US"} onChange={(e) => update({ country: e.target.value as Country })}>
            {Object.entries(COUNTRY_DEFAULTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
          {a.timezone && <p className="text-xs text-muted-foreground">Time zone: {a.timezone}. Reminders use this.</p>}
        </div>
      );
    case "about":
      return (
        <div className="flex flex-col gap-3">
          <Label htmlFor="about">What you do</Label>
          <Textarea id="about" value={a.about ?? ""} onChange={(e) => update({ about: e.target.value })} />
          <Label htmlFor="happy">What happy customers say (in their words, if you can)</Label>
          <Textarea id="happy" value={a.happy_customers_say ?? ""} onChange={(e) => update({ happy_customers_say: e.target.value })} />
        </div>
      );
    case "area":
      return (
        <div className="flex flex-col gap-3">
          <Label htmlFor="city">Town or city</Label>
          <Input id="city" value={a.city ?? ""} onChange={(e) => update({ city: e.target.value })} />
          <Label htmlFor="sa">Service area</Label>
          <Input id="sa" placeholder="e.g. 15 miles around Austin, or my shop only" value={a.service_area ?? ""} onChange={(e) => update({ service_area: e.target.value })} />
          <Label htmlFor="nb">Neighbourhoods you serve (comma separated)</Label>
          <Input id="nb" value={a.neighbourhoods ?? ""} onChange={(e) => update({ neighbourhoods: e.target.value })} />
          <Label htmlFor="lang">Languages your customers speak</Label>
          <Input id="lang" placeholder="English, Spanish" value={a.languages ?? ""} onChange={(e) => update({ languages: e.target.value })} />
        </div>
      );
    case "services": {
      const services = a.services?.length ? a.services : [{ name: "", price_or_range: null, duration: null, notes: null }];
      const set = (i: number, k: "name" | "price_or_range" | "duration", v: string) =>
        update({ services: services.map((s, j) => (j === i ? { ...s, [k]: v } : s)) });
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Leave the price blank if you quote case by case. Booked will never make one up.</p>
          {services.map((s, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <Input aria-label="Service name" placeholder="Service" value={s.name} onChange={(e) => set(i, "name", e.target.value)} />
              <div className="flex gap-2">
                <Input aria-label="Price or range" placeholder="Price or range" value={s.price_or_range ?? ""} onChange={(e) => set(i, "price_or_range", e.target.value)} />
                <Input aria-label="Duration" placeholder="How long" value={s.duration ?? ""} onChange={(e) => set(i, "duration", e.target.value)} />
              </div>
              {services.length > 1 && (
                <Button variant="ghost" size="sm" className="self-end" onClick={() => update({ services: services.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" onClick={() => update({ services: [...services, { name: "", price_or_range: null, duration: null, notes: null }] })}>
            <Plus className="h-4 w-4" /> Add a service
          </Button>
        </div>
      );
    }
    case "best_customer":
      return <Textarea aria-label="Your best customer" value={a.best_customer ?? ""} onChange={(e) => update({ best_customer: e.target.value })} className="min-h-40" />;
    case "booking_tool":
      return (
        <div className="flex flex-col gap-3">
          <Label htmlFor="bt">Booking or payment tool</Label>
          <Select id="bt" value={a.booking_tool ?? "none"} onChange={(e) => update({ booking_tool: e.target.value as OnboardingAnswers["booking_tool"] })}>
            <option value="none">None, just texts and calls</option>
            <option value="square">Square</option>
            <option value="jobber">Jobber</option>
            <option value="booksy">Booksy</option>
            <option value="fresha">Fresha</option>
            <option value="calendly">Calendly</option>
            <option value="other">Something else</option>
          </Select>
          {a.booking_tool && a.booking_tool !== "none" && (
            <>
              <Label htmlFor="bl">Your booking link (optional)</Label>
              <Input id="bl" type="url" inputMode="url" placeholder="https://" value={a.external_booking_url ?? ""} onChange={(e) => update({ external_booking_url: e.target.value })} />
              <p className="text-xs text-muted-foreground">Your Book now button will send people here. Booked doesn&apos;t replace your booking tool.</p>
            </>
          )}
        </div>
      );
    case "presence": {
      const p = a.presence ?? {};
      return (
        <div className="flex flex-col gap-1">
          <p className="mb-2 text-sm text-muted-foreground">&quot;None yet&quot; is a fine answer. Booked works either way and will walk you through the basics.</p>
          {PRESENCE_OPTIONS.map((o) => (
            <Checkbox key={o.id} label={o.label} checked={Boolean(p[o.id])} onChange={(e) => update({ presence: { ...p, [o.id]: e.target.checked } })} />
          ))}
          {p.instagram && (
            <Input aria-label="Instagram handle" placeholder="@yourhandle" value={p.instagram_handle ?? ""} onChange={(e) => update({ presence: { ...p, instagram_handle: e.target.value } })} />
          )}
          {p.website && (
            <Input aria-label="Website" type="url" placeholder="https://" className="mt-2" value={p.website_url ?? ""} onChange={(e) => update({ presence: { ...p, website_url: e.target.value } })} />
          )}
        </div>
      );
    }
    case "contact":
      return (
        <div className="flex flex-col gap-3">
          <Label htmlFor="bm">Main way people reach you</Label>
          <Select id="bm" value={a.booking_method ?? "text"} onChange={(e) => update({ booking_method: e.target.value as OnboardingAnswers["booking_method"] })}>
            <option value="text">Text message</option>
            <option value="call">Phone call</option>
            <option value="dm">Instagram or Facebook DM</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="form">A form or booking page</option>
          </Select>
          <Label htmlFor="ph">Phone number for calls and texts</Label>
          <Input id="ph" type="tel" autoComplete="tel" value={a.phone ?? ""} onChange={(e) => update({ phone: e.target.value })} />
          <Label htmlFor="wa">WhatsApp number (optional)</Label>
          <Input id="wa" type="tel" value={a.whatsapp_number ?? ""} onChange={(e) => update({ whatsapp_number: e.target.value })} />
        </div>
      );
    case "platforms": {
      const platforms = a.platforms ?? [];
      return (
        <div className="flex flex-col gap-1">
          {PLATFORM_OPTIONS.map((o) => (
            <Checkbox
              key={o.id}
              label={o.label}
              checked={platforms.includes(o.id)}
              onChange={(e) => update({ platforms: e.target.checked ? [...platforms, o.id] : platforms.filter((x) => x !== o.id) })}
            />
          ))}
          <Label htmlFor="tried" className="mt-3">
            What have you tried posting? What worked?
          </Label>
          <Textarea id="tried" value={a.tried_posting ?? ""} onChange={(e) => update({ tried_posting: e.target.value })} />
        </div>
      );
    }
    case "time":
      return (
        <div className="flex flex-col gap-3">
          <Label htmlFor="hours">Hours per week for marketing</Label>
          <Select id="hours" value={String(a.weekly_hours ?? 1)} onChange={(e) => update({ weekly_hours: Number(e.target.value) })}>
            <option value="0.5">About 30 minutes</option>
            <option value="1">About 1 hour</option>
            <option value="2">About 2 hours</option>
            <option value="3">3 hours or more</option>
          </Select>
          <Checkbox label="I'm comfortable showing my face on camera" checked={a.faces_on_camera ?? true} onChange={(e) => update({ faces_on_camera: e.target.checked })} />
        </div>
      );
    case "voice": {
      const samples = a.voice_samples ?? ["", "", ""];
      return (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Textarea
              key={i}
              aria-label={`Caption or message ${i + 1}`}
              placeholder={`Caption or message ${i + 1}`}
              value={samples[i] ?? ""}
              onChange={(e) => update({ voice_samples: [0, 1, 2].map((j) => (j === i ? e.target.value : samples[j] ?? "")) })}
            />
          ))}
          <Label htmlFor="vn">Or describe how you talk</Label>
          <Input id="vn" placeholder="e.g. friendly, straight to the point, a bit of humour" value={a.voice_notes ?? ""} onChange={(e) => update({ voice_notes: e.target.value })} />
        </div>
      );
    }
    case "proof":
      return (
        <div className="flex flex-col gap-3">
          <Textarea aria-label="Your proof" placeholder="e.g. 40 before/after photos of cars, 23 Google reviews averaging 4.9" value={a.proof ?? ""} onChange={(e) => update({ proof: e.target.value })} />
          <Checkbox label="I have permission to share these, including any photos of customers" checked={Boolean(a.proof_permission)} onChange={(e) => update({ proof_permission: e.target.checked })} />
          <p className="text-xs text-muted-foreground">No proof yet? That&apos;s fine. Booked never invents reviews or results; it will give you simple tasks to collect real ones.</p>
        </div>
      );
    case "regulated":
      return (
        <div className="flex flex-col gap-3">
          <Label htmlFor="reg">Licences, claims you can&apos;t make, price rules</Label>
          <Textarea id="reg" value={a.regulated_notes ?? ""} onChange={(e) => update({ regulated_notes: e.target.value })} />
          <Label htmlFor="lic">Licence, insurance or registration details (only if you have them)</Label>
          <Input id="lic" value={a.licence_ref ?? ""} onChange={(e) => update({ licence_ref: e.target.value })} />
          <Label htmlFor="bw">Words to avoid (comma separated)</Label>
          <Input id="bw" value={a.banned_words ?? ""} onChange={(e) => update({ banned_words: e.target.value })} />
        </div>
      );
    case "review_link":
      return (
        <div className="flex flex-col gap-3">
          <Input aria-label="Google review link" type="url" inputMode="url" placeholder="https://g.page/r/…" value={a.google_review_url ?? ""} onChange={(e) => update({ google_review_url: e.target.value })} />
          <p className="text-xs text-muted-foreground">Don&apos;t have one yet? Leave it blank. We&apos;ll add &quot;set up your review link&quot; to your Get Found checklist.</p>
        </div>
      );
    default:
      return null;
  }
}
