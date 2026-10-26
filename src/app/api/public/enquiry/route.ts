import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, privacyHash } from "@/lib/hash";
import { error, json, parseBody } from "@/lib/api";
import { notifyNewEnquiry } from "@/lib/notify";

const Body = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
  src: z.string().regex(/^[a-z0-9]{4,16}$/).nullable().optional(),
  name: z.string().trim().min(1).max(80),
  contact: z.string().trim().min(3).max(120),
  service: z.string().trim().max(120).nullable().optional(),
  message: z.string().trim().max(2000).optional().default(""),
  consent: z.literal(true),
  website: z.string().optional().nullable(), // honeypot
});

export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return error("Please fill in your name, contact details and tick the consent box.");
  // Bots fill the hidden field. Pretend it worked.
  if (body.website) return json({ ok: true });

  const admin = createAdminClient();
  const ipKey = privacyHash(clientIp(request.headers), "enquiry");
  const [{ data: perIp }, { data: perBiz }] = await Promise.all([
    admin.rpc("hit_rate_limit", { p_key: `enq:ip:${ipKey}`, p_window_seconds: 3600, p_max: 10 }),
    admin.rpc("hit_rate_limit", { p_key: `enq:biz:${body.slug}`, p_window_seconds: 3600, p_max: 60 }),
  ]);
  if (perIp === false || perBiz === false) return error("Too many enquiries. Please try again later.", 429);

  const { data: business } = await admin.from("businesses").select("id, owner_id, name").eq("slug", body.slug).maybeSingle();
  if (!business) return error("This page no longer exists.", 404);

  let postId: string | null = null;
  if (body.src) {
    const { data: post } = await admin.from("posts").select("id").eq("business_id", business.id).eq("tracking_code", body.src).maybeSingle();
    postId = post?.id ?? null;
  }

  const { data: enquiry, error: err } = await admin
    .from("enquiries")
    .insert({
      business_id: business.id,
      post_id: postId,
      source: postId ? "tracked_link" : "public_page",
      name: body.name,
      contact: body.contact,
      service_requested: body.service || null,
      message: body.message || null,
      consent_to_contact: true,
    })
    .select("id")
    .single();
  if (err || !enquiry) return error("Couldn't send. Please try again.", 500);

  await notifyNewEnquiry(business.owner_id, business.id, body.name).catch(() => {});
  return json({ ok: true }, 201);
}
