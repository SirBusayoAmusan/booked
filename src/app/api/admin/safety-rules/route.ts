import { z } from "zod";
import { error, json, parseBody, routeAuth } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

const Rule = z.object({
  id: z.string().min(1).max(60),
  severity: z.enum(["high", "medium"]),
  patterns: z.array(z.string().max(300)).max(50).optional(),
  message: z.string().min(1).max(400),
  confirmable: z.boolean().optional(),
  scope: z.literal("review_context").optional(),
});

const Body = z.object({
  version: z.string().min(1).max(40),
  last_verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(2000).optional(),
  rules: z.object({
    disclaimer: z.string().min(1).max(500),
    instagram_max_hashtags: z.number().int().min(1).max(30),
    restricted_hashtags: z.array(z.string().max(60)).max(500),
    rules: z.array(Rule).min(1).max(100),
  }),
});

// Publishes a new safety rules version. Takes effect without a deploy.
export async function POST(request: Request) {
  const auth = await routeAuth();
  if (!auth.ok) return auth.res;
  if (!auth.profile.is_admin) return error("Not found.", 404);
  const body = await parseBody(request, Body);
  if (!body) return error("Rules JSON doesn't match the expected shape.");
  for (const r of body.rules.rules) {
    for (const p of r.patterns ?? []) {
      try {
        new RegExp(p, "gi");
      } catch {
        return error(`Rule ${r.id} has an invalid pattern: ${p}`);
      }
    }
  }
  const { error: err } = await createAdminClient()
    .from("safety_rules_meta")
    .insert({ version: body.version, last_verified: body.last_verified, notes: body.notes ?? null, rules: body.rules });
  if (err) return error("Couldn't save.", 500);
  return json({ ok: true });
}
