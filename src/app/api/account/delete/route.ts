import { z } from "zod";
import { error, json, parseBody, routeAuth } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingProvider } from "@/lib/billing";

const Body = z.object({ confirm: z.literal("DELETE") });

// Deletes the account and all its data (cascades from auth.users). Cancels
// the subscription at period end first so the owner isn't charged again.
export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return error("Type DELETE to confirm.");
  const auth = await routeAuth();
  if (!auth.ok) return auth.res;
  if (["trialing", "active", "past_due", "paused"].includes(auth.profile.subscription_status)) {
    try {
      await getBillingProvider().cancelOrPause(auth.user.id, "cancel");
    } catch (e) {
      console.error("Cancel before delete failed", e);
      return error("We couldn't cancel your subscription automatically. Cancel it from Manage billing first, then delete your account.", 502);
    }
  }
  await auth.supabase.auth.signOut();
  const { error: err } = await createAdminClient().auth.admin.deleteUser(auth.user.id);
  if (err) return error("Couldn't delete the account. Contact support.", 500);
  return json({ ok: true });
}
