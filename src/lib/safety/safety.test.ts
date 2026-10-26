import { describe, expect, it } from "vitest";
import { checkSafety, confirmKey, safetyContextFor, type SafetyInput } from "./safety";
import config from "./rules.json";

const ctx = safetyContextFor({
  fact_sheet: {
    services: [
      { name: "Full detail", price_or_range: "$180", duration: "3 hours", notes: null },
      { name: "Maintenance wash", price_or_range: "$60", duration: "1 hour", notes: null },
    ],
    differentiators_stated_by_owner: ["I come to you", "free quotes"],
  },
  proof_assets: [{ description: "23 Google reviews averaging 4.9 stars. Customer Dana said \"best job anyone has ever done on my truck\"", permission_confirmed: true }],
  licence_or_registration_ref: null,
  banned_words: ["cheap", "luxury"],
});

const noPermCtx = { ...ctx, hasPermissionedProof: false };
const licensedCtx = { ...ctx, licenceRef: "Insured with Acme Mutual, policy 123" };

type Case = { text?: string; input?: Partial<SafetyInput>; ctx?: typeof ctx };
const run = (c: Case) =>
  checkSafety({ caption: c.text ?? "", platform: "instagram", ...(c.input ?? {}) }, c.ctx ?? ctx);
const ruleIds = (c: Case) => run(c).findings.map((f) => f.rule_id);

const CASES: Record<string, { pass: Case[]; fail: Case[] }> = {
  guaranteed_results: {
    pass: [{ text: "We do a careful job every time." }, { text: "Book a full detail this week." }, { text: "Here's what a maintenance wash includes." }],
    fail: [{ text: "Guaranteed to look brand new!" }, { text: "100% results or your money back" }, { text: "Totally risk-free booking" }, { text: "Our method never fails" }],
  },
  fake_urgency: {
    pass: [
      { text: "Spots open most weekdays." },
      { text: "Message me to book." },
      { text: "Only 2 spots left this week", input: { confirmed_items: [confirmKey("fake_urgency", "only 2 spots left")] } },
    ],
    fail: [{ text: "Only 3 spots left!" }, { text: "Last chance to book before summer" }, { text: "Offer ends tonight" }],
  },
  personal_attributes: {
    pass: [{ text: "Busy week? We'll come to you." }, { text: "Your car deserves a break too." }, { text: "Need a fresh cut before the weekend?" }],
    fail: [{ text: "Are you depressed about your messy car?" }, { text: "Struggling with debt? Treat yourself anyway." }, { text: "We know you're gay and love clean cars." }],
  },
  before_after_claims: {
    pass: [{ text: "Here's the finished car." }, { text: "Watch the foam do its thing." }, { text: "After a long week, come relax." }],
    fail: [{ text: "Before and after of this SUV" }, { text: "She lost 10 kg with our plan" }, { text: "Before & after: you won't believe it" }],
  },
  medical_or_regulated_claims: {
    pass: [{ text: "Fresh fade, sharp lines." }, { text: "Deep clean for your kitchen." }, { text: "We treat every car like our own." }],
    fail: [{ text: "This oil cures dandruff" }, { text: "Our facial treats acne fast" }, { text: "Clinically proven shampoo" }, { text: "Totally pain-free waxing" }],
  },
  engagement_bait: {
    pass: [{ text: "What colour should we wrap next?" }, { text: "Save this for later." }, { text: "Questions? Send me a message." }],
    fail: [{ text: "Like and share to win a free wash" }, { text: "Tag 3 friends who need this" }, { text: "Comment YES to get the price list" }],
  },
  fabricated_proof: {
    pass: [
      { text: "23 Google reviews and counting." },
      { text: "Dana said \"best job anyone has ever done on my truck\"" },
      { text: "Real photos from real jobs this week." },
    ],
    fail: [
      { text: "Over 500 happy customers served!" },
      { text: "\"Amazing service, would recommend to anyone\" says a client" },
      { text: "Rated 5 stars by our clients" },
      { text: "Award-winning detailing in Austin" },
      { text: "Big thanks to Maria Lopez for booking!" },
      { text: "15 years of experience" },
    ],
  },
  unconfirmed_price_or_offer: {
    pass: [
      { text: "Full detail is [price]. Message me." }, // placeholder is a different rule
      { text: "Full detail for $180", input: { confirmed_items: [confirmKey("unconfirmed_price_or_offer", "$180")] } },
      { text: "Free quotes, just message me." },
      { text: "Book this week", input: { needs_owner_confirmation: ["Saturday availability"], confirmed_items: [confirmKey("unconfirmed_price_or_offer", "Saturday availability")] } },
    ],
    fail: [
      { text: "Full detail for just $99" },
      { text: "Full detail for $180" },
      { text: "20% off this week only" },
      { text: "Get a free wax with any detail" },
      { text: "Book now", input: { needs_owner_confirmation: ["Saturday availability"] } },
    ],
  },
  unfilled_placeholder: {
    pass: [{ text: "Full detail, message me for a price." }, { text: "Open Mon to Fri." }, { text: "Book via the link in bio." }],
    fail: [{ text: "Full detail is [price]." }, { text: "Open [days] from [hours]" }, { text: "Ask about [service]" }],
  },
  customer_photo_permission: {
    pass: [
      { text: "Our own photos of the finish.", ctx: noPermCtx },
      { text: "Repost a customer photo", ctx },
      { text: "Close-up of the wheels", input: { shot_list: ["Wheel close-up"] }, ctx: noPermCtx },
    ],
    fail: [
      { text: "Repost a customer photo from last week", ctx: noPermCtx },
      { text: "Share", input: { shot_list: ["Customer's selfie with the car"] }, ctx: noPermCtx },
      { text: "Share", input: { asset_needed: "Photo of a client after the cut" }, ctx: noPermCtx },
    ],
  },
  hashtag_spam: {
    pass: [
      { text: "Fresh cut", input: { hashtags: ["#barber", "#austinbarber"] } },
      { text: "Fresh cut", input: { platform: "facebook", hashtags: Array.from({ length: 12 }, (_, i) => `#tag${i}`) } },
      { text: "Fresh cut #barber #fade" },
    ],
    fail: [
      { text: "Fresh cut", input: { hashtags: Array.from({ length: 11 }, (_, i) => `#tag${i}`) } },
      { text: "Fresh cut", input: { hashtags: ["#followforfollow"] } },
      { text: "Fresh cut #like4like" },
    ],
  },
  music_and_image_rights: {
    pass: [
      { text: "x", input: { shot_list: ["Use audio from the Instagram library"] } },
      { text: "x", input: { shot_list: ["Your own photo of the van"] } },
      { text: "x", input: { shot_list: ["Slow pan across the bonnet"] } },
    ],
    fail: [
      { text: "x", input: { shot_list: ["Set it to trending audio"] } },
      { text: "x", input: { asset_needed: "A stock photo of a clean kitchen" } },
      { text: "x", input: { shot_list: ["Use a popular song"] } },
    ],
  },
  review_incentive_or_gating: {
    pass: [
      { text: "Thanks for today, Sam! If you have a minute, an honest review helps: https://g.page/r/x", input: { kind: "review_request" } },
      { text: "Five-star finish on this truck." }, // not a review context
      { text: "Would you leave us a review? Here's the link.", input: { kind: "review_request" } },
    ],
    fail: [
      { text: "Leave a review and get 10% off your next visit", input: { kind: "review_request" } },
      { text: "Please leave us a 5-star review!", input: { kind: "review_request" } },
      { text: "Free wash for a review this month" },
      { text: "If you were happy, please leave a Google review. If you weren't happy, message me first.", input: { kind: "review_request" } },
    ],
  },
  endorsement_and_testimonial_disclosure: {
    pass: [{ text: "Here's what I did today." }, { text: "Come see the finish." }, { text: "Questions? DM me." }],
    fail: [{ text: "Testimonial time!" }, { text: "These products were gifted to us" }, { text: "Our customer said it was the best detail ever" }],
  },
  regional_claims: {
    pass: [
      { text: "Careful work, every time." },
      { text: "Fully insured and ready to help", ctx: licensedCtx },
      { text: "I come to your driveway." },
    ],
    fail: [{ text: "Fully insured and ready to help" }, { text: "Licensed electrician" }, { text: "Certified detailer" }],
  },
  owner_banned_words: {
    pass: [{ text: "Affordable full details." }, { text: "Great value." }, { text: "Cheapest? No. Careful? Yes.".replace("Cheapest", "Lowest") }],
    fail: [{ text: "Cheap car washes" }, { text: "A luxury finish" }, { text: "Not cheap, but worth it" }],
  },
};

describe("safety rules", () => {
  it("covers every configured rule with at least 3 passing and 3 failing examples", () => {
    for (const rule of config.rules) {
      expect(CASES[rule.id], rule.id).toBeDefined();
      expect(CASES[rule.id].pass.length, rule.id).toBeGreaterThanOrEqual(3);
      expect(CASES[rule.id].fail.length, rule.id).toBeGreaterThanOrEqual(3);
    }
  });

  for (const [ruleId, { pass, fail }] of Object.entries(CASES)) {
    describe(ruleId, () => {
      pass.forEach((c, i) => it(`passes example ${i + 1}: ${c.text}`, () => expect(ruleIds(c)).not.toContain(ruleId)));
      fail.forEach((c, i) => it(`flags example ${i + 1}: ${c.text}`, () => expect(ruleIds(c)).toContain(ruleId)));
    });
  }
});

describe("status", () => {
  it("blocks guaranteed results and unconfirmed prices", () => {
    expect(run({ text: "Guaranteed shine" }).status).toBe("blocked");
    expect(run({ text: "Full detail for just $99" }).status).toBe("blocked");
  });
  it("allows medium findings with changes", () => {
    expect(run({ text: "Testimonial time!" }).status).toBe("pass_with_changes");
  });
  it("passes clean copy", () => {
    expect(run({ text: "I come to you. Message me to book a full detail." }).status).toBe("pass");
  });
});
