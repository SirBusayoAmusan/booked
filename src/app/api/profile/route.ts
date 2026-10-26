import { z } from "zod";
import { error, json, parseBody, routeAuth } from "@/lib/api";

const Body = z.object({
  notification_prefs: z
    .object({
      digest_email: z.boolean(),
      overdue_hours: z.number().int().min(0).max(48),
      post_day_push: z.boolean(),
      post_day_hour: z.number().int().min(5).max(21),
      push_enabled: z.boolean(),
    })
    .partial(),
});

export async function PATCH(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return error("Invalid input.");
  const auth = await routeAuth();
  if (!auth.ok) return auth.res;
  const prefs = { ...auth.profile.notification_prefs, ...body.notification_prefs };
  const { error: err } = await auth.supabase.from("profiles").update({ notification_prefs: prefs }).eq("user_id", auth.user.id);
  if (err) return error("Couldn't save.", 500);
  if (body.notification_prefs.push_enabled === false) await auth.supabase.from("push_subscriptions").delete().eq("user_id", auth.user.id);
  return json({ ok: true, notification_prefs: prefs });
}
