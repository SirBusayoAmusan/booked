import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { error, json, routeAuth } from "@/lib/api";
import { BillingError, getBillingProvider } from "@/lib/billing";
import type { PlanId } from "@/lib/config/plans";

// Starts checkout for a plan. Accepts a form post (redirects) or JSON
// (returns the URL). Card details are only ever entered on the provider's page.
export async function POST(request: Request) {
  const isForm = (request.headers.get("content-type") ?? "").includes("form");
  let plan: string | null = null;
  try {
    plan = isForm ? String((await request.formData()).get("plan") ?? "") : (await request.json()).plan;
  } catch {
    plan = null;
  }
  if (plan !== "solo" && plan !== "growth") return error("Pick a plan.");
  const auth = await routeAuth();
  if (!auth.ok) return isForm ? NextResponse.redirect(new URL("/login?next=/settings", request.url), 303) : auth.res;

  if (auth.profile.subscription_status === "active" || auth.profile.subscription_status === "trialing") {
    const manage = await getBillingProvider().getManageUrl(auth.user.id).catch(() => null);
    if (manage) return isForm ? NextResponse.redirect(manage, 303) : json({ url: manage });
  }

  const { data: biz } = await auth.supabase.from("businesses").select("currency").eq("owner_id", auth.user.id).limit(1).maybeSingle();
  const affiliateCode = (await cookies()).get("booked_aff")?.value ?? null;
  try {
    const url = await getBillingProvider().createCheckout(auth.user.id, plan as PlanId, {
      email: auth.user.email ?? null,
      currency: biz?.currency ?? "USD",
      affiliateCode,
      returnPath: "/settings?checkout=done",
    });
    return isForm ? NextResponse.redirect(url, 303) : json({ url });
  } catch (e) {
    const msg = e instanceof BillingError ? e.userMessage : "Couldn't start checkout.";
    console.error(e);
    return isForm ? NextResponse.redirect(new URL(`/settings?billing_error=${encodeURIComponent(msg)}#billing`, request.url), 303) : error(msg, 502);
  }
}
