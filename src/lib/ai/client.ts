import "server-only";
import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { AI_PRICING_PER_MTOK } from "@/lib/config/plans";

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

// Models that accept the server-side refusal fallback in its "default" form.
const FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"]);

export class AiError extends Error {
  constructor(
    public userMessage: string,
    public code: "rate_limited" | "limit_reached" | "not_allowed" | "failed" | "refused" | "config",
  ) {
    super(userMessage);
  }
}

let client: Anthropic | null = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError("AI isn't set up yet. Add ANTHROPIC_API_KEY.", "config");
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
  return client;
}

export function hashInput(...parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function cost(model: string, tokensIn: number, tokensOut: number) {
  const p = AI_PRICING_PER_MTOK[model] ?? AI_PRICING_PER_MTOK["claude-sonnet-5-5"];
  return (tokensIn * p.input + tokensOut * p.output) / 1_000_000;
}

// Per-user hourly cap on AI calls, on top of monthly plan limits.
const AI_CALLS_PER_HOUR = 60;

export type RunAiOptions<S extends z.ZodType> = {
  kind: string;
  userId: string;
  businessId: string | null;
  system: string;
  prompt: string;
  schema: S;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
  // Reuse a previous successful output for identical input (cost control).
  cache?: boolean;
  // Extra checks beyond the schema. Return an error message to trigger a retry.
  validate?: (out: z.infer<S>) => string | null;
};

// Runs one structured AI call: cache lookup, rate limit, call, Zod validation,
// one retry on validation failure, token + cost logging to ai_runs.
export async function runAi<S extends z.ZodType>(opts: RunAiOptions<S>): Promise<z.infer<S>> {
  const admin = createAdminClient();
  const model = AI_MODEL;
  const inputHash = hashInput(opts.kind, model, opts.system, opts.prompt);

  if (opts.cache) {
    const { data: cached } = await admin
      .from("ai_runs")
      .select("output")
      .eq("kind", opts.kind)
      .eq("input_hash", inputHash)
      .eq("status", "ok")
      .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached?.output) {
      const parsed = opts.schema.safeParse(cached.output);
      if (parsed.success) return parsed.data;
    }
  }

  const { data: allowed } = await admin.rpc("hit_rate_limit", {
    p_key: `ai:${opts.userId}`,
    p_window_seconds: 3600,
    p_max: AI_CALLS_PER_HOUR,
  });
  if (allowed === false) throw new AiError("You've made a lot of requests this hour. Try again in a little while.", "rate_limited");

  const anthropic = getClient();
  let prompt = opts.prompt;
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    let tokensIn = 0;
    let tokensOut = 0;
    try {
      const response = await anthropic.beta.messages.parse({
        model,
        max_tokens: opts.maxTokens ?? 16000,
        system: opts.system,
        messages: [{ role: "user", content: prompt }],
        output_config: { format: betaZodOutputFormat(opts.schema), effort: opts.effort ?? "medium" },
        ...(FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      });
      tokensIn = response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0);
      tokensOut = response.usage.output_tokens;

      if (response.stop_reason === "refusal") {
        await logRun(admin, opts, inputHash, model, tokensIn, tokensOut, "refused", "refusal", null);
        throw new AiError("We couldn't draft that one. Try rewording it.", "refused");
      }
      if (response.stop_reason === "max_tokens") throw new Error("Output was cut off (max_tokens).");

      const checked = opts.schema.safeParse(response.parsed_output);
      if (!checked.success) throw new Error("Schema validation failed: " + checked.error.message.slice(0, 500));
      const extra = opts.validate?.(checked.data);
      if (extra) throw new Error(extra);

      await logRun(admin, opts, inputHash, model, tokensIn, tokensOut, "ok", null, checked.data);
      return checked.data;
    } catch (err) {
      if (err instanceof AiError) throw err;
      lastError = err instanceof Error ? err.message : String(err);
      await logRun(admin, opts, inputHash, model, tokensIn, tokensOut, "error", lastError.slice(0, 1000), null);
      if (err instanceof Anthropic.RateLimitError) {
        throw new AiError("Our AI provider is busy. Try again in a minute.", "rate_limited");
      }
      if (err instanceof Anthropic.APIError && (err.status ?? 0) < 500 && err.status !== 408) {
        throw new AiError("Something went wrong drafting this. Please try again.", "failed");
      }
      // Retry once, telling the model what was wrong.
      prompt = `${opts.prompt}\n\nYour previous answer was rejected: ${lastError.slice(0, 400)}\nReturn valid JSON that follows every rule.`;
    }
  }
  throw new AiError("We couldn't finish this draft. Please try again in a moment.", "failed");
}

async function logRun(
  admin: ReturnType<typeof createAdminClient>,
  opts: { kind: string; userId: string; businessId: string | null },
  inputHash: string,
  model: string,
  tokensIn: number,
  tokensOut: number,
  status: string,
  error: string | null,
  output: unknown,
) {
  await admin.from("ai_runs").insert({
    kind: opts.kind,
    user_id: opts.userId,
    business_id: opts.businessId,
    input_hash: inputHash,
    model,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: cost(model, tokensIn, tokensOut),
    status,
    error,
    output: output ?? null,
  });
}
