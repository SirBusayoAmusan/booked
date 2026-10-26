import { randomCode, slugify } from "@/lib/utils";
import { error, json, routeAuth } from "@/lib/api";
import { getAccess } from "@/lib/billing/access";

// Creates the owner's business (one per account on current plans).
export async function POST() {
  const auth = await routeAuth();
  if (!auth.ok) return auth.res;
  const { supabase, user, profile } = auth;

  const { data: existing } = await supabase.from("businesses").select("id").eq("owner_id", user.id);
  const limit = getAccess(profile).plan.limits.businesses;
  if (existing && existing.length >= limit) {
    if (existing.length > 0) return json({ id: existing[0].id });
    return error("Your plan allows one business.", 403);
  }

  for (let i = 0; i < 5; i++) {
    const slug = `${slugify(user.email?.split("@")[0] ?? "business") || "business"}-${randomCode(4)}`;
    const { data, error: err } = await supabase.from("businesses").insert({ owner_id: user.id, slug }).select("id").single();
    if (data) return json({ id: data.id }, 201);
    if (err && !String(err.message).includes("duplicate")) return error("Couldn't create your business.", 500);
  }
  return error("Couldn't create your business.", 500);
}
