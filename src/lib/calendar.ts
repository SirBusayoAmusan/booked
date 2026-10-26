import { addDays, nextMonthStart, weekStart } from "@/lib/utils";
import type { Business, Platform } from "@/lib/types";

// Monday-start weeks that overlap the month. Weeks that end before `today`
// are skipped, so a mid-month calendar only plans what's left.
export function weeksForMonth(monthStartIso: string, todayIso: string) {
  const end = nextMonthStart(monthStartIso);
  const weeks: { week_start: string; from: string; to: string }[] = [];
  for (let ws = weekStart(new Date(monthStartIso + "T00:00:00Z")); ws < end; ws = addDays(ws, 7)) {
    const from = [ws, monthStartIso, todayIso].sort().at(-1)!;
    const to = [addDays(ws, 6), addDays(end, -1)].sort()[0];
    if (from <= to) weeks.push({ week_start: ws, from, to });
  }
  return weeks;
}

// Primary-platform posts per week, from the owner's real time budget.
export function cadenceFor(weeklyHours: number) {
  if (weeklyHours <= 0.5) return 3;
  if (weeklyHours <= 1) return 3;
  return 4;
}

// Shoot Day cap in minutes: 20 to 40, never more than half the weekly budget.
export function shootBudgetMinutes(weeklyHours: number) {
  return Math.max(15, Math.min(40, Math.round((weeklyHours * 60) / 2)));
}

// Platforms Booked may plan for, given what the owner actually has.
export function allowedPlatforms(b: Pick<Business, "platforms" | "presence" | "whatsapp_number">, gbpPack: boolean): Platform[] {
  const p = new Set(b.platforms ?? []);
  const out: Platform[] = [];
  if (p.has("instagram") || b.presence?.instagram) out.push("instagram");
  // No Facebook posts until a page exists.
  if (b.presence?.facebook) out.push("facebook");
  if (p.has("tiktok")) out.push("tiktok");
  if (gbpPack && b.presence?.google_business) out.push("google_business");
  if (p.has("whatsapp_status") && b.whatsapp_number) out.push("whatsapp_status");
  if (out.length === 0 || out.every((x) => x === "google_business" || x === "whatsapp_status")) out.unshift("instagram");
  return out;
}

export const ON_CAMERA_RE = /\b(talking (head|to (the )?camera)|to camera|face (to|on) camera|selfie video|piece to camera|you on camera|film yourself (talking|speaking))\b/i;
