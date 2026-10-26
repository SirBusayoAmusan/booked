import "server-only";
import { createHash } from "node:crypto";

// We never store raw IPs. Hashes are salted and rotate daily, so they can
// rate-limit and de-duplicate but can't be joined across days.
export function privacyHash(value: string, scope = "") {
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`${process.env.IP_HASH_SALT ?? "booked"}|${scope}|${day}|${value}`)
    .digest("hex")
    .slice(0, 32);
}

export function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
