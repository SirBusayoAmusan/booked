import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth";
import { getAccess } from "@/lib/billing/access";
import type { SavedReply } from "@/lib/types";
import { ReplyHelper } from "./helper";

export const metadata: Metadata = { title: "Reply Helper" };

export default async function ReplyPage(props: PageProps<"/business/[id]/reply">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const { supabase, business, profile } = await requireBusiness(id);
  const [{ data: saved }, enquiryRes] = await Promise.all([
    supabase.from("saved_replies").select("*").eq("business_id", id).order("uses", { ascending: false }),
    typeof sp.enquiry === "string" && /^[0-9a-f-]{36}$/.test(sp.enquiry)
      ? supabase.from("enquiries").select("id, message, service_requested, contact, name").eq("id", sp.enquiry).eq("business_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const enquiry = enquiryRes.data as { id: string; message: string | null; service_requested: string | null } | null;
  return (
    <ReplyHelper
      businessId={id}
      services={(business.services ?? []).map((s) => s.name).filter(Boolean)}
      saved={(saved ?? []) as SavedReply[]}
      canGenerate={getAccess(profile).canGenerate}
      initialMessage={enquiry?.message ?? ""}
      initialService={enquiry?.service_requested ?? ""}
      enquiryId={enquiry?.id ?? null}
    />
  );
}
