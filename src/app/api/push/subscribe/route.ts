import { z } from "zod";
import { error, json, parseBody, routeAuth } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

const Body = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return error("Invalid subscription.");
  const auth = await routeAuth();
  if (!auth.ok) return auth.res;
  // Endpoint is unique; re-subscribing on a shared device moves it to this user.
  const { error: err } = await createAdminClient()
    .from("push_subscriptions")
    .upsert({ user_id: auth.user.id, endpoint: body.endpoint, keys: body.keys }, { onConflict: "endpoint" });
  if (err) return error("Couldn't save.", 500);
  await auth.supabase
    .from("profiles")
    .update({ notification_prefs: { ...auth.profile.notification_prefs, push_enabled: true } })
    .eq("user_id", auth.user.id);
  return json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await routeAuth();
  if (!auth.ok) return auth.res;
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  let q = auth.supabase.from("push_subscriptions").delete().eq("user_id", auth.user.id);
  if (endpoint) q = q.eq("endpoint", endpoint);
  await q;
  return json({ ok: true });
}
