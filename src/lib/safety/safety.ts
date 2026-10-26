import defaultConfig from "./rules.json";
import type { SafetyFinding, SafetyStatus } from "@/lib/types";

export type SafetyRule = {
  id: string;
  severity: "high" | "medium";
  patterns?: string[];
  message: string;
  confirmable?: boolean;
  scope?: "review_context";
};

export type SafetyConfig = {
  version: string;
  last_verified: string;
  disclaimer: string;
  instagram_max_hashtags: number;
  restricted_hashtags: string[];
  rules: SafetyRule[];
};

export const DEFAULT_SAFETY_CONFIG = defaultConfig as SafetyConfig;

export type SafetyInput = {
  kind?: "post" | "review_request" | "reply";
  platform?: string | null;
  hook?: string | null;
  caption: string;
  on_screen_text?: string[];
  shot_list?: string[];
  hashtags?: string[];
  asset_needed?: string | null;
  needs_owner_confirmation?: string[];
  confirmed_items?: string[];
};

export type SafetyContext = {
  factSheetText: string; // fact sheet + services + proof assets, as plain text
  hasPermissionedProof: boolean;
  licenceRef: string | null;
  bannedWords: string[];
  offersEnabled?: boolean;
};

export type SafetyResult = { status: SafetyStatus; findings: SafetyFinding[] };

const PRICE_RE = /(?:[$£€]|A\$|AU\$)\s?\d[\d,]*(?:\.\d{1,2})?|\b\d[\d,]*(?:\.\d{1,2})?\s?(?:dollars|bucks|pounds|quid|usd|gbp|aud)\b/gi;
const OFFER_RE = /\b\d{1,3}\s?% off\b|\bdiscount(?:ed)?\b|\bhalf[- ]price\b|\bbogo\b|\bbuy one,? get one\b|\bspecial offer\b|\bfree (?!quotes?\b|estimates?\b|consultations?\b|parking\b)[a-z-]+|\bfor free\b|\bpromo(?:tion)? code\b|\bcoupon\b/gi;
const PLACEHOLDER_RE = /\[[^\]\n]{1,60}\]/g;
const QUOTE_RE = /["“]([^"”\n]{12,200})["”]/g;
const STAT_RE = /\b\d{2,}\+?\s?(?:happy |satisfied |5[- ]star |five[- ]star )?(?:customers|clients|reviews|jobs|cars|homes|families|people)\b|\b\d{1,3}(?:\.\d)?\s?%(?! off)|\b(?:rated|average(?:d)?)\s\d(?:\.\d)?\s?(?:stars?|\/\s?5)|★{3,}|\b\d+\+?\s?years?(?: of)? experience\b|\baward[- ]winning\b|\b#1\b|\bnumber one\b|\bvoted best\b/gi;
const NAMED_CUSTOMER_RE = /\b(?:thanks?|thank you|shout ?out|big love) to ([A-Z][a-z]+(?: [A-Z][a-z]+)?)\b/g;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ");
const digits = (s: string) => (s.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((d) => d.replace(/,/g, ""));

export function confirmKey(ruleId: string, match: string) {
  return `${ruleId}:${norm(match).trim()}`;
}

function collectText(input: SafetyInput) {
  return [input.hook, input.caption, ...(input.on_screen_text ?? [])].filter(Boolean).join("\n");
}

// Runs every rule over a post (or a review request / reply). Pure function:
// same input and config always give the same findings.
export function checkSafety(input: SafetyInput, ctx: SafetyContext, config: SafetyConfig = DEFAULT_SAFETY_CONFIG): SafetyResult {
  const findings: SafetyFinding[] = [];
  const confirmed = new Set((input.confirmed_items ?? []).map((c) => norm(c)));
  const copy = collectText(input);
  const production = [...(input.shot_list ?? []), input.asset_needed ?? ""].join("\n");
  const everything = `${copy}\n${production}`;
  const facts = norm(ctx.factSheetText);
  const factNumbers = new Set(digits(ctx.factSheetText));
  const isReviewContext = input.kind === "review_request" || /\breviews?\b/i.test(copy);
  const seen = new Set<string>();

  const add = (rule: SafetyRule, message: string, match?: string, field?: string) => {
    const key = `${rule.id}|${match ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (rule.confirmable && match && confirmed.has(confirmKey(rule.id, match))) return;
    findings.push({ rule_id: rule.id, severity: rule.severity, message, match, field });
  };

  for (const rule of config.rules) {
    if (rule.scope === "review_context" && !isReviewContext) continue;

    switch (rule.id) {
      case "customer_photo_permission": {
        if (ctx.hasPermissionedProof) break;
        matchPatterns(rule, everything, (m) => add(rule, rule.message, m));
        break;
      }
      case "music_and_image_rights":
        matchPatterns(rule, everything, (m) => add(rule, rule.message, m, "shot_list"));
        break;
      case "regional_claims":
        if (ctx.licenceRef) break;
        matchPatterns(rule, copy, (m) => add(rule, rule.message, m));
        break;
      case "fabricated_proof": {
        for (const m of copy.matchAll(QUOTE_RE)) {
          if (!facts.includes(norm(m[1]).slice(0, 40))) add(rule, "This quote isn't in your proof. Use only real customer words you have permission to share.", m[0]);
        }
        for (const m of copy.matchAll(STAT_RE)) {
          const nums = digits(m[0]);
          const supported = nums.length > 0 ? nums.every((n) => factNumbers.has(n)) : facts.includes(norm(m[0]));
          if (!supported) add(rule, rule.message, m[0]);
        }
        for (const m of copy.matchAll(NAMED_CUSTOMER_RE)) {
          if (!facts.includes(norm(m[1]))) add(rule, "Don't name customers unless they're in your proof with permission.", m[0]);
        }
        break;
      }
      case "unconfirmed_price_or_offer": {
        for (const m of copy.matchAll(PRICE_RE)) {
          const nums = digits(m[0]);
          if (!nums.every((n) => factNumbers.has(n))) {
            add({ ...rule, confirmable: false }, `${m[0].trim()} isn't a price in your fact sheet. Use your real price or a [price] placeholder.`, m[0].trim());
          } else {
            add(rule, `Confirm the price ${m[0].trim()} is current.`, m[0].trim());
          }
        }
        for (const m of copy.matchAll(OFFER_RE)) {
          const phrase = m[0].trim();
          if (facts.includes(norm(phrase))) continue;
          add(rule, `Confirm this offer is real: "${phrase}".`, phrase);
        }
        for (const item of input.needs_owner_confirmation ?? []) {
          if (!confirmed.has(confirmKey(rule.id, item)) && !confirmed.has(norm(item))) {
            add(rule, `Confirm before posting: ${item}`, item, "needs_owner_confirmation");
          }
        }
        break;
      }
      case "unfilled_placeholder":
        for (const m of copy.matchAll(PLACEHOLDER_RE)) add(rule, `Fill in ${m[0]} before posting.`, m[0]);
        break;
      case "hashtag_spam": {
        const tags = (input.hashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`).toLowerCase());
        const inline = (copy.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.toLowerCase());
        const all = Array.from(new Set([...tags, ...inline]));
        if (input.platform === "instagram" && all.length > config.instagram_max_hashtags) {
          add(rule, `${all.length} hashtags. Use ${config.instagram_max_hashtags} or fewer on Instagram.`, `${all.length} hashtags`);
        }
        const restricted = new Set(config.restricted_hashtags.map((t) => t.toLowerCase()));
        for (const t of all) if (restricted.has(t)) add(rule, `${t} is a restricted or spammy hashtag. Remove it.`, t);
        break;
      }
      case "owner_banned_words":
        for (const w of ctx.bannedWords) {
          const word = w.trim();
          if (!word) continue;
          const re = new RegExp(`\\b${escapeRe(word)}\\b`, "i");
          const m = copy.match(re);
          if (m) add(rule, `"${m[0]}" is on your list of words to avoid.`, m[0]);
        }
        break;
      default:
        matchPatterns(rule, copy, (m) => add(rule, rule.message, m));
    }
  }

  const status: SafetyStatus = findings.some((f) => f.severity === "high")
    ? "blocked"
    : findings.length > 0
      ? "pass_with_changes"
      : "pass";
  return { status, findings };
}

function matchPatterns(rule: SafetyRule, text: string, onMatch: (m: string) => void) {
  for (const p of rule.patterns ?? []) {
    let re: RegExp;
    try {
      re = new RegExp(p, "gi");
    } catch {
      continue;
    }
    for (const m of text.matchAll(re)) onMatch(m[0]);
  }
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Plain-text version of the facts the copy is allowed to rely on.
export function factSheetText(b: {
  fact_sheet?: unknown;
  services?: unknown;
  proof_assets?: { description: string; permission_confirmed: boolean }[] | null;
  opening_hours?: string | null;
  licence_or_registration_ref?: string | null;
}) {
  const proof = (b.proof_assets ?? []).filter((p) => p.permission_confirmed).map((p) => p.description);
  return JSON.stringify({ fs: b.fact_sheet ?? null, services: b.services ?? null, proof, hours: b.opening_hours ?? null, licence: b.licence_or_registration_ref ?? null });
}

export function safetyContextFor(b: {
  fact_sheet?: unknown;
  services?: unknown;
  proof_assets?: { description: string; permission_confirmed: boolean }[] | null;
  opening_hours?: string | null;
  licence_or_registration_ref?: string | null;
  banned_words?: string[] | null;
  offers_enabled?: boolean;
}): SafetyContext {
  return {
    factSheetText: factSheetText(b),
    hasPermissionedProof: (b.proof_assets ?? []).some((p) => p.permission_confirmed),
    licenceRef: b.licence_or_registration_ref ?? null,
    bannedWords: b.banned_words ?? [],
    offersEnabled: b.offers_enabled,
  };
}
