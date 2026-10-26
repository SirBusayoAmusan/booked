import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SAFETY_CONFIG, type SafetyConfig } from "./safety";

// Rules can be updated from the admin screen without a deploy: the newest
// safety_rules_meta row with a valid `rules` payload wins over rules.json.
export const getSafetyConfig = cache(async (): Promise<SafetyConfig> => {
  try {
    const { data } = await createAdminClient()
      .from("safety_rules_meta")
      .select("version, last_verified, rules")
      .not("rules", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const rules = data?.rules as Partial<SafetyConfig> | null;
    if (rules && Array.isArray(rules.rules) && rules.rules.length > 0) {
      return { ...DEFAULT_SAFETY_CONFIG, ...rules, version: data!.version, last_verified: data!.last_verified } as SafetyConfig;
    }
  } catch {
    // Fall back to the bundled rules.
  }
  return DEFAULT_SAFETY_CONFIG;
});
