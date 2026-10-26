import { z } from "zod";
import { error, json, parseBody, routeAuth } from "@/lib/api";

const Body = z.object({
  businessId: z.string().uuid(),
  title: z.string().trim().min(1).max(80),
  service: z.string().max(120).nullable().optional(),
  body: z.string().trim().min(1).max(2000),
  // When saving an edited AI draft, the original draft feeds voice learning.
  draft: z.string().max(2000).nullable().optional(),
});

export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return error("Add a title and the reply text.");
  const auth = await routeAuth(body.businessId);
  if (!auth.ok) return auth.res;
  const { data, error: err } = await auth.supabase
    .from("saved_replies")
    .insert({ business_id: body.businessId, title: body.title, service: body.service || null, body: body.body })
    .select("*")
    .single();
  if (err) return error("Couldn't save.", 500);
  if (body.draft && body.draft.trim() !== body.body.trim()) {
    await auth.supabase.from("style_examples").insert({ business_id: body.businessId, kind: "reply", before: body.draft, after: body.body });
  }
  return json({ reply: data }, 201);
}
