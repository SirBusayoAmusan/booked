import "server-only";
import { timingSafeEqual } from "node:crypto";

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
export function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

// Local hour (0-23) and weekday (0 = Sunday) in an IANA timezone.
export function localClock(timezone: string, at = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(at);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
    return { hour, weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd) };
  } catch {
    return { hour: at.getUTCHours(), weekday: at.getUTCDay() };
  }
}
