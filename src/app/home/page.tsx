import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

// Entry point after sign-in and the PWA start_url: sends owners to their
// business, or to onboarding if they haven't finished it.
export default async function HomeRedirect() {
  const { supabase, user } = await requireUser("/home");
  const { data } = await supabase
    .from("businesses")
    .select("id, onboarding_completed_at, positioning_confirmed_at")
    .eq("owner_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!data || !data.onboarding_completed_at) redirect("/onboarding");
  if (!data.positioning_confirmed_at) redirect(`/business/${data.id}/positioning`);
  redirect(`/business/${data.id}/today`);
}
