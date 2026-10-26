import { z } from "zod";
import { error, json, parseBody, routeAuth } from "@/lib/api";
import { GET_FOUND_CHECKLIST } from "@/lib/config/checklist";

const Body = z.object({
  item: z.enum(GET_FOUND_CHECKLIST.map((i) => i.id) as [string, ...string[]]),
  status: z.enum(["done", "todo", "hidden"]),
});

export async function POST(request: Request, ctx: RouteContext<"/api/business/[id]/checklist">) {
  const { id } = await ctx.params;
  const auth = await routeAuth(id);
  if (!auth.ok) return auth.res;
  const body = await parseBody(request, Body);
  if (!body) return error("Invalid input.");
  const state = auth.business.setup_checklist_state ?? {};
  const next = { ...state, status: { ...(state.status ?? {}), [body.item]: body.status } };
  const patch: Record<string, unknown> = { setup_checklist_state: next };
  if (body.item === "claim_gbp" && body.status === "done") patch.presence = { ...auth.business.presence, google_business: true };
  if (body.item === "facebook_page" && body.status === "done") patch.presence = { ...auth.business.presence, facebook: true };
  const { error: err } = await auth.supabase.from("businesses").update(patch).eq("id", id);
  if (err) return error("Couldn't save.", 500);
  return json({ ok: true });
}
