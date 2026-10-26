import { z } from "zod";
import { error, json, parseBody, routeAuth } from "@/lib/api";
import { BillingError, getBillingProvider } from "@/lib/billing";

const Body = z.object({ action: z.enum(["pause", "resume", "cancel", "undo_cancel"]) });

// Pause (quiet season), resume, cancel at period end, or undo a cancel.
export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return error("Invalid input.");
  const auth = await routeAuth();
  if (!auth.ok) return auth.res;
  try {
    await getBillingProvider().cancelOrPause(auth.user.id, body.action);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof BillingError) return error(e.userMessage, e.status);
    console.error(e);
    return error("Couldn't update your subscription. Try the billing page instead.", 502);
  }
}
