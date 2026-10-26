import { z } from "zod";
import { aiErrorResponse, error, json, parseBody, routeAuth } from "@/lib/api";
import { generatePositioning, generateSetupGuidance } from "@/lib/ai/onboarding-fns";
import { assertCanRun } from "@/lib/limits";
import { initialChecklistState } from "@/lib/config/checklist";

export const maxDuration = 60;

const Body = z.object({ businessId: z.string().uuid() });

// Generates positioning and, alongside it, the Get Found checklist. Marks
// onboarding complete; the owner then reviews and confirms both.
export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return error("Invalid input.");
  const auth = await routeAuth(body.businessId);
  if (!auth.ok) return auth.res;
  const b = auth.business;
  try {
    await assertCanRun(auth.supabase, auth.profile, "positioning", b.id);
    const [positioning, guidance] = await Promise.all([
      generatePositioning(b, auth.user.id),
      generateSetupGuidance(b, auth.user.id).catch(() => null),
    ]);
    const status = { ...initialChecklistState(b.presence ?? {}, Boolean(b.google_review_url)), ...(b.setup_checklist_state?.status ?? {}) };
    const { error: err } = await auth.supabase
      .from("businesses")
      .update({
        positioning_summary: positioning,
        setup_checklist_state: { status, guidance: guidance?.checklist_items ?? null },
        onboarding_completed_at: b.onboarding_completed_at ?? new Date().toISOString(),
      })
      .eq("id", b.id);
    if (err) return error("Couldn't save your positioning.", 500);
    return json({ positioning });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
