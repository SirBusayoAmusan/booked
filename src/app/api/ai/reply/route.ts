import { z } from "zod";
import { aiErrorResponse, error, json, parseBody, routeAuth } from "@/lib/api";
import { draftReply } from "@/lib/ai/reply-fns";
import { assertCanRun, hasFeature } from "@/lib/limits";

export const maxDuration = 60;

const Body = z.object({
  businessId: z.string().uuid(),
  message: z.string().trim().min(2).max(2000),
  service: z.string().max(120).nullable().optional(),
});

export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return error("Paste the customer's message first.");
  const auth = await routeAuth(body.businessId);
  if (!auth.ok) return auth.res;
  try {
    await assertCanRun(auth.supabase, auth.profile, "reply", body.businessId);
    const [{ data: saved }, { data: examples }] = await Promise.all([
      auth.supabase.from("saved_replies").select("title, service, body").eq("business_id", body.businessId).order("uses", { ascending: false }).limit(20),
      hasFeature(auth.profile, "voice_learning")
        ? auth.supabase.from("style_examples").select("before, after").eq("business_id", body.businessId).eq("kind", "reply").order("created_at", { ascending: false }).limit(5)
        : Promise.resolve({ data: [] }),
    ]);
    const out = await draftReply({
      business: auth.business,
      userId: auth.user.id,
      message: body.message,
      service: body.service ?? null,
      savedReplies: saved ?? [],
      styleExamples: (examples ?? []) as { before: string; after: string }[],
    });
    return json(out);
  } catch (e) {
    return aiErrorResponse(e);
  }
}
