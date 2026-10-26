// Get Found checklist. Guidance only: the owner does every step on each
// platform themselves. Booked never creates or verifies accounts.
export type ChecklistItemId =
  | "claim_gbp"
  | "gbp_basics"
  | "public_page_live"
  | "contact_buttons"
  | "facebook_page"
  | "review_link"
  | "qr_card"
  | "proof_photos";

export type ChecklistItem = {
  id: ChecklistItemId;
  title: string;
  why_it_matters: string;
  time_estimate_minutes: number;
  depends_on: ChecklistItemId | null;
  optional?: boolean;
  notes?: string;
  href?: (businessId: string) => string;
};

export const CHECKLIST_DISCLAIMER =
  "This is guidance, not instructions from the platforms. Google, Facebook and Instagram set their own rules and verification steps, and they change. Follow each platform's own instructions.";

export const GET_FOUND_CHECKLIST: ChecklistItem[] = [
  {
    id: "public_page_live",
    title: "Publish your Booked page and put it in your Instagram and Facebook bio",
    why_it_matters: "It gives people one place to see your services and contact you, even without a website.",
    time_estimate_minutes: 10,
    depends_on: null,
    href: (id) => `/business/${id}/page`,
  },
  {
    id: "contact_buttons",
    title: "Turn on Call, Text and enquiry buttons on your page",
    why_it_matters: "Most people want to message or call. One tap makes that easy.",
    time_estimate_minutes: 5,
    depends_on: null,
    href: (id) => `/business/${id}/page`,
  },
  {
    id: "claim_gbp",
    title: "Claim your Google Business Profile",
    why_it_matters: "Local customers search Google and Maps before they book. A profile is free.",
    time_estimate_minutes: 20,
    depends_on: null,
    notes:
      "Free from Google. Google requires verification and the method varies, so it can take a few days. Only for real businesses with a real location or service area. Never use a fake address.",
  },
  {
    id: "gbp_basics",
    title: "Fill in categories, services, hours, service area and 5 or more real photos",
    why_it_matters: "A complete profile is easier for customers to trust and choose.",
    time_estimate_minutes: 30,
    depends_on: "claim_gbp",
  },
  {
    id: "review_link",
    title: "Copy your Google review link into Booked",
    why_it_matters: "Your Review Kit uses it for QR cards and review requests.",
    time_estimate_minutes: 5,
    depends_on: "claim_gbp",
    href: (id) => `/business/${id}/reviews`,
  },
  {
    id: "proof_photos",
    title: "Collect 5 to 10 photos of real work, with permission where people appear",
    why_it_matters: "Real photos are your best proof. They feed your posts and your page.",
    time_estimate_minutes: 20,
    depends_on: null,
  },
  {
    id: "qr_card",
    title: "Print your QR card and keep it where you work",
    why_it_matters: "Customers can find your page or leave a review in one scan.",
    time_estimate_minutes: 10,
    depends_on: "public_page_live",
    href: (id) => `/business/${id}/reviews`,
  },
  {
    id: "facebook_page",
    title: "Create or tidy your Facebook page (name, photo, hours, contact)",
    why_it_matters: "Many local customers check Facebook for hours and recommendations.",
    time_estimate_minutes: 15,
    depends_on: null,
    optional: true,
  },
];

export type Presence = {
  google_business?: boolean;
  facebook?: boolean;
  instagram?: boolean;
  website?: boolean;
  booking_tool?: boolean;
  card_payments?: boolean;
  review_link?: boolean;
  website_url?: string;
  instagram_handle?: string;
  facebook_url?: string;
};

// Trades where a Facebook page tends to matter enough to suggest one.
const FACEBOOK_TRADES = ["clean", "landscap", "plumb", "electric", "mechanic", "detail", "groom", "rental", "wash", "handyman"];

export function tradeBenefitsFromFacebook(trade: string | null | undefined) {
  const t = (trade ?? "").toLowerCase();
  return FACEBOOK_TRADES.some((k) => t.includes(k));
}

// Items already satisfied by the presence assessment start as done.
export function initialChecklistState(presence: Presence, hasReviewLink: boolean): Record<string, "done" | "todo" | "hidden"> {
  return {
    claim_gbp: presence.google_business ? "done" : "todo",
    gbp_basics: presence.google_business ? "todo" : "todo",
    public_page_live: "todo",
    contact_buttons: "todo",
    facebook_page: presence.facebook ? "done" : "todo",
    review_link: hasReviewLink ? "done" : "todo",
    qr_card: "todo",
    proof_photos: "todo",
  };
}

// Next 2 to 3 open items whose dependencies are done.
export function nextChecklistItems(
  state: Record<string, string>,
  opts: { trade?: string | null; limit?: number } = {},
): ChecklistItem[] {
  const limit = opts.limit ?? 3;
  return GET_FOUND_CHECKLIST.filter((item) => {
    const s = state[item.id];
    if (s === "done" || s === "hidden") return false;
    if (item.id === "facebook_page" && !tradeBenefitsFromFacebook(opts.trade)) return false;
    if (item.depends_on && state[item.depends_on] !== "done") return false;
    return true;
  }).slice(0, limit);
}

// Items for the Today card: next open items, using AI-written guidance text
// when it exists, and resolving links for this business.
export function getFoundItemsForToday(
  businessId: string,
  checklist: { status?: Record<string, string>; guidance?: { id: string; why_it_matters: string; time_estimate_minutes: number }[] | null },
  trade: string | null,
) {
  const guidance = new Map((checklist.guidance ?? []).map((g) => [g.id, g]));
  return nextChecklistItems(checklist.status ?? {}, { trade, limit: 3 }).map((i) => {
    const g = guidance.get(i.id);
    return {
      id: i.id,
      title: i.title,
      why_it_matters: g?.why_it_matters || i.why_it_matters,
      time_estimate_minutes: i.time_estimate_minutes,
      notes: i.notes,
      href: i.href?.(businessId),
    };
  });
}
