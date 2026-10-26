import { routeAuth } from "@/lib/api";

// Everything Booked stores for this owner, as one JSON file.
export async function GET() {
  const auth = await routeAuth();
  if (!auth.ok) return auth.res;
  const { supabase, user } = auth;
  const { data: businesses } = await supabase.from("businesses").select("*").eq("owner_id", user.id);
  const ids = (businesses ?? []).map((b) => b.id);
  const tables = ["calendars", "shoot_days", "posts", "enquiries", "saved_replies", "review_requests", "weekly_reviews", "style_examples", "link_clicks"] as const;
  const out: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    profile: { ...auth.profile, billing_customer_ref: undefined },
    businesses,
  };
  for (const t of tables) {
    const { data } = ids.length ? await supabase.from(t).select("*").in("business_id", ids) : { data: [] };
    out[t] = data ?? [];
  }
  return new Response(JSON.stringify(out, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="booked-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
