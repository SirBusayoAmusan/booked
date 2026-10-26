import { z } from "zod";
import { error, json, parseBody, routeAuth } from "@/lib/api";

const Body = z.object({ businessId: z.string().uuid(), confirm: z.literal("DELETE") });

// Deletes every enquiry (and the review requests and clicks tied to customers)
// for one business. Posts and plans are kept.
export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return error('Type DELETE to confirm.');
  const auth = await routeAuth(body.businessId);
  if (!auth.ok) return auth.res;
  await auth.supabase.from("review_requests").delete().eq("business_id", body.businessId);
  await auth.supabase.from("enquiries").delete().eq("business_id", body.businessId);
  return json({ ok: true });
}
