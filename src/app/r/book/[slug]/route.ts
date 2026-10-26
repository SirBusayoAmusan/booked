import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logClick } from "@/lib/clicks";

// "Book now" on the public page: log the click, then send the visitor to the
// owner's own booking tool, passing the tracking code as UTM parameters.
// Booked can't see completed bookings inside those tools.
export async function GET(request: NextRequest, ctx: RouteContext<"/r/book/[slug]">) {
  const { slug } = await ctx.params;
  const src = request.nextUrl.searchParams.get("src");
  const admin = createAdminClient();
  const { data: b } = await admin.from("businesses").select("id, slug, external_booking_url").eq("slug", slug).maybeSingle();
  if (!b?.external_booking_url) return NextResponse.redirect(new URL(`/b/${slug}`, request.url));

  let postId: string | null = null;
  if (src && /^[a-z0-9]{4,16}$/.test(src)) {
    const { data: post } = await admin.from("posts").select("id").eq("business_id", b.id).eq("tracking_code", src).maybeSingle();
    postId = post?.id ?? null;
  }
  await logClick({ businessId: b.id, postId, kind: "booking_link", headers: request.headers }).catch(() => {});

  const target = new URL(b.external_booking_url);
  target.searchParams.set("utm_source", "booked");
  target.searchParams.set("utm_medium", "booking_page");
  if (postId && src) target.searchParams.set("utm_campaign", src);
  return NextResponse.redirect(target, 302);
}
