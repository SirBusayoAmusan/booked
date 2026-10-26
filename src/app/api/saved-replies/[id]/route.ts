import { z } from "zod";
import { error, json, parseBody, routeAuth } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  body: z.string().trim().min(1).max(2000).optional(),
  service: z.string().max(120).nullable().optional(),
  used: z.literal(true).optional(),
});

async function owner(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("saved_replies").select("id, business_id, uses").eq("id", id).maybeSingle();
  if (!data) return null;
  const auth = await routeAuth(data.business_id);
  return auth.ok ? { auth, row: data } : null;
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/saved-replies/[id]">) {
  const { id } = await ctx.params;
  const o = await owner(id);
  if (!o) return error("Not found.", 404);
  const body = await parseBody(request, Body);
  if (!body) return error("Invalid input.");
  const { used, ...rest } = body;
  const patch: Record<string, unknown> = { ...rest };
  if (used) patch.uses = (o.row.uses ?? 0) + 1;
  await o.auth.supabase.from("saved_replies").update(patch).eq("id", id);
  return json({ ok: true });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/saved-replies/[id]">) {
  const { id } = await ctx.params;
  const o = await owner(id);
  if (!o) return error("Not found.", 404);
  await o.auth.supabase.from("saved_replies").delete().eq("id", id);
  return json({ ok: true });
}
