"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { SavedReply } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { CopyButton } from "@/components/copy-button";

type Option = { label: "short" | "friendly"; text: string; placeholders_to_fill: string[] };

export function ReplyHelper({
  businessId,
  services,
  saved,
  canGenerate,
  initialMessage,
  initialService,
  enquiryId,
}: {
  businessId: string;
  services: string[];
  saved: SavedReply[];
  canGenerate: boolean;
  initialMessage: string;
  initialService: string;
  enquiryId: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage);
  const [service, setService] = useState(initialService);
  const [options, setOptions] = useState<(Option & { edited: string })[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function draft() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/ai/reply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessId, message, service: service || null }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data.error ?? "Couldn't draft a reply.");
      return;
    }
    setOptions((data.options as Option[]).map((o) => ({ ...o, edited: o.text })));
  }

  async function saveToLibrary(o: Option & { edited: string }) {
    const title = prompt("Name this reply (e.g. 'Price question: full detail')", service ? `${service} reply` : "Reply");
    if (!title) return;
    await fetch("/api/saved-replies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessId, title, service: service || null, body: o.edited, draft: o.text }),
    });
    router.refresh();
  }

  async function markContacted() {
    if (enquiryId) await fetch(`/api/enquiries/${enquiryId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "contacted" }) });
  }

  const shown = saved.filter((s) => !filter || (s.title + s.body + (s.service ?? "")).toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Reply Helper</h1>
        <p className="text-sm text-muted-foreground">Paste a customer message. You get two drafts using only your real prices and details. You send it yourself.</p>
      </div>
      <Card className="flex flex-col gap-3">
        <Label htmlFor="msg">Customer message</Label>
        <Textarea id="msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. hey how much for a full detail on a 2019 RAV4? free saturday?" />
        {services.length > 0 && (
          <>
            <Label htmlFor="svc">Service</Label>
            <Select id="svc" value={service} onChange={(e) => setService(e.target.value)}>
              <option value="">Not sure</option>
              {services.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </>
        )}
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button onClick={draft} disabled={busy || !canGenerate || message.trim().length < 2}>
          {busy ? "Drafting…" : "Draft 2 replies"}
        </Button>
      </Card>

      {options.map((o, i) => (
        <Card key={i} className="flex flex-col gap-2">
          <CardTitle>{o.label === "short" ? "Short" : "Friendlier"}</CardTitle>
          <Textarea aria-label={`${o.label} reply`} value={o.edited} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, edited: e.target.value } : x)))} />
          {o.placeholders_to_fill.length > 0 && (
            <p className="rounded-xl bg-amber-50 p-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
              Fill in before sending: {o.placeholders_to_fill.join(", ")}. Booked didn&apos;t guess these because they aren&apos;t in your fact sheet.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <CopyButton text={o.edited} label="Copy" onCopied={markContacted} disabled={/\[[^\]]+\]/.test(o.edited)} />
            <Button size="sm" variant="outline" onClick={() => saveToLibrary(o)}>
              Save to library
            </Button>
          </div>
          {/\[[^\]]+\]/.test(o.edited) && <p className="text-xs text-muted-foreground">Copy unlocks once the [placeholders] are filled in.</p>}
        </Card>
      ))}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Saved replies</h2>
        {saved.length > 3 && <Input aria-label="Search saved replies" placeholder="Search" value={filter} onChange={(e) => setFilter(e.target.value)} />}
        {saved.length === 0 && <CardDescription>Save good replies here so you can answer common questions in one tap.</CardDescription>}
        {shown.map((s) => (
          <Card key={s.id} className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{s.title}</p>
                {s.service && <p className="text-xs text-muted-foreground">{s.service}</p>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete saved reply"
                onClick={async () => {
                  if (!confirm("Delete this saved reply?")) return;
                  await fetch(`/api/saved-replies/${s.id}`, { method: "DELETE" });
                  router.refresh();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <p className="whitespace-pre-wrap text-sm">{s.body}</p>
            <CopyButton
              text={s.body}
              label="Copy"
              onCopied={() => {
                markContacted();
                fetch(`/api/saved-replies/${s.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ used: true }) });
              }}
            />
          </Card>
        ))}
      </section>
    </div>
  );
}
