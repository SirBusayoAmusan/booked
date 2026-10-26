import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth";
import { addDays, todayIn } from "@/lib/utils";
import type { Enquiry } from "@/lib/types";
import { EnquiryInbox } from "./inbox";

export const metadata: Metadata = { title: "Enquiries" };

export default async function EnquiriesPage(props: PageProps<"/business/[id]/enquiries">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const { supabase, business, profile } = await requireBusiness(id);
  const today = todayIn(business.timezone);

  const [{ data: enquiries }, { data: codePosts }, { data: recentPosts }] = await Promise.all([
    supabase.from("enquiries").select("*, posts(hook, platform, publish_date)").eq("business_id", id).order("created_at", { ascending: false }).limit(300),
    supabase.from("posts").select("id, promo_code_word, hook").eq("business_id", id).not("promo_code_word", "is", null).order("publish_date", { ascending: false }).limit(50),
    supabase.from("posts").select("id, hook, platform, publish_date").eq("business_id", id).gte("publish_date", addDays(today, -21)).lte("publish_date", today).order("publish_date", { ascending: false }).limit(30),
  ]);

  return (
    <EnquiryInbox
      businessId={id}
      businessName={business.name}
      currency={business.currency}
      locale={business.locale}
      enquiries={(enquiries ?? []) as (Enquiry & { posts: { hook: string; platform: string; publish_date: string } | null })[]}
      codeWords={(codePosts ?? []).map((p) => ({ id: p.id, word: p.promo_code_word as string, hook: p.hook as string }))}
      recentPosts={(recentPosts ?? []) as { id: string; hook: string; platform: string; publish_date: string }[]}
      services={(business.services ?? []).map((s) => s.name).filter(Boolean)}
      overdueHours={profile.notification_prefs?.overdue_hours ?? 2}
      initialTab={typeof sp.tab === "string" ? sp.tab : "new"}
      openQuickLog={sp.log === "1"}
    />
  );
}
