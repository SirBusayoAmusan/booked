import { NextResponse } from "next/server";
import { routeAuth } from "@/lib/api";
import { getBillingProvider } from "@/lib/billing";

// Sends the owner to the provider's page to update their card, see receipts
// or cancel.
export async function GET(request: Request) {
  const auth = await routeAuth();
  if (!auth.ok) return NextResponse.redirect(new URL("/login?next=/settings", request.url));
  const url = await getBillingProvider()
    .getManageUrl(auth.user.id)
    .catch(() => null);
  return NextResponse.redirect(url ?? new URL("/settings?billing_error=No%20subscription%20found#billing", request.url));
}
