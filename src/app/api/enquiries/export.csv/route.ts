import { error, routeAuth } from "@/lib/api";
import { SOURCE_LABEL, csvEscape } from "@/lib/enquiries";

// Enquiry data belongs to the owner: full CSV export.
export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId");
  if (!businessId || !/^[0-9a-f-]{36}$/i.test(businessId)) return error("Missing businessId.");
  const auth = await routeAuth(businessId);
  if (!auth.ok) return auth.res;
  const { data } = await auth.supabase
    .from("enquiries")
    .select("created_at, name, contact, service_requested, message, status, value_usd, source, source_note, notes, first_contacted_at, booked_at, completed_at, consent_to_contact, posts(publish_date, platform, hook, promo_code_word)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  const header = ["created_at", "name", "contact", "service", "message", "status", `value_${auth.business.currency}`, "source", "source_note", "post_date", "post_platform", "post_hook", "code_word", "notes", "first_contacted_at", "booked_at", "completed_at", "consent_to_contact"];
  const rows = (data ?? []).map((e) => {
    const p = e.posts as unknown as { publish_date: string; platform: string; hook: string; promo_code_word: string | null } | null;
    return [e.created_at, e.name, e.contact, e.service_requested, e.message, e.status, e.value_usd, SOURCE_LABEL[e.source] ?? e.source, e.source_note, p?.publish_date, p?.platform, p?.hook, p?.promo_code_word, e.notes, e.first_contacted_at, e.booked_at, e.completed_at, e.consent_to_contact];
  });
  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
  return new Response("﻿" + csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="booked-enquiries-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
