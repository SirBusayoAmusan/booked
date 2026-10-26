import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAccess } from "@/lib/billing/access";
import { PLANS, TRIAL_DAYS } from "@/lib/config/plans";
import { formatDate, formatMoney } from "@/lib/config/locale";
import type { Business, Profile } from "@/lib/types";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = { title: "Settings" };

const STATUS_LABEL: Record<Profile["subscription_status"], string> = {
  none: "No plan yet",
  trialing: "Free trial",
  active: "Active",
  past_due: "Payment failed",
  paused: "Paused",
  canceled: "Ended",
};

export default async function SettingsPage(props: PageProps<"/settings">) {
  const sp = await props.searchParams;
  const { supabase, user } = await requireUser("/settings");
  const [{ data: profileData }, { data: bizData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    supabase.from("businesses").select("*").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle(),
  ]);
  const profile = profileData as Profile;
  const business = bizData as Business | null;
  const access = getAccess(profile);
  const currency = business?.currency ?? "USD";
  const locale = business?.locale ?? "en-US";
  const subscribed = ["trialing", "active", "past_due", "paused"].includes(profile.subscription_status);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Settings</h1>
        {business && (
          <Link href={`/business/${business.id}/today`} className="text-sm text-muted-foreground">
            Back to Today
          </Link>
        )}
      </div>

      {sp.checkout === "done" && (
        <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
          Thanks! Your plan is being set up. It can take a minute to show here.
          {business && (
            <>
              {" "}
              <Link className="font-semibold underline" href={`/business/${business.id}/calendar?generate=1`}>
                Build your calendar
              </Link>
            </>
          )}
        </p>
      )}
      {typeof sp.billing_error === "string" && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-900">{sp.billing_error}</p>}

      <section id="billing" className="flex flex-col gap-3">
        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <CardTitle>Plan and billing</CardTitle>
            <Badge variant={profile.subscription_status === "past_due" ? "danger" : "secondary"}>{STATUS_LABEL[profile.subscription_status]}</Badge>
          </div>
          {subscribed && (
            <CardDescription>
              {access.plan.name} plan.
              {profile.subscription_status === "trialing" && profile.trial_ends_at && ` Trial ends ${formatDate(profile.trial_ends_at, locale, { day: "numeric", month: "long" })}.`}
              {profile.current_period_end && profile.subscription_status === "active" && ` Renews ${formatDate(profile.current_period_end, locale, { day: "numeric", month: "long" })}.`}
            </CardDescription>
          )}
          {access.banner && profile.subscription_status !== "none" && <p className="text-sm">{access.banner.text}</p>}
        </Card>

        {!subscribed && (
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.values(PLANS).map((p) => (
              <Card key={p.id} className="flex flex-col gap-2">
                <CardTitle>{p.name}</CardTitle>
                <p className="text-2xl font-bold">
                  {formatMoney(p.prices[currency], currency, locale)}
                  <span className="text-sm font-normal text-muted-foreground"> / month</span>
                </p>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {p.includes.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
                <form action="/api/billing/checkout" method="post" className="mt-auto">
                  <input type="hidden" name="plan" value={p.id} />
                  <button className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground">Start {TRIAL_DAYS}-day free trial</button>
                </form>
              </Card>
            ))}
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Checkout is handled by Whop, our payments provider. Booked never sees or stores your card. Cancel any time. If the first charge isn&apos;t right for you, ask
              for a refund within 14 days, no questions asked. Prices shown are test prices and may include or exclude local tax depending on where you are.
            </p>
          </div>
        )}
      </section>

      <SettingsClient
        profile={profile}
        business={business}
        subscribed={subscribed}
        paused={profile.subscription_status === "paused"}
        vapidConfigured={Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)}
      />

      <form action="/auth/signout" method="post" className="mt-6 text-center">
        <button className="min-h-11 text-sm text-muted-foreground underline">Sign out</button>
      </form>
    </main>
  );
}
