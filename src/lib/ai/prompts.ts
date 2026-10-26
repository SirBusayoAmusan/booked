import type { Business } from "@/lib/types";

const SPELLING: Record<string, string> = {
  "en-US": "American English spelling (color, neighborhood)",
  "en-GB": "British English spelling (colour, neighbourhood)",
  "en-AU": "Australian English spelling (colour, neighbourhood)",
};

export const SHARED_RULES = [
  "You write for a small local service business owner, in plain language at about a 7th grade reading level, in the owner's voice using voice_notes, voice_samples and style_examples.",
  "Use only facts present in the fact sheet and proof_assets. Never invent prices, availability, credentials, reviews, numbers or customer names. If a needed fact is missing, put a bracketed placeholder like [price] and add an entry to needs_owner_confirmation.",
  "No guaranteed results. No fake urgency. Offers and scarcity only if the owner supplied them.",
  "One clear call to action per post.",
  "Write genuinely different angles across posts, not rephrased duplicates.",
  "Never use words in banned_words. Respect regulated_notes.",
  "Never write testimonials, reviews, quotes, statistics, before/after claims or credentials that are not in the facts. Missing proof becomes a task for the owner.",
  "Never claim the owner is licensed, certified, insured or registered unless licence_or_registration_ref is provided.",
  "Respond with valid JSON only, matching the schema.",
];

export function systemPrompt(task: string, business?: Pick<Business, "locale"> | null) {
  const spelling = business ? `\nUse ${SPELLING[business.locale] ?? SPELLING["en-US"]}.` : "";
  return `You are Booked, a marketing assistant for local service businesses.

Rules you always follow:
${SHARED_RULES.map((r, i) => `${i + 1}. ${r}`).join("\n")}${spelling}

Your task: ${task}`;
}

// The closed set of facts the model may use, plus voice guidance.
export function businessContext(
  b: Business,
  styleExamples: { kind: string; before: string; after: string }[] = [],
) {
  const permittedProof = (b.proof_assets ?? []).filter((p) => p.permission_confirmed);
  const ctx = {
    business_name: b.name,
    trade: b.trade,
    city: b.city,
    service_area: b.service_area,
    neighbourhoods: b.neighbourhoods,
    languages: b.languages,
    country: b.country,
    fact_sheet: b.fact_sheet ?? { services: b.services },
    proof_assets: permittedProof,
    proof_without_permission_count: (b.proof_assets ?? []).length - permittedProof.length,
    licence_or_registration_ref: b.licence_or_registration_ref,
    voice_notes: b.voice_notes,
    voice_samples: b.voice_samples,
    style_examples: styleExamples.slice(0, 5).map((s) => ({ before: s.before, after: s.after })),
    banned_words: b.banned_words,
    regulated_notes: b.regulated_notes,
    booking: {
      method: b.booking_method,
      has_booking_link: Boolean(b.external_booking_url),
      booking_tool: b.booking_tool,
    },
    offers_enabled: b.offers_enabled,
    faces_on_camera: b.faces_on_camera,
    weekly_hours_available: b.weekly_hours_available,
  };
  return `<business_facts>\n${JSON.stringify(ctx, null, 2)}\n</business_facts>`;
}
