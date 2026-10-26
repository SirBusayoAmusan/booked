"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, Mail, MessageSquare, Phone, Plus, Sparkles } from "lucide-react";
import type { Enquiry, EnquiryStatus } from "@/lib/types";
import { FOUND_VIA, SOURCE_LABEL, STATUS_LABEL, contactKind, isOverdue } from "@/lib/enquiries";
import { formatMoney, type Locale } from "@/lib/config/locale";
import type { Currency } from "@/lib/config/plans";
import { cn, smsHref, telHref, whatsappHref } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Row = Enquiry & { posts: { hook: string; platform: string; publish_date: string } | null };
const TABS: EnquiryStatus[] = ["new", "contacted", "booked", "completed", "lost"];

export function EnquiryInbox(props: {
  businessId: string;
  businessName: string;
  currency: Currency;
  locale: Locale;
  enquiries: Row[];
  codeWords: { id: string; word: string; hook: string }[];
  recentPosts: { id: string; hook: string; platform: string; publish_date: string }[];
  services: string[];
  overdueHours: number;
  initialTab: string;
  openQuickLog: boolean;
}) {
  const [tab, setTab] = useState<EnquiryStatus>((TABS as string[]).includes(props.initialTab) ? (props.initialTab as EnquiryStatus) : "new");
  const [showLog, setShowLog] = useState(props.openQuickLog);
  const [now] = useState(() => Date.now());
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t, props.enquiries.filter((e) => e.status === t).length])), [props.enquiries]);
  const list = props.enquiries.filter((e) => e.status === tab);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Enquiries</h1>
        <Button size="sm" onClick={() => setShowLog((s) => !s)}>
          <Plus className="h-4 w-4" /> Quick Log
        </Button>
      </div>

      {showLog && <QuickLog {...props} onDone={() => setShowLog(false)} />}

      <p className="text-xs text-muted-foreground">
        Numbers here are <strong>tracked</strong>, not total. Many enquiries come by DM, call or in person, so use Quick Log to add them. It takes 10 seconds.
      </p>

      <div className="flex gap-1 overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("min-h-11 whitespace-nowrap rounded-full border border-border px-3 text-sm", tab === t && "bg-secondary font-semibold")}
          >
            {STATUS_LABEL[t]} {counts[t] ? `(${counts[t]})` : ""}
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <Card>
          <CardDescription>
            {tab === "new" ? "No new enquiries. When someone fills in your page's form, or you log one, it shows here." : `Nothing in ${STATUS_LABEL[tab].toLowerCase()}.`}
          </CardDescription>
        </Card>
      )}
      <ul className="flex flex-col gap-3">
        {list.map((e) => (
          <EnquiryCard key={e.id} e={e} {...props} overdue={isOverdue(e, props.overdueHours, now)} />
        ))}
      </ul>

      <a href={`/api/enquiries/export.csv?businessId=${props.businessId}`} className="text-center text-sm text-muted-foreground underline">
        Export all enquiries (CSV)
      </a>
    </div>
  );
}

function EnquiryCard({ e, businessId, businessName, currency, locale, overdue }: { e: Row; overdue: boolean } & Parameters<typeof EnquiryInbox>[0]) {
  const router = useRouter();
  const [open, setOpen] = useState(e.status === "new");
  const [value, setValue] = useState(e.value_usd?.toString() ?? "");
  const [notes, setNotes] = useState(e.notes ?? "");
  const [busy, setBusy] = useState(false);
  const kind = contactKind(e.contact);
  const greeting = `Hi${e.name ? " " + e.name.split(" ")[0] : ""}, it's ${businessName}. Thanks for getting in touch`;

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/enquiries/${e.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    router.refresh();
  }

  const markContacted = () => (e.status === "new" ? patch({ contacted: true, status: "contacted" }) : undefined);

  return (
    <li>
      <Card className={cn("flex flex-col gap-2", overdue && "border-amber-500")}>
        <button className="flex items-start justify-between gap-2 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span>
            <span className="block font-semibold">{e.name || "Unnamed enquiry"}</span>
            <span className="block text-sm text-muted-foreground">{[e.service_requested, new Date(e.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })].filter(Boolean).join(" · ")}</span>
          </span>
          <span className="flex flex-col items-end gap-1">
            <Badge variant="outline">{SOURCE_LABEL[e.source] ?? e.source}</Badge>
            {overdue && (
              <Badge variant="warning">
                <Clock className="mr-1 h-3 w-3" /> Reply now
              </Badge>
            )}
            {e.value_usd !== null && <span className="text-sm font-semibold">{formatMoney(Number(e.value_usd), currency, locale)}</span>}
          </span>
        </button>
        {open && (
          <div className="flex flex-col gap-3 border-t border-border pt-3">
            {e.message && <p className="whitespace-pre-wrap text-sm">{e.message}</p>}
            {e.source_note && <p className="text-xs text-muted-foreground">How they found you: {e.source_note}</p>}
            {e.posts && <p className="text-xs text-muted-foreground">From post: {e.posts.hook}</p>}
            {e.contact && <p className="text-sm">{e.contact}</p>}
            <div className="flex flex-wrap gap-2">
              {kind === "phone" && e.contact && (
                <>
                  <a onClick={markContacted} href={telHref(e.contact)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold">
                    <Phone className="h-4 w-4" /> Call
                  </a>
                  <a onClick={markContacted} href={smsHref(e.contact, greeting)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold">
                    <MessageSquare className="h-4 w-4" /> Text
                  </a>
                  <a onClick={markContacted} href={whatsappHref(e.contact, greeting)} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-xl border border-border px-3 text-sm font-semibold">
                    WhatsApp
                  </a>
                </>
              )}
              {kind === "email" && e.contact && (
                <a onClick={markContacted} href={`mailto:${e.contact}?subject=${encodeURIComponent("Your enquiry")}&body=${encodeURIComponent(greeting)}`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold">
                  <Mail className="h-4 w-4" /> Email
                </a>
              )}
              <Link
                href={`/business/${businessId}/reply?enquiry=${e.id}`}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-secondary px-3 text-sm font-semibold"
              >
                <Sparkles className="h-4 w-4" /> Draft a reply
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {TABS.filter((t) => t !== e.status).map((t) => (
                <Button key={t} size="sm" variant={t === "booked" ? "default" : "outline"} disabled={busy} onClick={() => patch({ status: t })}>
                  {t === "new" ? "Back to new" : `Mark ${STATUS_LABEL[t].toLowerCase()}`}
                </Button>
              ))}
            </div>
            {(e.status === "booked" || e.status === "completed") && (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor={`v-${e.id}`}>Job value ({currency})</Label>
                  <Input id={`v-${e.id}`} type="number" inputMode="decimal" min={0} value={value} onChange={(ev) => setValue(ev.target.value)} />
                </div>
                <Button variant="outline" disabled={busy} onClick={() => patch({ value: value === "" ? null : Number(value) })}>
                  Save
                </Button>
              </div>
            )}
            {e.status === "booked" && e.value_usd === null && <p className="text-xs text-muted-foreground">Add the job value so your ROI card can show what Booked brought in.</p>}
            {e.status === "completed" && (
              <Link href={`/business/${businessId}/reviews?enquiry=${e.id}`} className="text-sm font-semibold text-primary underline">
                Ask for a review
              </Link>
            )}
            <Textarea aria-label="Notes" placeholder="Notes" value={notes} onChange={(ev) => setNotes(ev.target.value)} className="min-h-16" />
            {notes !== (e.notes ?? "") && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => patch({ notes })}>
                Save notes
              </Button>
            )}
          </div>
        )}
      </Card>
    </li>
  );
}

function QuickLog({ businessId, codeWords, recentPosts, services, currency, onDone }: Parameters<typeof EnquiryInbox>[0] & { onDone: () => void }) {
  const router = useRouter();
  const [foundVia, setFoundVia] = useState<string>("");
  const [codeWord, setCodeWord] = useState("");
  const [postId, setPostId] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [service, setService] = useState("");
  const [status, setStatus] = useState<"new" | "contacted" | "booked">("contacted");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/enquiries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        businessId,
        found_via: foundVia,
        code_word: foundVia === "code_word" ? codeWord || null : null,
        post_id: foundVia !== "code_word" && postId ? postId : null,
        name: name || null,
        contact: contact || null,
        service: service || null,
        status,
        value: status === "booked" && value ? Number(value) : null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? "Couldn't save.");
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>Quick Log</CardTitle>
      <p className="text-sm font-medium">How did they find you?</p>
      <div className="flex flex-wrap gap-2">
        {FOUND_VIA.map((f) => (
          <button
            key={f.id}
            onClick={() => setFoundVia(f.id)}
            className={cn("min-h-11 rounded-full border border-border px-3 text-sm", foundVia === f.id && "border-primary bg-primary/10 font-semibold")}
            aria-pressed={foundVia === f.id}
          >
            {f.label}
          </button>
        ))}
      </div>
      {foundVia === "code_word" && (
        <>
          <Label htmlFor="cw">Which code word?</Label>
          {codeWords.length > 0 ? (
            <Select id="cw" value={codeWord} onChange={(e) => setCodeWord(e.target.value)}>
              <option value="">Pick one</option>
              {codeWords.map((c) => (
                <option key={c.id} value={c.word}>
                  {c.word}
                </option>
              ))}
            </Select>
          ) : (
            <Input id="cw" value={codeWord} onChange={(e) => setCodeWord(e.target.value)} placeholder="The word they said" />
          )}
        </>
      )}
      {foundVia && foundVia !== "code_word" && recentPosts.length > 0 && ["instagram", "facebook", "tiktok", "google"].includes(foundVia) && (
        <>
          <Label htmlFor="post">Which post? (optional)</Label>
          <Select id="post" value={postId} onChange={(e) => setPostId(e.target.value)}>
            <option value="">Not sure</option>
            {recentPosts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.publish_date.slice(5)} · {p.hook.slice(0, 50)}
              </option>
            ))}
          </Select>
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Input aria-label="Name" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input aria-label="Phone or email" placeholder="Phone or email" value={contact} onChange={(e) => setContact(e.target.value)} />
      </div>
      {services.length > 0 && (
        <Select aria-label="Service" value={service} onChange={(e) => setService(e.target.value)}>
          <option value="">Service (optional)</option>
          {services.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      )}
      <div className="flex gap-2">
        {(["new", "contacted", "booked"] as const).map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)} aria-pressed={status === s}>
            {STATUS_LABEL[s]}
          </Button>
        ))}
      </div>
      {status === "booked" && <Input type="number" inputMode="decimal" aria-label={`Job value in ${currency}`} placeholder={`Job value (${currency})`} value={value} onChange={(e) => setValue(e.target.value)} />}
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex gap-2">
        <Button className="flex-1" disabled={!foundVia || busy} onClick={save}>
          Save
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
