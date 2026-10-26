import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth";
import { appUrl } from "@/lib/utils";
import { PageSettings } from "./settings";

export const metadata: Metadata = { title: "Your public page" };

export default async function PublicPageSettings(props: PageProps<"/business/[id]/page">) {
  const { id } = await props.params;
  const { business } = await requireBusiness(id);
  return <PageSettings business={business} pageUrl={appUrl(`/b/${business.slug}`)} />;
}
