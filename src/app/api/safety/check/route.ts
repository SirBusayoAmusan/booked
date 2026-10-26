import { z } from "zod";
import { error, json, parseBody, routeAuth } from "@/lib/api";
import { checkSafety, safetyContextFor } from "@/lib/safety/safety";
import { getSafetyConfig } from "@/lib/safety/config";

const Body = z.object({
  businessId: z.string().uuid(),
  kind: z.enum(["post", "review_request", "reply"]).default("post"),
  platform: z.string().max(40).nullable().optional(),
  hook: z.string().max(300).nullable().optional(),
  caption: z.string().max(5000),
  hashtags: z.array(z.string().max(60)).max(30).optional(),
  on_screen_text: z.array(z.string().max(200)).max(20).optional(),
  shot_list: z.array(z.string().max(300)).max(30).optional(),
  needs_owner_confirmation: z.array(z.string().max(400)).max(30).optional(),
  confirmed_items: z.array(z.string().max(400)).max(60).optional(),
});

// Live lint for text being edited, without saving.
export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return error("Invalid input.");
  const auth = await routeAuth(body.businessId);
  if (!auth.ok) return auth.res;
  const config = await getSafetyConfig();
  return json({ ...checkSafety(body, safetyContextFor(auth.business), config), disclaimer: config.disclaimer, version: config.version });
}
