import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlan, type Currency } from "@/lib/config/plans";
import type { Business, Profile } from "@/lib/types";

export type Roi = { bookings: number; revenue: number; planPrice: number; currency: Currency; bookingsWithoutValue: number };

// Logged bookings and revenue vs plan price. "Logged" because Booked only
// knows what the owner records; it never claims exact attribution.
export async function computeRoi(supabase: SupabaseClient, business: Business, profile: Pick<Profile, "plan_id">, fromIso: string, toIso: string): Promise<Roi> {
  const { data } = await supabase
    .from("enquiries")
    .select("value_usd")
    .eq("business_id", business.id)
    .in("status", ["booked", "completed"])
    .gte("booked_at", fromIso)
    .lt("booked_at", toIso);
  const rows = data ?? [];
  return {
    bookings: rows.length,
    revenue: rows.reduce((s, r) => s + Number(r.value_usd ?? 0), 0),
    bookingsWithoutValue: rows.filter((r) => r.value_usd === null).length,
    planPrice: getPlan(profile.plan_id).prices[business.currency],
    currency: business.currency,
  };
}
