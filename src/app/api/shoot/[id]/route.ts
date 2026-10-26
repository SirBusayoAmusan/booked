import { z } from "zod";
import { error, json, parseBody, routeAuth } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({
  shot: z.string().regex(/^\d{1,2}:\d{1,2}$/).optional(),
  done: z.boolean().optional(),
  status: z.enum(["planned", "done", "skipped"]).optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/shoot/[id]">) {
  const { id } = await ctx.params;
  const body = await parseBody(request, Body);
  if (!body) return error("Invalid input.");
  const supabase = await createClient();
  const { data: sd } = await supabase.from("shoot_days").select("id, business_id, done_shots").eq("id", id).maybeSingle();
  if (!sd) return error("Not found.", 404);
  const auth = await routeAuth(sd.business_id);
  if (!auth.ok) return auth.res;

  const patch: Record<string, unknown> = {};
  if (body.shot) {
    const set = new Set<string>(sd.done_shots ?? []);
    if (body.done) set.add(body.shot);
    else set.delete(body.shot);
    patch.done_shots = Array.from(set);
  }
  if (body.status) patch.status = body.status;
  const { error: err } = await auth.supabase.from("shoot_days").update(patch).eq("id", id);
  if (err) return error("Couldn't save.", 500);
  return json({ ok: true });
}
