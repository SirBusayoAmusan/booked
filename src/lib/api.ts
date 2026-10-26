import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AiError } from "@/lib/ai/client";
import type { Business, Profile } from "@/lib/types";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S> | null> {
  try {
    const raw = await request.json();
    const parsed = schema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// Authenticated route context: the user's Supabase client (RLS applies) and,
// when a businessId is given, the business they own.
export async function routeAuth(businessId?: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, res: error("Please sign in.", 401) };
  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (!profile) return { ok: false as const, res: error("Profile not found.", 404) };
  let business: Business | null = null;
  if (businessId) {
    const { data } = await supabase.from("businesses").select("*").eq("id", businessId).maybeSingle();
    if (!data) return { ok: false as const, res: error("Business not found.", 404) };
    business = data as Business;
  }
  return { ok: true as const, supabase, user, profile: profile as Profile, business: business as Business };
}

export function aiErrorResponse(err: unknown) {
  if (err instanceof AiError) {
    const status = err.code === "rate_limited" ? 429 : err.code === "limit_reached" || err.code === "not_allowed" ? 403 : 502;
    return error(err.userMessage, status, err.code);
  }
  console.error(err);
  return error("Something went wrong. Please try again.", 500);
}
