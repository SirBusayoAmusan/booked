import { z } from "zod";
import { error, json, parseBody, routeAuth } from "@/lib/api";
import { getSafetyConfig } from "@/lib/safety/config";
import { runPostSafety } from "@/lib/posts";
import { createClient } from "@/lib/supabase/server";
import type { Post } from "@/lib/types";

const Body = z.object({
  hook: z.string().max(300).optional(),
  caption: z.string().max(5000).optional(),
  hashtags: z.array(z.string().max(60)).max(30).optional(),
  on_screen_text: z.array(z.string().max(200)).max(20).optional(),
  promo_code_word: z.string().max(12).nullable().optional(),
  confirm: z.string().max(400).optional(),
  unconfirm: z.string().max(400).optional(),
  status: z.enum(["draft", "ready", "posted", "skipped"]).optional(),
});

async function loadPost(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select("*").eq("id", id).maybeSingle();
  return data as Post | null;
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/posts/[id]">) {
  const { id } = await ctx.params;
  const post = await loadPost(id);
  if (!post) return error("Post not found.", 404);
  const auth = await routeAuth(post.business_id);
  if (!auth.ok) return auth.res;
  const body = await parseBody(request, Body);
  if (!body) return error("Invalid input.");

  const next: Post = { ...post };
  if (body.hook !== undefined) next.hook = body.hook;
  if (body.caption !== undefined) next.caption = body.caption;
  if (body.hashtags !== undefined) next.hashtags = body.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`).replace(/\s+/g, ""));
  if (body.on_screen_text !== undefined) next.on_screen_text = body.on_screen_text;
  if (body.promo_code_word !== undefined) next.promo_code_word = body.promo_code_word ? body.promo_code_word.toUpperCase().replace(/[^A-Z0-9]/g, "") || null : null;
  if (body.confirm) next.confirmed_items = Array.from(new Set([...(next.confirmed_items ?? []), body.confirm]));
  if (body.unconfirm) next.confirmed_items = (next.confirmed_items ?? []).filter((c) => c !== body.unconfirm);

  // The gate runs on every edit.
  const safety = runPostSafety(next, auth.business, await getSafetyConfig());
  const patch: Record<string, unknown> = {
    hook: next.hook,
    caption: next.caption,
    hashtags: next.hashtags,
    on_screen_text: next.on_screen_text,
    promo_code_word: next.promo_code_word,
    confirmed_items: next.confirmed_items,
    safety_status: safety.status,
    safety_findings: safety.findings,
  };

  const captionChanged = body.caption !== undefined && body.caption.trim() !== post.caption.trim();
  if (captionChanged) patch.edited_caption = body.caption;
  // Content edits send a ready post back to draft so it gets re-checked.
  if ((captionChanged || body.hook !== undefined) && post.status === "ready" && safety.status === "blocked") patch.status = "draft";

  if (body.status) {
    if ((body.status === "ready" || body.status === "posted") && safety.status === "blocked") {
      return json({ error: "Fix the safety findings before marking this ready.", safety }, 409);
    }
    patch.status = body.status;
    if (body.status === "posted") patch.posted_at = post.posted_at ?? new Date().toISOString();
    if (body.status !== "posted") patch.posted_at = null;
  }

  const { data: updated, error: err } = await auth.supabase.from("posts").update(patch).eq("id", id).select("*").single();
  if (err) {
    if (String(err.message).includes("posts_code_word_unique")) return error("That code word is already used by another post.", 409);
    return error("Couldn't save.", 500);
  }

  // Edit-learning loop: keep the before/after as a style example.
  if (captionChanged && body.caption!.trim().length > 0) {
    await auth.supabase.from("style_examples").insert({ business_id: post.business_id, kind: "caption", before: post.caption, after: body.caption });
  }

  return json({ post: updated, safety });
}
