import { z } from "zod";
import { aiErrorResponse, error, json, parseBody, routeAuth } from "@/lib/api";
import { regeneratePost } from "@/lib/ai/calendar-fns";
import { assertCanRun, hasFeature } from "@/lib/limits";
import { allowedPlatforms } from "@/lib/calendar";
import { dedupeCodeWords, postRow } from "@/lib/posts";
import { getSafetyConfig } from "@/lib/safety/config";
import type { Post } from "@/lib/types";

export const maxDuration = 60;

const Body = z.object({ postId: z.string().uuid(), instruction: z.string().max(300).nullable().optional() });

export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return error("Invalid input.");
  const pre = await routeAuth();
  if (!pre.ok) return pre.res;
  const { data: postData } = await pre.supabase.from("posts").select("*").eq("id", body.postId).maybeSingle();
  if (!postData) return error("Post not found.", 404);
  const post = postData as Post;
  if (post.status === "posted") return error("This post is already marked posted.", 409);
  const auth = await routeAuth(post.business_id);
  if (!auth.ok) return auth.res;

  try {
    await assertCanRun(auth.supabase, auth.profile, "regenerate", post.business_id);
    const { data: examples } = hasFeature(auth.profile, "voice_learning")
      ? await auth.supabase.from("style_examples").select("kind, before, after").eq("business_id", post.business_id).eq("kind", "caption").order("created_at", { ascending: false }).limit(5)
      : { data: [] };
    const out = await regeneratePost({
      business: auth.business,
      userId: auth.user.id,
      post,
      instruction: body.instruction ?? null,
      platforms: allowedPlatforms(auth.business, hasFeature(auth.profile, "gbp_pack")),
      styleExamples: (examples ?? []) as { kind: string; before: string; after: string }[],
    });
    out.publish_date = post.publish_date;
    const row = postRow(out, auth.business, await getSafetyConfig(), { calendar_id: post.calendar_id, shoot_day_id: post.shoot_day_id });
    if (row.promo_code_word && row.promo_code_word !== post.promo_code_word) await dedupeCodeWords(auth.supabase, post.business_id, [row]);
    const { tracking_code: _keepCode, ...rest } = row;
    const { data: updated, error: err } = await auth.supabase
      .from("posts")
      .update({ ...rest, shoot_day_id: post.shoot_day_id, status: "draft", edited_caption: null })
      .eq("id", post.id)
      .select("*")
      .single();
    if (err) return error("Couldn't save the new version.", 500);
    return json({ post: updated });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
