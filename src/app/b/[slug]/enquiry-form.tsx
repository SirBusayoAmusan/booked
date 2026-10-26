"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/input";

export function EnquiryForm({ slug, src, services, businessName }: { slug: string; src: string | null; services: string[]; businessName: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState("sending");
    const res = await fetch("/api/public/enquiry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        src,
        name: fd.get("name"),
        contact: fd.get("contact"),
        service: fd.get("service") || null,
        message: fd.get("message"),
        consent: fd.get("consent") === "on",
        website: fd.get("website"),
      }),
    }).catch(() => null);
    if (res?.ok) setState("sent");
    else {
      setState("error");
      setMsg((await res?.json().catch(() => null))?.error ?? "Couldn't send. Please try again.");
    }
  }

  if (state === "sent") {
    return <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">Thanks! Your enquiry was sent to {businessName}.</p>;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Label htmlFor="name">Your name</Label>
      <Input id="name" name="name" required maxLength={80} autoComplete="name" />
      <Label htmlFor="contact">Phone or email</Label>
      <Input id="contact" name="contact" required maxLength={120} autoComplete="tel" />
      {services.length > 0 && (
        <>
          <Label htmlFor="service">Service</Label>
          <Select id="service" name="service" defaultValue="">
            <option value="">Not sure yet</option>
            {services.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </>
      )}
      <Label htmlFor="message">Message</Label>
      <Textarea id="message" name="message" maxLength={2000} />
      {/* Honeypot: hidden from people, filled by bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Checkbox name="consent" required label={`I agree that ${businessName} can contact me about this enquiry.`} />
      <p className="text-xs text-muted-foreground">
        Your details go only to {businessName} so they can reply. They are stored by Booked on their behalf. See our{" "}
        <a href="/privacy" className="underline">
          privacy notice
        </a>
        .
      </p>
      {state === "error" && <p className="text-sm text-destructive">{msg}</p>}
      <Button type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Send enquiry"}
      </Button>
    </form>
  );
}
