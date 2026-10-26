import { z } from "zod";
import { error, json, parseBody, routeAuth } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({
  status: z.enum(["drafted", "sent_by_owner", "reviewed_self_reported", "ignored"]).optional(),
  channel: z.enum(["sms", "whatsapp", "email", "in_person_qr"]).optional(),
  message_used: z.string().max(1000).optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/review-requests/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: rr } = await supabase.from("review_requests").select("id, business_id, sent_at").eq("id", id).maybeSingle();
  if (!rr) return error("Not found.", 404);
  const auth = await routeAuth(rr.business_id);
  if (!auth.ok) return auth.res;
  const body = await parseBody(request, Body);
  if (!body) return error("Invalid input.");
  const patch: Record<string, unknown> = { ...body };
  if (body.status === "sent_by_owner" && !rr.sent_at) patch.sent_at = new Date().toISOString();
  await auth.supabase.from("review_requests").update(patch).eq("id", id);
  return json({ ok: true });
}
