import { z } from "zod";
import { aiErrorResponse, error, json, parseBody, routeAuth } from "@/lib/api";
import { buildWeeklyReview } from "@/lib/weekly";
import { addDays, todayIn, weekStart } from "@/lib/utils";

export const maxDuration = 60;

const Body = z.object({ businessId: z.string().uuid(), weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return error("Invalid input.");
  const auth = await routeAuth(body.businessId);
  if (!auth.ok) return auth.res;
  const ws = body.weekStart ? weekStart(new Date(body.weekStart + "T00:00:00Z")) : addDays(weekStart(new Date(todayIn(auth.business.timezone) + "T00:00:00Z")), -7);
  try {
    const review = await buildWeeklyReview(auth.supabase, auth.business, auth.profile, ws);
    return json({ review });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
