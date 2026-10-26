import { z } from "zod";
import { answersToBusinessPatch, type OnboardingAnswers } from "@/lib/onboarding";
import { error, json, parseBody, routeAuth } from "@/lib/api";
import { slugify } from "@/lib/utils";

const ServiceZ = z.object({
  name: z.string().max(120),
  price_or_range: z.string().max(60).nullable(),
  duration: z.string().max(60).nullable(),
  notes: z.string().max(300).nullable(),
});

const Body = z.object({
  onboarding_answers: z.record(z.string(), z.unknown()).optional(),
  onboarding_step: z.number().int().min(0).max(30).optional(),
  fields: z
    .object({
      name: z.string().max(120),
      slug: z.string().min(3).max(40),
      phone: z.string().max(40).nullable(),
      whatsapp_number: z.string().max(40).nullable(),
      opening_hours: z.string().max(500).nullable(),
      service_area: z.string().max(500).nullable(),
      services: z.array(ServiceZ).max(30),
      external_booking_url: z.string().url().max(500).nullable().or(z.literal("")),
      google_review_url: z.string().url().max(500).nullable().or(z.literal("")),
      google_business_url: z.string().url().max(500).nullable().or(z.literal("")),
      quiet_season: z.boolean(),
      offers_enabled: z.boolean(),
      public_page_published: z.boolean(),
      public_page_noindex: z.boolean(),
      voice_notes: z.string().max(2000).nullable(),
      voice_samples: z.array(z.string().max(2000)).max(5),
      banned_words: z.array(z.string().max(60)).max(50),
      regulated_notes: z.string().max(2000).nullable(),
      licence_or_registration_ref: z.string().max(200).nullable(),
      weekly_hours_available: z.number().min(0.5).max(10),
      faces_on_camera: z.boolean(),
      public_photos: z.array(z.object({ url: z.string().url().max(500), caption: z.string().max(200).nullable() })).max(12),
      proof_assets: z
        .array(
          z.object({
            type: z.string().max(40),
            description: z.string().max(2000),
            url: z.string().url().max(500).nullable(),
            permission_confirmed: z.boolean(),
          }),
        )
        .max(30),
      review_platforms: z.array(z.object({ platform: z.string().max(40), url: z.string().url().max(500) })).max(6),
      setup_checklist_state: z.record(z.string(), z.unknown()),
    })
    .partial()
    .optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/business/[id]">) {
  const { id } = await ctx.params;
  const auth = await routeAuth(id);
  if (!auth.ok) return auth.res;
  const body = await parseBody(request, Body);
  if (!body) return error("Invalid input.");

  const patch: Record<string, unknown> = {};
  if (body.onboarding_answers) {
    const merged = { ...auth.business.onboarding_answers, ...body.onboarding_answers } as OnboardingAnswers;
    patch.onboarding_answers = merged;
    Object.assign(patch, answersToBusinessPatch(body.onboarding_answers as OnboardingAnswers));
  }
  if (body.onboarding_step !== undefined) patch.onboarding_step = body.onboarding_step;
  if (body.fields) {
    const f = { ...body.fields };
    for (const k of ["external_booking_url", "google_review_url", "google_business_url"] as const) {
      if (f[k] === "") f[k] = null;
    }
    if (f.slug !== undefined) {
      f.slug = slugify(f.slug);
      if (f.slug.length < 3) return error("That page address is too short.");
    }
    if (f.google_review_url !== undefined) {
      patch.presence = { ...auth.business.presence, review_link: Boolean(f.google_review_url) };
    }
    Object.assign(patch, f);
  }
  if (Object.keys(patch).length === 0) return json({ ok: true });

  const { error: err } = await auth.supabase.from("businesses").update(patch).eq("id", id);
  if (err) {
    if (String(err.message).includes("businesses_slug_key")) return error("That page address is taken. Try another.", 409);
    return error("Couldn't save. Please try again.", 500);
  }
  return json({ ok: true });
}
