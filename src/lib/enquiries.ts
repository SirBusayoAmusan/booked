export const FOUND_VIA = [
  { id: "code_word", label: "Said a code word" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
  { id: "google", label: "Google" },
  { id: "referral", label: "Word of mouth" },
  { id: "repeat", label: "Repeat customer" },
  { id: "walk_in", label: "Walk-in or saw the van" },
  { id: "other", label: "Other / not sure" },
] as const;

export type FoundVia = (typeof FOUND_VIA)[number]["id"];

export const STATUS_LABEL = { new: "New", contacted: "Contacted", booked: "Booked", completed: "Completed", lost: "Lost" } as const;

export const SOURCE_LABEL: Record<string, string> = {
  tracked_link: "Tracked link",
  public_page: "Your page",
  code_word: "Code word / post",
  manual: "Logged by you",
};

export function isOverdue(e: { status: string; first_contacted_at: string | null; created_at: string }, overdueHours: number, now = Date.now()) {
  return e.status === "new" && !e.first_contacted_at && now - new Date(e.created_at).getTime() > overdueHours * 3_600_000;
}

// Phone-like contacts get Call/Text/WhatsApp buttons; emails get a mail link.
export function contactKind(contact: string | null): "phone" | "email" | "other" {
  if (!contact) return "other";
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.trim())) return "email";
  if ((contact.match(/\d/g) ?? []).length >= 7 && /^[\d\s+()\-.]+$/.test(contact.trim())) return "phone";
  return "other";
}

export function csvEscape(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
