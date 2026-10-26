import { z } from "zod";
import { aiErrorResponse, error, json, parseBody, routeAuth } from "@/lib/api";
import { draftReviewRequest } from "@/lib/ai/reply-fns";
import { assertCanRun } from "@/lib/limits";
import { reviewLinkFor, reviewTemplates } from "@/lib/reviews";

export const maxDuration = 60;

const Body = z.object({
  businessId: z.string().uuid(),
  enquiryId: z.string().uuid().nullable().optional(),
  firstName: z.string().trim().min(1).max(40),
  service: z.string().max(120).nullable().optional(),
  useAi: z.boolean().default(true),
});

// Drafts a review request for a real customer. The owner sends it.
export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return error("Add the customer's first name.");
  const auth = await routeAuth(body.businessId);
  if (!auth.ok) return auth.res;
  const link = reviewLinkFor(auth.business);
  if (!link) return error("Add your review link first.", 409);

  try {
    await assertCanRun(auth.supabase, auth.profile, "review_request", body.businessId);
    let enquiryId: string | null = null;
    if (body.enquiryId) {
      const { data } = await auth.supabase.from("enquiries").select("id").eq("id", body.enquiryId).eq("business_id", body.businessId).maybeSingle();
      enquiryId = data?.id ?? null;
    }
    const options = body.useAi
      ? (
          await draftReviewRequest({ business: auth.business, userId: auth.user.id, firstName: body.firstName, service: body.service ?? null, reviewUrl: link.url }).catch(() => null)
        )?.options ?? reviewTemplates(body.firstName, auth.business.name, link.url)
      : reviewTemplates(body.firstName, auth.business.name, link.url);

    const { data: row, error: err } = await auth.supabase
      .from("review_requests")
      .insert({
        business_id: body.businessId,
        enquiry_id: enquiryId,
        customer_first_name: body.firstName,
        channel: "sms",
        message_used: options[0]?.text ?? null,
        status: "drafted",
      })
      .select("*")
      .single();
    if (err) return error("Couldn't save.", 500);
    return json({ request: row, options });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
