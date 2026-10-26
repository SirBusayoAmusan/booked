import Link from "next/link";
import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth";
import { getAccess } from "@/lib/billing/access";
import { PositioningEditor } from "./editor";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Positioning and fact sheet" };

export default async function PositioningPage(props: PageProps<"/business/[id]/positioning">) {
  const { id } = await props.params;
  const { business, profile } = await requireBusiness(id);
  if (!business.fact_sheet || !business.positioning_summary) {
    return (
      <Card>
        <CardTitle>Not ready yet</CardTitle>
        <CardDescription>Finish onboarding to build your fact sheet and positioning.</CardDescription>
        <Link href="/onboarding" className="mt-3 inline-block font-semibold text-primary underline">
          Continue onboarding
        </Link>
      </Card>
    );
  }
  return (
    <PositioningEditor
      businessId={id}
      factSheet={business.fact_sheet}
      positioning={business.positioning_summary}
      confirmed={Boolean(business.positioning_confirmed_at)}
      canGenerate={getAccess(profile).canGenerate}
      hasCalendar={false}
    />
  );
}
