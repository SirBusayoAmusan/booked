import "server-only";
import { runAi } from "./client";
import { businessContext, systemPrompt } from "./prompts";
import { FactSheetSchema, PositioningSchema, SetupGuidanceSchema } from "./schemas";
import { GET_FOUND_CHECKLIST, tradeBenefitsFromFacebook } from "@/lib/config/checklist";
import type { Business } from "@/lib/types";

const numbersIn = (s: string) => s.match(/\d+(?:[.,]\d+)?/g) ?? [];

// build_fact_sheet: onboarding answers -> the closed set of facts.
export async function buildFactSheet(b: Business, userId: string) {
  const answers = JSON.stringify(b.onboarding_answers ?? {}, null, 2);
  return runAi({
    kind: "fact_sheet",
    schema: FactSheetSchema,
    userId,
    businessId: b.id,
    cache: true,
    system: systemPrompt(
      "Turn the owner's onboarding answers into a fact sheet. Copy facts, do not improve them. Keep the owner's prices exactly as written; if a service has no price, set price_or_range to null and add a question to unknowns_to_ask_owner. differentiators_stated_by_owner must be things the owner actually said. do_not_say collects the owner's banned words, regulated notes and anything they said not to claim.",
      b,
    ),
    prompt: `<onboarding_answers>\n${answers}\n</onboarding_answers>`,
    validate: (out) => {
      const nums = new Set(numbersIn(answers));
      for (const s of out.services) {
        if (!s.price_or_range) continue;
        const missing = numbersIn(s.price_or_range).filter((n) => !nums.has(n));
        if (missing.length) return `Price "${s.price_or_range}" for ${s.name} is not in the owner's answers. Use only prices the owner gave, or null.`;
      }
      return null;
    },
  });
}

// generate_positioning: profile + fact sheet -> positioning summary.
export async function generatePositioning(b: Business, userId: string) {
  return runAi({
    kind: "positioning",
    schema: PositioningSchema,
    userId,
    businessId: b.id,
    cache: true,
    system: systemPrompt(
      "Write a positioning summary for this business: a one-sentence positioning statement, the ideal customer, 3 to 5 content pillars (each with a purpose of attract, trust, convert or retain), a platform mix with one primary platform and one conversion channel chosen from what the owner already uses, tasks to collect missing proof, and any assumptions you made. Only use platforms the owner is on. If the owner has no Google Business Profile, do not make it the primary platform.",
      b,
    ),
    prompt: `${businessContext(b)}\n<owner_answers>\n${JSON.stringify(b.onboarding_answers ?? {}, null, 2)}\n</owner_answers>`,
    validate: (out) => (out.pillars.length < 3 || out.pillars.length > 5 ? "Give 3 to 5 pillars." : null),
  });
}

// generate_setup_guidance: presence -> which Get Found items to show and why.
export async function generateSetupGuidance(b: Business, userId: string) {
  const allowed = GET_FOUND_CHECKLIST.filter((i) => i.id !== "facebook_page" || tradeBenefitsFromFacebook(b.trade));
  const ids = new Set(allowed.map((i) => i.id));
  return runAi({
    kind: "setup_guidance",
    schema: SetupGuidanceSchema,
    userId,
    businessId: b.id,
    cache: true,
    effort: "low",
    system: systemPrompt(
      "Write a short Get Found setup checklist for this owner. Use only the items in allowed_items, with the same ids and depends_on. Skip items the presence assessment shows are already done. Rewrite why_it_matters in one plain sentence for this trade. Do not invent platform requirements; keep steps general and tell the owner to follow the platform's own instructions.",
      b,
    ),
    prompt: `<allowed_items>\n${JSON.stringify(allowed.map(({ href: _h, ...rest }) => rest), null, 2)}\n</allowed_items>\n<presence>\n${JSON.stringify(b.presence)}\n</presence>\n<trade>${b.trade ?? ""}</trade>`,
    validate: (out) => {
      const bad = out.checklist_items.find((i) => !ids.has(i.id as never));
      return bad ? `Item id "${bad.id}" is not in allowed_items.` : null;
    },
  });
}
