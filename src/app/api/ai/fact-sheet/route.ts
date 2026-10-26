import { z } from "zod";
import { aiErrorResponse, error, json, parseBody, routeAuth } from "@/lib/api";
import { buildFactSheet } from "@/lib/ai/onboarding-fns";
import { assertCanRun } from "@/lib/limits";

export const maxDuration = 60;

const Body = z.object({ businessId: z.string().uuid() });

export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return error("Invalid input.");
  const auth = await routeAuth(body.businessId);
  if (!auth.ok) return auth.res;
  try {
    await assertCanRun(auth.supabase, auth.profile, "fact_sheet", auth.business.id);
    const factSheet = await buildFactSheet(auth.business, auth.user.id);
    const { error: err } = await auth.supabase
      .from("businesses")
      .update({
        fact_sheet: factSheet,
        services: factSheet.services,
        opening_hours: factSheet.opening_hours,
        service_area: factSheet.service_area || auth.business.service_area,
      })
      .eq("id", auth.business.id);
    if (err) return error("Couldn't save your fact sheet.", 500);
    return json({ factSheet });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
