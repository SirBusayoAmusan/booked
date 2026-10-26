"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import type { Post, SafetyFinding } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { CopyButton } from "@/components/copy-button";
import { PlatformBadge, SafetyBadge, StatusBadge } from "@/components/post-badges";

const confirmKey = (ruleId: string, match: string) => `${ruleId}:${match.toLowerCase().replace(/\s+/g, " ").trim()}`;

export function PostEditor({
  post: initial,
  trackedLink,
  canGenerate,
  disclaimer,
  stats,
  shootHref,
}: {
  post: Post;
  trackedLink: string;
  canGenerate: boolean;
  disclaimer: string;
  stats: { clicks: number; enquiries: number };
  shootHref: string | null;
}) {
  const router = useRouter();
  const [post, setPost] = useState(initial);
  const [hook, setHook] = useState(initial.hook ?? "");
  const [caption, setCaption] = useState(initial.caption);
  const [hashtags, setHashtags] = useState(initial.hashtags.join(" "));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [live, setLive] = useState<{ status: Post["safety_status"]; findings: SafetyFinding[] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = hook !== (post.hook ?? "") || caption !== post.caption || hashtags !== post.hashtags.join(" ");

  // Live safety lint while editing.
  useEffect(() => {
    if (!dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await fetch("/api/safety/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessId: post.business_id,
          platform: post.platform,
          hook,
          caption,
          hashtags: hashtags.split(/\s+/).filter(Boolean),
          on_screen_text: post.on_screen_text,
          shot_list: post.shot_list,
          needs_owner_confirmation: post.needs_owner_confirmation,
          confirmed_items: post.confirmed_items,
        }),
      }).catch(() => null);
      if (res?.ok) setLive(await res.json());
    }, 600);
  }, [hook, caption, hashtags, dirty, post]);

  async function patch(body: Record<string, unknown>, okMsg?: string) {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/posts/${post.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (data.post) {
      setPost(data.post);
      setHook(data.post.hook ?? "");
      setCaption(data.post.caption);
      setHashtags(data.post.hashtags.join(" "));
    }
    if (!res.ok) setMsg(data.error ?? "Couldn't save.");
    else if (okMsg) setMsg(okMsg);
    router.refresh();
  }

  const save = () => patch({ hook, caption, hashtags: hashtags.split(/\s+/).filter(Boolean) }, "Saved. Your edits help Booked learn your voice.");

  async function regenerate(instr: string) {
    setRegenerating(true);
    setMsg(null);
    const res = await fetch("/api/ai/post/regenerate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId: post.id, instruction: instr || null }),
    });
    const data = await res.json().catch(() => ({}));
    setRegenerating(false);
    if (data.post) {
      setPost(data.post);
      setHook(data.post.hook ?? "");
      setCaption(data.post.caption);
      setHashtags(data.post.hashtags.join(" "));
      setInstruction("");
    } else setMsg(data.error ?? "Couldn't regenerate.");
    router.refresh();
  }

  const safety = dirty && live ? live : { status: post.safety_status, findings: post.safety_findings };
  const fullText = [hook, caption, post.platform !== "google_business" ? hashtags : ""].filter(Boolean).join("\n\n");
  const blocked = safety.status === "blocked";
  const confirmFindings = safety.findings.filter((f) => f.rule_id === "unconfirmed_price_or_offer" || f.rule_id === "fake_urgency");
  const otherFindings = safety.findings.filter((f) => !confirmFindings.includes(f));
  const linkNote =
    post.platform === "instagram"
      ? "Instagram captions can't hold clickable links. Put this link in your bio or on a story link sticker, and use the code word in the caption."
      : post.platform === "tiktok"
        ? "Put this link in your bio. Use the code word in the caption."
        : "Paste this link in the post so you can see who tapped it.";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <PlatformBadge platform={post.platform} />
        <StatusBadge status={post.status} />
        <SafetyBadge status={safety.status} />
      </div>

      <Card className="flex flex-col gap-3">
        <Label htmlFor="hook">Hook (first line)</Label>
        <Input id="hook" value={hook} onChange={(e) => setHook(e.target.value)} />
        <Label htmlFor="caption">Caption</Label>
        <Textarea id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} className="min-h-48" />
        {post.platform !== "google_business" && (
          <>
            <Label htmlFor="tags">Hashtags</Label>
            <Input id="tags" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <CopyButton text={fullText} label="Copy post" />
          <CopyButton text={caption} label="Copy caption" />
          {post.platform !== "google_business" && hashtags && <CopyButton text={hashtags} label="Copy hashtags" />}
          {dirty && (
            <Button size="sm" onClick={save} disabled={saving}>
              Save edits
            </Button>
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {blocked ? <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden /> : <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden />}
          <CardTitle>Safety check</CardTitle>
        </div>
        {safety.findings.length === 0 && <CardDescription>No issues found.</CardDescription>}
        {confirmFindings.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Confirm before posting</p>
            {confirmFindings.map((f) => (
              <div key={f.rule_id + f.match} className="flex items-start justify-between gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
                <span>{f.message}</span>
                {f.match && !f.message.includes("isn't a price in your fact sheet") && (
                  <Button size="sm" variant="outline" disabled={saving || dirty} onClick={() => patch({ confirm: confirmKey(f.rule_id, f.match!) })}>
                    It&apos;s correct
                  </Button>
                )}
              </div>
            ))}
            {dirty && <p className="text-xs text-muted-foreground">Save your edits first, then confirm.</p>}
          </div>
        )}
        {otherFindings.map((f) => (
          <div
            key={f.rule_id + f.match}
            className={f.severity === "high" ? "rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100" : "rounded-xl bg-secondary p-3 text-sm"}
          >
            <p>{f.message}</p>
            {f.match && <p className="mt-1 text-xs opacity-80">Found: &ldquo;{f.match}&rdquo;</p>}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">{disclaimer}</p>
      </Card>

      {(post.on_screen_text.length > 0 || post.shot_list.length > 0 || post.asset_needed) && (
        <Card className="flex flex-col gap-2 text-sm">
          {post.shot_list.length > 0 ? (
            <>
              <CardTitle>Shot list</CardTitle>
              <ul className="list-disc pl-5">
                {post.shot_list.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="font-medium">No filming needed for this one.</p>
          )}
          {post.on_screen_text.length > 0 && (
            <>
              <p className="mt-2 font-medium">On-screen text</p>
              <ul className="list-disc pl-5">
                {post.on_screen_text.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          )}
          {post.asset_needed && <p className="mt-2 text-muted-foreground">You&apos;ll need: {post.asset_needed}</p>}
          {shootHref && (
            <a href={shootHref} className="mt-1 font-semibold text-primary underline">
              Film this on your Shoot Day
            </a>
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-2">
        <CardTitle>Tracking</CardTitle>
        <p className="break-all text-sm">{trackedLink}</p>
        <CardDescription>{linkNote}</CardDescription>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={trackedLink} label="Copy tracked link" />
        </div>
        {post.promo_code_word && (
          <p className="text-sm">
            Code word: <span className="font-mono font-semibold">{post.promo_code_word}</span>. Ask people to mention it when they message or call.
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {stats.clicks} tracked click{stats.clicks === 1 ? "" : "s"} · {stats.enquiries} tracked enquir{stats.enquiries === 1 ? "y" : "ies"}. Many enquiries come by DM or call, so log those too.
        </p>
      </Card>

      <Card className="flex flex-col gap-2">
        <CardTitle>Try another version</CardTitle>
        <div className="flex flex-wrap gap-2">
          {["Shorter", "Different angle", "More casual"].map((s) => (
            <Button key={s} size="sm" variant="outline" disabled={!canGenerate || regenerating || post.status === "posted"} onClick={() => regenerate(s)}>
              {s}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input aria-label="Your instruction" placeholder="Or say what to change" value={instruction} onChange={(e) => setInstruction(e.target.value)} />
          <Button variant="outline" disabled={!canGenerate || regenerating || !instruction.trim() || post.status === "posted"} onClick={() => regenerate(instruction)} aria-label="Regenerate">
            <RefreshCw className={regenerating ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>
      </Card>

      {msg && (
        <p className="text-sm" role="status">
          {msg}
        </p>
      )}

      <div className="sticky bottom-20 flex gap-2 rounded-2xl border border-border bg-background/95 p-2 backdrop-blur">
        {post.status !== "posted" ? (
          <>
            {post.status !== "ready" && (
              <Button variant="outline" className="flex-1" disabled={blocked || saving || dirty} onClick={() => patch({ status: "ready" }, "Marked ready.")}>
                Mark ready
              </Button>
            )}
            <Button className="flex-1" disabled={blocked || saving || dirty} onClick={() => patch({ status: "posted" }, "Nice work. Marked as posted.")}>
              I posted it
            </Button>
            <Button variant="ghost" disabled={saving} onClick={() => patch({ status: "skipped" })}>
              Skip
            </Button>
          </>
        ) : (
          <Button variant="outline" className="flex-1" onClick={() => patch({ status: "ready" })}>
            Undo posted
          </Button>
        )}
      </div>
      {blocked && <p className="-mt-2 text-center text-xs text-destructive">Fix the red items above before marking this ready.</p>}
    </div>
  );
}
