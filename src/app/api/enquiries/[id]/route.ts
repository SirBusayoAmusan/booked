import { z } from "zod";
import { error, json, parseBody, routeAuth } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({
  status: z.enum(["new", "contacted", "booked", "completed", "lost"]).optional(),
  value: z.number().min(0).max(1_000_000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  name: z.string().max(80).nullable().optional(),
  contact: z.string().max(120).nullable().optional(),
  service_requested: z.string().max(120).nullable().optional(),
  contacted: z.literal(true).optional(),
});

async function load(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("enquiries").select("*").eq("id", id).maybeSingle();
  return data;
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/enquiries/[id]">) {
  const { id } = await ctx.params;
  const enquiry = await load(id);
  if (!enquiry) return error("Not found.", 404);
  const auth = await routeAuth(enquiry.business_id);
  if (!auth.ok) return auth.res;
  const body = await parseBody(request, Body);
  if (!body) return error("Invalid input.");

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  if (body.value !== undefined) patch.value_usd = body.value;
  for (const k of ["notes", "name", "contact", "service_requested"] as const) if (body[k] !== undefined) patch[k] = body[k];
  if (body.contacted && !enquiry.first_contacted_at) patch.first_contacted_at = now;
  if (body.status) {
    patch.status = body.status;
    if (body.status !== "new" && !enquiry.first_contacted_at) patch.first_contacted_at = now;
    if ((body.status === "booked" || body.status === "completed") && !enquiry.booked_at) patch.booked_at = now;
    if (body.status === "completed" && !enquiry.completed_at) patch.completed_at = now;
    if (body.status === "new" || body.status === "contacted" || body.status === "lost") {
      patch.booked_at = null;
      patch.completed_at = null;
    }
  }
  const { data, error: err } = await auth.supabase.from("enquiries").update(patch).eq("id", id).select("*").single();
  if (err) return error("Couldn't save.", 500);
  return json({ enquiry: data });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/enquiries/[id]">) {
  const { id } = await ctx.params;
  const enquiry = await load(id);
  if (!enquiry) return error("Not found.", 404);
  const auth = await routeAuth(enquiry.business_id);
  if (!auth.ok) return auth.res;
  await auth.supabase.from("enquiries").delete().eq("id", id);
  return json({ ok: true });
}
