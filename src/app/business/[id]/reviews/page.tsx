import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth";
import { getAccess } from "@/lib/billing/access";
import { REVIEW_PLATFORMS } from "@/lib/config/locale";
import { reviewLinkFor } from "@/lib/reviews";
import { addDays, todayIn } from "@/lib/utils";
import type { ReviewRequest } from "@/lib/types";
import { CHECKLIST_DISCLAIMER, GET_FOUND_CHECKLIST } from "@/lib/config/checklist";
import { GetFoundCard } from "@/components/get-found-card";
import { ReviewKit } from "./kit";

export const metadata: Metadata = { title: "Review Kit" };

export default async function ReviewsPage(props: PageProps<"/business/[id]/reviews">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const { supabase, business, profile } = await requireBusiness(id);
  const access = getAccess(profile);
  const link = reviewLinkFor(business);
  const since = addDays(todayIn(business.timezone), -30);

  const [{ data: requests }, { data: completed }] = await Promise.all([
    supabase.from("review_requests").select("*").eq("business_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("enquiries").select("id, name, service_requested, completed_at").eq("business_id", id).eq("status", "completed").gte("completed_at", since).order("completed_at", { ascending: false }),
  ]);
  const reqs = (requests ?? []) as ReviewRequest[];
  const asked = new Set(reqs.map((r) => r.enquiry_id).filter(Boolean));
  const jobs = (completed ?? []).filter((e) => !asked.has(e.id));
  const monthStart = todayIn(business.timezone).slice(0, 8) + "01";
  const thisMonth = reqs.filter((r) => r.created_at >= monthStart).length;

  const setupItems = !link
    ? GET_FOUND_CHECKLIST.filter((i) => (business.presence?.google_business ? i.id === "review_link" : i.id === "claim_gbp")).map((i) => ({
        id: i.id,
        title: i.title,
        why_it_matters: i.why_it_matters,
        time_estimate_minutes: i.time_estimate_minutes,
        notes: i.notes,
      }))
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Review Kit</h1>
        <p className="text-sm text-muted-foreground">Ask every real customer for an honest review. No rewards, no star-rating hints, and no picking only the happy ones.</p>
      </div>
      {!link && <GetFoundCard businessId={id} items={setupItems} disclaimer={CHECKLIST_DISCLAIMER} />}
      <ReviewKit
        businessId={id}
        businessName={business.name}
        link={link}
        googleUrl={business.google_review_url ?? ""}
        otherPlatforms={business.review_platforms.filter((p) => p.platform !== "google")}
        platformOptions={REVIEW_PLATFORMS[business.country].filter((p) => p.id !== "google")}
        hasFacebook={Boolean(business.presence?.facebook)}
        requests={reqs}
        jobs={jobs.map((j) => ({ id: j.id, name: j.name, service: j.service_requested }))}
        services={(business.services ?? []).map((s) => s.name)}
        canAi={access.canGenerate}
        limit={access.plan.limits.review_requests_per_month}
        usedThisMonth={thisMonth}
        prefillEnquiry={typeof sp.enquiry === "string" ? sp.enquiry : null}
      />
    </div>
  );
}
