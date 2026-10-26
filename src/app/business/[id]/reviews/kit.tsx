"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, MessageSquare, Printer } from "lucide-react";
import type { ReviewRequest } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";

type Option = { channel: "sms" | "whatsapp" | "email"; text: string };

const STATUS = {
  drafted: { label: "Drafted", variant: "secondary" },
  sent_by_owner: { label: "Sent", variant: "default" },
  reviewed_self_reported: { label: "Reviewed", variant: "success" },
  ignored: { label: "No review", variant: "outline" },
} as const;

export function ReviewKit(props: {
  businessId: string;
  businessName: string;
  link: { platform: string; url: string } | null;
  googleUrl: string;
  otherPlatforms: { platform: string; url: string }[];
  platformOptions: { id: string; label: string }[];
  hasFacebook: boolean;
  requests: ReviewRequest[];
  jobs: { id: string; name: string | null; service: string | null }[];
  services: string[];
  canAi: boolean;
  limit: number;
  usedThisMonth: number;
  prefillEnquiry: string | null;
}) {
  const router = useRouter();
  const prefill = props.jobs.find((j) => j.id === props.prefillEnquiry);
  const [google, setGoogle] = useState(props.googleUrl);
  const [others, setOthers] = useState(props.otherPlatforms);
  const [newPlatform, setNewPlatform] = useState(props.platformOptions[0]?.id ?? "facebook");
  const [newUrl, setNewUrl] = useState("");
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  const [enquiryId, setEnquiryId] = useState<string | null>(prefill?.id ?? null);
  const [firstName, setFirstName] = useState(prefill?.name?.split(" ")[0] ?? "");
  const [service, setService] = useState(prefill?.service ?? "");
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<{ id: string; options: Option[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function saveLinks() {
    setLinkMsg(null);
    const res = await fetch(`/api/business/${props.businessId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fields: { google_review_url: google || null, review_platforms: [...(google ? [{ platform: "google", url: google }] : []), ...others] } }),
    });
    if (res.ok && google) {
      await fetch(`/api/business/${props.businessId}/checklist`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ item: "review_link", status: "done" }) });
    }
    setLinkMsg(res.ok ? "Saved." : (await res.json().catch(() => ({}))).error ?? "Check the links are full https:// addresses.");
    router.refresh();
  }

  async function request(useAi: boolean) {
    setDrafting(true);
    setErr(null);
    const res = await fetch("/api/ai/review-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessId: props.businessId, enquiryId, firstName, service: service || null, useAi }),
    });
    const data = await res.json().catch(() => ({}));
    setDrafting(false);
    if (!res.ok) {
      setErr(data.error ?? "Couldn't draft.");
      return;
    }
    setDraft({ id: data.request.id, options: data.options });
    router.refresh();
  }

  async function mark(id: string, body: Record<string, unknown>) {
    await fetch(`/api/review-requests/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    router.refresh();
  }

  const counts = {
    drafted: props.requests.length,
    sent: props.requests.filter((r) => r.status === "sent_by_owner" || r.status === "reviewed_self_reported").length,
    reviewed: props.requests.filter((r) => r.status === "reviewed_self_reported").length,
  };
  const channelHref = (o: Option) =>
    o.channel === "sms" ? `sms:?&body=${encodeURIComponent(o.text)}` : o.channel === "whatsapp" ? `https://wa.me/?text=${encodeURIComponent(o.text)}` : `mailto:?subject=${encodeURIComponent("Thank you")}&body=${encodeURIComponent(o.text)}`;

  return (
    <div className="flex flex-col gap-4">
      <Card className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-2xl font-bold">{counts.drafted}</p>
          <p className="text-xs text-muted-foreground">Drafted</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{counts.sent}</p>
          <p className="text-xs text-muted-foreground">Sent by you</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{counts.reviewed}</p>
          <p className="text-xs text-muted-foreground">New reviews (you told us)</p>
        </div>
      </Card>

      {props.link && (
        <Card className="flex flex-col gap-3">
          <CardTitle>Ask for a review</CardTitle>
          {props.jobs.length > 0 && (
            <>
              <Label htmlFor="job">Recently completed job</Label>
              <Select
                id="job"
                value={enquiryId ?? ""}
                onChange={(e) => {
                  const j = props.jobs.find((x) => x.id === e.target.value);
                  setEnquiryId(j?.id ?? null);
                  if (j) {
                    setFirstName(j.name?.split(" ")[0] ?? "");
                    setService(j.service ?? "");
                  }
                }}
              >
                <option value="">Someone else</option>
                {props.jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name ?? "Unnamed"}
                    {j.service ? ` · ${j.service}` : ""}
                  </option>
                ))}
              </Select>
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Input aria-label="Customer first name" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Select aria-label="Service" value={service} onChange={(e) => setService(e.target.value)}>
              <option value="">Service</option>
              {props.services.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </div>
          <CardDescription>
            {props.usedThisMonth} of {props.limit} requests used this month.
          </CardDescription>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!firstName.trim() || drafting} onClick={() => request(props.canAi)}>
              {drafting ? "Drafting…" : "Draft a personal message"}
            </Button>
            <Button variant="outline" disabled={!firstName.trim() || drafting} onClick={() => request(false)}>
              Use template
            </Button>
          </div>
          {draft && (
            <div className="flex flex-col gap-2">
              {draft.options.map((o) => (
                <div key={o.channel} className="rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{o.channel === "sms" ? "Text" : o.channel === "whatsapp" ? "WhatsApp" : "Email"}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{o.text}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a
                      href={channelHref(o)}
                      target={o.channel === "whatsapp" ? "_blank" : undefined}
                      rel="noreferrer"
                      onClick={() => mark(draft.id, { status: "sent_by_owner", channel: o.channel, message_used: o.text })}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground"
                    >
                      {o.channel === "email" ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />} Open and send
                    </a>
                    <CopyButton text={o.text} onCopied={() => mark(draft.id, { status: "sent_by_owner", channel: o.channel, message_used: o.text })} />
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">You send it from your own phone or email. Booked never messages customers for you.</p>
            </div>
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <CardTitle>Your review link</CardTitle>
        <Label htmlFor="g">Google review link</Label>
        <Input id="g" type="url" placeholder="https://g.page/r/…" value={google} onChange={(e) => setGoogle(e.target.value)} />
        {others.map((o, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-28 shrink-0">{props.platformOptions.find((p) => p.id === o.platform)?.label ?? o.platform}</span>
            <span className="flex-1 truncate">{o.url}</span>
            <Button size="sm" variant="ghost" onClick={() => setOthers(others.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </div>
        ))}
        <CardDescription>Only add platforms where you already have a profile.{!props.hasFacebook && " Facebook recommendations need a Facebook page."}</CardDescription>
        <div className="flex gap-2">
          <Select aria-label="Platform" value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)} className="w-40">
            {props.platformOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
          <Input aria-label="Profile review link" type="url" placeholder="https://" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!newUrl.startsWith("https://")}
          onClick={() => {
            setOthers([...others, { platform: newPlatform, url: newUrl }]);
            setNewUrl("");
          }}
        >
          Add link
        </Button>
        <Button onClick={saveLinks}>Save review links</Button>
        {linkMsg && <p className="text-sm">{linkMsg}</p>}
      </Card>

      {props.link && (
        <Card className="flex flex-col items-center gap-3 text-center">
          <CardTitle>QR code</CardTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/reviews/qr/${props.businessId}.svg`} alt="QR code for your review link" className="h-48 w-48" />
          <div className="flex flex-wrap justify-center gap-2">
            <a href={`/business/${props.businessId}/reviews/print?type=poster`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold">
              <Printer className="h-4 w-4" /> Poster
            </a>
            <a href={`/business/${props.businessId}/reviews/print?type=card`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold">
              <Printer className="h-4 w-4" /> Cards
            </a>
            <a href={`/api/reviews/qr/${props.businessId}.png`} download className="inline-flex h-11 items-center rounded-xl border border-border px-3 text-sm font-semibold">
              Download PNG
            </a>
          </div>
        </Card>
      )}

      {props.requests.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Requests</h2>
          {props.requests.slice(0, 30).map((r) => (
            <Card key={r.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.customer_first_name ?? "Customer"}</span>
                <Badge variant={STATUS[r.status].variant}>{STATUS[r.status].label}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {r.status === "drafted" && (
                  <Button size="sm" variant="outline" onClick={() => mark(r.id, { status: "sent_by_owner" })}>
                    I sent it
                  </Button>
                )}
                {r.status === "sent_by_owner" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => mark(r.id, { status: "reviewed_self_reported" })}>
                      They left a review
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => mark(r.id, { status: "ignored" })}>
                      No review
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
