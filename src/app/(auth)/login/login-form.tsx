"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
    setState(error ? "error" : "sent");
  }

  async function google() {
    await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
  }

  if (state === "sent") {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="font-semibold">Check your email</p>
        <p className="mt-1 text-sm text-muted-foreground">We sent a sign-in link to {email}. It works once.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={sendLink} className="flex flex-col gap-3">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Email me a sign-in link"}
        </Button>
        {state === "error" && <p className="text-sm text-destructive">Couldn&apos;t send the link. Check the address and try again.</p>}
      </form>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="outline" onClick={google}>
        Continue with Google
      </Button>
    </div>
  );
}
