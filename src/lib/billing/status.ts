import type { SubscriptionStatus } from "@/lib/types";

// Maps a Whop membership onto Booked's subscription states.
export function mapWhopStatus(m: { status: string; most_recent_action?: string | null }): SubscriptionStatus {
  if (m.most_recent_action === "paused_at" && (m.status === "active" || m.status === "trialing" || m.status === "past_due")) return "paused";
  switch (m.status) {
    case "trialing":
      return "trialing";
    case "active":
    case "completed":
      return "active";
    case "past_due":
    case "unresolved":
      return "past_due";
    case "canceled":
    case "expired":
      return "canceled";
    default:
      return "canceled";
  }
}
