import "server-only";
import { runAi } from "./client";
import { businessContext, systemPrompt } from "./prompts";
import { ReplySchema, ReviewRequestSchema } from "./schemas";
import { checkSafety, safetyContextFor } from "@/lib/safety/safety";
import type { Business, SavedReply } from "@/lib/types";

const numbers = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", ""));

// draft_reply: two options built only from the fact sheet and saved replies.
export async function draftReply(opts: {
  business: Business;
  userId: string;
  message: string;
  service: string | null;
  savedReplies: Pick<SavedReply, "title" | "service" | "body">[];
  styleExamples: { before: string; after: string }[];
}) {
  const b = opts.business;
  const allowed = new Set([...numbers(JSON.stringify(b.fact_sheet ?? b.services)), ...numbers(opts.message), ...numbers(JSON.stringify(opts.savedReplies))]);
  return runAi({
    kind: "reply",
    userId: opts.userId,
    businessId: b.id,
    schema: ReplySchema,
    system: systemPrompt(
      `Draft a reply the owner can send to a customer message. Give exactly 2 options: one labelled "short" and one labelled "friendly". Answer only from the fact sheet and saved replies. Never invent prices, availability, times, or policies; when the answer isn't in the facts, put a bracketed placeholder like [price] or [day and time] and list it in placeholders_to_fill. End with a clear next step: propose a time with a placeholder, or ask one qualifying question. Plain text suitable for SMS, DM or WhatsApp, no hashtags, no links unless they're in the facts.`,
      b,
    ),
    prompt: `${businessContext(b, opts.styleExamples.map((s) => ({ kind: "reply", ...s })))}
<saved_replies>
${JSON.stringify(opts.savedReplies.slice(0, 20))}
</saved_replies>
<selected_service>${opts.service ?? "not specified"}</selected_service>
<customer_message>
${opts.message.slice(0, 2000)}
</customer_message>`,
    effort: "low",
    validate: (out) => {
      if (out.options.length !== 2) return "Give exactly 2 options.";
      for (const o of out.options) {
        const bad = numbers(o.text).filter((n) => !allowed.has(n));
        if (bad.length) return `The number(s) ${bad.join(", ")} aren't in the facts. Use a [placeholder] instead.`;
      }
      return null;
    },
  });
}

// draft_review_request: two sentences max, honest review, no incentives.
export async function draftReviewRequest(opts: { business: Business; userId: string; firstName: string; service: string | null; reviewUrl: string }) {
  const b = opts.business;
  const ctx = safetyContextFor(b);
  return runAi({
    kind: "review_request",
    userId: opts.userId,
    businessId: b.id,
    schema: ReviewRequestSchema,
    effort: "low",
    system: systemPrompt(
      `Write a short, personal review request the owner will send themselves to a customer they really served. Two sentences maximum. Thank the customer by first name, ask for an honest review, and include the review link exactly once. No incentives or rewards, no hints about star ratings, no suggested review text, and don't ask only happy customers. Give one option per channel: sms, whatsapp and email.`,
      b,
    ),
    prompt: `<owner_voice>${JSON.stringify({ voice_notes: b.voice_notes, voice_samples: b.voice_samples.slice(0, 3), business_name: b.name })}</owner_voice>
<customer_first_name>${opts.firstName.slice(0, 40)}</customer_first_name>
<service_done>${opts.service ?? "their recent job"}</service_done>
<review_link>${opts.reviewUrl}</review_link>`,
    validate: (out) => {
      for (const o of out.options) {
        if (!o.text.includes(opts.reviewUrl)) return "Include the review link exactly as given.";
        const sentences = o.text.replace(opts.reviewUrl, "LINK").split(/[.!?]+\s/).filter((s) => s.trim().length > 0);
        if (sentences.length > 3) return "Two sentences maximum.";
        const s = checkSafety({ kind: "review_request", caption: o.text }, ctx);
        const bad = s.findings.find((f) => f.rule_id === "review_incentive_or_gating" || f.rule_id === "guaranteed_results");
        if (bad) return `Not allowed in a review request: "${bad.match}". ${bad.message}`;
      }
      return null;
    },
  });
}
