import { z } from "zod";
import { error, json, parseBody, routeAuth } from "@/lib/api";
import { FOUND_VIA } from "@/lib/enquiries";

const Body = z.object({
  businessId: z.string().uuid(),
  name: z.string().trim().max(80).optional().nullable(),
  contact: z.string().trim().max(120).optional().nullable(),
  service: z.string().trim().max(120).optional().nullable(),
  message: z.string().trim().max(2000).optional().nullable(),
  found_via: z.enum(FOUND_VIA.map((f) => f.id) as [string, ...string[]]),
  post_id: z.string().uuid().optional().nullable(),
  code_word: z.string().max(20).optional().nullable(),
  status: z.enum(["new", "contacted", "booked", "completed"]).default("new"),
  value: z.number().min(0).max(1_000_000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// Quick Log: add a DM, call or walk-in enquiry in about 10 seconds.
export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return error("Invalid input.");
  const auth = await routeAuth(body.businessId);
  if (!auth.ok) return auth.res;

  let postId: string | null = null;
  if (body.code_word) {
    const { data } = await auth.supabase
      .from("posts")
      .select("id")
      .eq("business_id", body.businessId)
      .ilike("promo_code_word", body.code_word.replace(/[%_]/g, ""))
      .maybeSingle();
    postId = data?.id ?? null;
  } else if (body.post_id) {
    const { data } = await auth.supabase.from("posts").select("id").eq("business_id", body.businessId).eq("id", body.post_id).maybeSingle();
    postId = data?.id ?? null;
  }

  const now = new Date().toISOString();
  const label = FOUND_VIA.find((f) => f.id === body.found_via)?.label ?? body.found_via;
  const { data, error: err } = await auth.supabase
    .from("enquiries")
    .insert({
      business_id: body.businessId,
      post_id: postId,
      source: postId ? "code_word" : "manual",
      source_note: body.code_word ? `${label}: ${body.code_word.toUpperCase()}` : label,
      name: body.name || null,
      contact: body.contact || null,
      service_requested: body.service || null,
      message: body.message || null,
      status: body.status,
      value_usd: body.value ?? null,
      notes: body.notes || null,
      // Logged by the owner, who is already talking to them.
      first_contacted_at: body.status === "new" ? null : now,
      booked_at: body.status === "booked" || body.status === "completed" ? now : null,
      completed_at: body.status === "completed" ? now : null,
      consent_to_contact: false,
    })
    .select("*")
    .single();
  if (err) return error("Couldn't save.", 500);
  return json({ enquiry: data }, 201);
}
