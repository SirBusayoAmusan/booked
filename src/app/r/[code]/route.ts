import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logClick } from "@/lib/clicks";

// Tracked link: {APP_BASE_URL}/r/{tracking_code}. Logs a click, then
// redirects to the public page with ?src= so an enquiry is attributed.
export async function GET(request: NextRequest, ctx: RouteContext<"/r/[code]">) {
  const { code } = await ctx.params;
  if (!/^[a-z0-9]{4,16}$/.test(code)) return NextResponse.redirect(new URL("/", request.url));
  const admin = createAdminClient();
  const { data: post } = await admin
    .from("posts")
    .select("id, business_id, businesses(slug)")
    .eq("tracking_code", code)
    .maybeSingle();
  const slug = (post?.businesses as unknown as { slug: string } | null)?.slug;
  if (!post || !slug) return NextResponse.redirect(new URL("/", request.url));
  await logClick({ businessId: post.business_id, postId: post.id, kind: "tracked_link", headers: request.headers }).catch(() => {});
  return NextResponse.redirect(new URL(`/b/${slug}?src=${code}`, request.url), 302);
}
