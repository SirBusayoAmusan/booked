"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function subscribeToPush() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
  const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
  return res.ok;
}

// Optional opt-in for push reminders (new enquiries, post days).
export function PushPrompt() {
  const [state, setState] = useState<"hidden" | "ask" | "done">("hidden");

  useEffect(() => {
    const supported = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
    let dismissed = false;
    try {
      dismissed = localStorage.getItem("booked-push-dismissed") === "1";
    } catch {}
    // Reading browser-only APIs has to happen after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supported && Notification.permission === "default" && !dismissed) setState("ask");
  }, []);

  if (state !== "ask") return null;
  return (
    <Card className="flex items-center gap-3">
      <Bell className="h-5 w-5 shrink-0 text-primary" aria-hidden />
      <CardDescription className="flex-1">Get a nudge on this phone when an enquiry is waiting.</CardDescription>
      <div className="flex flex-col gap-1">
        <Button size="sm" onClick={async () => setState((await subscribeToPush()) ? "done" : "hidden")}>
          Turn on
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            try {
              localStorage.setItem("booked-push-dismissed", "1");
            } catch {}
            setState("hidden");
          }}
        >
          Not now
        </Button>
      </div>
    </Card>
  );
}
