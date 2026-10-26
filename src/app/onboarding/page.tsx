import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { randomCode, slugify } from "@/lib/utils";
import type { Business } from "@/lib/types";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  const { supabase, user } = await requireUser("/onboarding");
  let { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!business) {
    const slug = `${slugify(user.email?.split("@")[0] ?? "business") || "business"}-${randomCode(4)}`;
    const { data } = await supabase.from("businesses").insert({ owner_id: user.id, slug }).select("*").single();
    business = data;
  }
  if (!business) throw new Error("Could not create business");
  if (business.onboarding_completed_at) redirect(`/business/${business.id}/positioning`);

  const b = business as Business;
  return <OnboardingWizard businessId={b.id} initialAnswers={b.onboarding_answers ?? {}} initialStep={b.onboarding_step ?? 0} />;
}
