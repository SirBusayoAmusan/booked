"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SafetyConfig } from "@/lib/safety/safety";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

export function SafetyRulesEditor({ initial }: { initial: SafetyConfig }) {
  const router = useRouter();
  const { version, last_verified, ...rules } = initial;
  const [text, setText] = useState(JSON.stringify(rules, null, 2));
  const [ver, setVer] = useState(version);
  const [verified, setVerified] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function publish() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setMsg("That isn't valid JSON.");
      return;
    }
    const res = await fetch("/api/admin/safety-rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: ver, last_verified: verified, notes, rules: parsed }),
    });
    setMsg(res.ok ? "Published. New checks use it straight away." : (await res.json().catch(() => ({}))).error ?? "Couldn't publish.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">Currently live: v{version}, verified {last_verified}.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <Label htmlFor="ver">New version</Label>
          <Input id="ver" value={ver} onChange={(e) => setVer(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="lv">Last verified</Label>
          <Input id="lv" type="date" value={verified} onChange={(e) => setVerified(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <Textarea aria-label="Rules JSON" value={text} onChange={(e) => setText(e.target.value)} className="min-h-96 font-mono text-xs" />
      <Button onClick={publish}>Publish rules</Button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
