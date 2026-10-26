import { z } from "zod";
import { error, json, parseBody, routeAuth } from "@/lib/api";
import { FactSheetSchema, PositioningSchema } from "@/lib/ai/schemas";

const Body = z.object({ fact_sheet: FactSheetSchema, positioning: PositioningSchema });

// Owner confirms the (possibly edited) fact sheet and positioning. No
// calendar can be generated before this.
export async function POST(request: Request, ctx: RouteContext<"/api/business/[id]/confirm">) {
  const { id } = await ctx.params;
  const auth = await routeAuth(id);
  if (!auth.ok) return auth.res;
  const body = await parseBody(request, Body);
  if (!body) return error("Please check the fact sheet for missing fields.");
  const now = new Date().toISOString();
  const fs = body.fact_sheet;
  fs.services = fs.services.filter((s) => s.name.trim());
  const { error: err } = await auth.supabase
    .from("businesses")
    .update({
      fact_sheet: fs,
      services: fs.services,
      opening_hours: fs.opening_hours,
      service_area: fs.service_area,
      positioning_summary: body.positioning,
      fact_sheet_confirmed_at: now,
      positioning_confirmed_at: now,
    })
    .eq("id", id);
  if (err) return error("Couldn't save.", 500);
  return json({ ok: true });
}
