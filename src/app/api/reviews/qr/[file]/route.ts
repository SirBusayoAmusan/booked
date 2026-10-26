import { error, routeAuth } from "@/lib/api";
import { qrPng, qrSvg } from "@/lib/qr";
import { reviewLinkFor } from "@/lib/reviews";
import { appUrl } from "@/lib/utils";

// GET /api/reviews/qr/{businessId}.svg (or .png). ?target=page for the
// public page QR instead of the review link.
export async function GET(request: Request, ctx: RouteContext<"/api/reviews/qr/[file]">) {
  const { file } = await ctx.params;
  const m = file.match(/^([0-9a-f-]{36})\.(svg|png)$/i);
  if (!m) return error("Not found.", 404);
  const [, businessId, ext] = m;
  const auth = await routeAuth(businessId);
  if (!auth.ok) return auth.res;
  const target = new URL(request.url).searchParams.get("target") === "page" ? "page" : "review";
  const url = target === "page" ? appUrl(`/b/${auth.business.slug}`) : reviewLinkFor(auth.business)?.url;
  if (!url) return error("Add a review link first.", 404);
  const headers = { "cache-control": "private, max-age=300", "content-disposition": `inline; filename="${target}-qr.${ext}"` };
  if (ext.toLowerCase() === "png") {
    const buf = await qrPng(url);
    return new Response(new Uint8Array(buf), { headers: { ...headers, "content-type": "image/png" } });
  }
  return new Response(await qrSvg(url), { headers: { ...headers, "content-type": "image/svg+xml" } });
}
