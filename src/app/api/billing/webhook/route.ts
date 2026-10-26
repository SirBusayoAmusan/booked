import { getBillingProvider } from "@/lib/billing";

// Webhook endpoint. The raw body is read as text so the signature can be
// verified on the exact bytes before anything is parsed.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers);
  const result = await getBillingProvider().handleWebhook(rawBody, headers);
  if (!result.ok) return new Response(result.message, { status: result.status });
  return Response.json({ received: true, duplicate: result.duplicate ?? false });
}
