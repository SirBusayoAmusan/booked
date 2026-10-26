import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Business, Profile } from "@/lib/types";

// Businesses whose owners have a live subscription, with the owner profile.
export async function activeBusinesses() {
  const admin = createAdminClient();
  const { data: profiles } = await admin.from("profiles").select("*").in("subscription_status", ["trialing", "active", "past_due"]);
  const byUser = new Map((profiles ?? []).map((p) => [p.user_id as string, p as Profile]));
  if (byUser.size === 0) return [];
  const { data: businesses } = await admin.from("businesses").select("*").in("owner_id", [...byUser.keys()]).not("onboarding_completed_at", "is", null);
  return (businesses ?? []).map((b) => ({ business: b as Business, profile: byUser.get(b.owner_id)! }));
}

// Once-only guard (per key, per window) built on the rate limiter.
export async function once(key: string, windowSeconds: number) {
  const { data } = await createAdminClient().rpc("hit_rate_limit", { p_key: `once:${key}`, p_window_seconds: windowSeconds, p_max: 1 });
  return data === true;
}
