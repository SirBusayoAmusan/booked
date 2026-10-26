import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Business } from "@/lib/types";

export const PUBLIC_FIELDS =
  "id, owner_id, name, slug, trade, city, service_area, services, opening_hours, phone, whatsapp_number, booking_method, booking_tool, external_booking_url, public_page_published, public_page_noindex, public_photos, proof_assets, locale, currency, country, google_review_url, review_platforms, setup_checklist_state";

export type PublicBusiness = Pick<
  Business,
  | "id"
  | "owner_id"
  | "name"
  | "slug"
  | "trade"
  | "city"
  | "service_area"
  | "services"
  | "opening_hours"
  | "phone"
  | "whatsapp_number"
  | "booking_method"
  | "booking_tool"
  | "external_booking_url"
  | "public_page_published"
  | "public_page_noindex"
  | "public_photos"
  | "proof_assets"
  | "locale"
  | "currency"
  | "country"
  | "google_review_url"
  | "review_platforms"
  | "setup_checklist_state"
>;

export const getPublicBusiness = cache(async (slug: string): Promise<PublicBusiness | null> => {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const { data } = await createAdminClient().from("businesses").select(PUBLIC_FIELDS).eq("slug", slug).maybeSingle();
  return (data as PublicBusiness | null) ?? null;
});
