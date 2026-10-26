import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkSafety, safetyContextFor, type SafetyConfig } from "@/lib/safety/safety";
import type { PostOut } from "@/lib/ai/schemas";
import type { Business, Post } from "@/lib/types";
import { randomCode } from "@/lib/utils";

export function runPostSafety(
  p: Pick<Post, "platform" | "hook" | "caption" | "on_screen_text" | "shot_list" | "hashtags" | "asset_needed" | "needs_owner_confirmation" | "confirmed_items">,
  b: Business,
  config: SafetyConfig,
) {
  return checkSafety(
    {
      kind: "post",
      platform: p.platform,
      hook: p.hook,
      caption: p.caption,
      on_screen_text: p.on_screen_text,
      shot_list: p.shot_list,
      hashtags: p.hashtags,
      asset_needed: p.asset_needed,
      needs_owner_confirmation: p.needs_owner_confirmation,
      confirmed_items: p.confirmed_items,
    },
    safetyContextFor(b),
    config,
  );
}

const cleanWord = (w: string | null) =>
  w
    ? w
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 12) || null
    : null;

// Turns one AI post into a row: tracking code, normalised code word, hashtags
// with '#', and the safety result.
export function postRow(out: PostOut, b: Business, config: SafetyConfig, ids: { calendar_id: string; shoot_day_id: string | null }) {
  const hashtags = out.platform === "google_business" ? [] : out.hashtags.slice(0, 15).map((h) => (h.startsWith("#") ? h : `#${h}`).replace(/\s+/g, ""));
  const row = {
    calendar_id: ids.calendar_id,
    business_id: b.id,
    shoot_day_id: out.shot_list.length > 0 ? ids.shoot_day_id : null,
    ref: out.ref,
    publish_date: out.publish_date,
    platform: out.platform,
    pillar: out.pillar,
    format: out.format,
    hook: out.hook,
    caption: out.caption,
    on_screen_text: out.on_screen_text,
    shot_list: out.shot_list,
    hashtags,
    cta_type: out.cta_type,
    promo_code_word: b.offers_enabled ? cleanWord(out.promo_code_word) : null,
    asset_needed: out.asset_needed,
    needs_owner_confirmation: out.needs_owner_confirmation,
    confirmed_items: [] as string[],
    original_caption: out.caption,
    no_filming: out.shot_list.length === 0,
    tracking_code: randomCode(7),
    status: "draft",
  };
  const safety = runPostSafety(row, b, config);
  return { ...row, safety_status: safety.status, safety_findings: safety.findings };
}

// Code words are unique per business; add a number when one is taken.
export async function dedupeCodeWords(supabase: SupabaseClient, businessId: string, rows: { promo_code_word: string | null }[]) {
  const words = rows.map((r) => r.promo_code_word).filter((w): w is string => Boolean(w));
  if (words.length === 0) return;
  const { data } = await supabase.from("posts").select("promo_code_word").eq("business_id", businessId).not("promo_code_word", "is", null);
  const taken = new Set((data ?? []).map((r) => String(r.promo_code_word).toUpperCase()));
  for (const r of rows) {
    if (!r.promo_code_word) continue;
    let w = r.promo_code_word;
    for (let i = 2; taken.has(w); i++) w = `${r.promo_code_word}${i}`;
    taken.add(w);
    r.promo_code_word = w;
  }
}
