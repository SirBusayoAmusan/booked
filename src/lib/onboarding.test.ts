import { describe, expect, it } from "vitest";
import { answersToBusinessPatch } from "./onboarding";
import { getFoundItemsForToday, initialChecklistState, nextChecklistItems } from "./config/checklist";

describe("answersToBusinessPatch", () => {
  it("maps country to locale and currency", () => {
    expect(answersToBusinessPatch({ country: "UK" })).toMatchObject({ country: "UK", locale: "en-GB", currency: "GBP" });
  });
  it("splits lists and drops empty services", () => {
    const p = answersToBusinessPatch({
      neighbourhoods: "Hyde Park, Mueller,\nEast Side",
      services: [
        { name: "Full detail", price_or_range: "$180", duration: "3h", notes: null },
        { name: "  ", price_or_range: null, duration: null, notes: null },
      ],
    });
    expect(p.neighbourhoods).toEqual(["Hyde Park", "Mueller", "East Side"]);
    expect(p.services).toHaveLength(1);
  });
  it("rejects non-URL booking links and marks presence", () => {
    const p = answersToBusinessPatch({ booking_tool: "square", external_booking_url: "not a url", google_review_url: "https://g.page/r/abc" });
    expect(p.external_booking_url).toBeNull();
    expect(p.presence).toMatchObject({ booking_tool: true, review_link: true });
  });
  it("ignores unknown platforms and clamps weekly hours", () => {
    const p = answersToBusinessPatch({ platforms: ["instagram", "myspace"], weekly_hours: 99 });
    expect(p.platforms).toEqual(["instagram"]);
    expect(p.weekly_hours_available).toBe(10);
  });
});

describe("Get Found checklist", () => {
  it("shows at most 3 items and respects dependencies", () => {
    const state = initialChecklistState({}, false);
    const items = nextChecklistItems(state, { trade: "barber" });
    expect(items.length).toBeLessThanOrEqual(3);
    expect(items.map((i) => i.id)).not.toContain("gbp_basics");
    expect(items.map((i) => i.id)).not.toContain("review_link");
  });
  it("marks items done from the presence assessment", () => {
    const state = initialChecklistState({ google_business: true }, true);
    expect(state.claim_gbp).toBe("done");
    expect(state.review_link).toBe("done");
    const ids = nextChecklistItems(state, { limit: 10 }).map((i) => i.id);
    expect(ids).toContain("gbp_basics");
  });
  it("only suggests a Facebook page for trades that benefit", () => {
    const all = { public_page_live: "done", contact_buttons: "done", claim_gbp: "done", gbp_basics: "done", review_link: "done", proof_photos: "done", qr_card: "done" };
    expect(nextChecklistItems(all, { trade: "barber" })).toHaveLength(0);
    expect(nextChecklistItems(all, { trade: "window cleaning" }).map((i) => i.id)).toEqual(["facebook_page"]);
  });
  it("uses AI guidance text when present", () => {
    const items = getFoundItemsForToday("b1", { status: {}, guidance: [{ id: "public_page_live", why_it_matters: "Custom", time_estimate_minutes: 5 }] }, null);
    expect(items[0]).toMatchObject({ id: "public_page_live", why_it_matters: "Custom", href: "/business/b1/page" });
  });
});
