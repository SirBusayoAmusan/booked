import { describe, expect, it } from "vitest";
import { contactKind, csvEscape, isOverdue } from "./enquiries";
import { reviewLinkFor, reviewTemplates } from "./reviews";
import { checkSafety, safetyContextFor } from "./safety/safety";

describe("enquiries", () => {
  const now = new Date("2026-10-26T12:00:00Z").getTime();
  it("flags new, uncontacted enquiries older than the owner's limit", () => {
    expect(isOverdue({ status: "new", first_contacted_at: null, created_at: "2026-10-26T09:00:00Z" }, 2, now)).toBe(true);
    expect(isOverdue({ status: "new", first_contacted_at: null, created_at: "2026-10-26T11:00:00Z" }, 2, now)).toBe(false);
    expect(isOverdue({ status: "contacted", first_contacted_at: "2026-10-26T09:30:00Z", created_at: "2026-10-26T09:00:00Z" }, 2, now)).toBe(false);
  });
  it("detects phone and email contacts", () => {
    expect(contactKind("+1 (512) 555-0134")).toBe("phone");
    expect(contactKind("sam@example.com")).toBe("email");
    expect(contactKind("@samdetails")).toBe("other");
  });
  it("escapes CSV and neutralises formulas", () => {
    expect(csvEscape('a "b", c')).toBe('"a ""b"", c"');
    expect(csvEscape("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvEscape(null)).toBe("");
  });
});

describe("review kit", () => {
  it("prefers Google and falls back to other platforms", () => {
    expect(reviewLinkFor({ google_review_url: "https://g.page/r/x", review_platforms: [] })).toEqual({ platform: "google", url: "https://g.page/r/x" });
    expect(reviewLinkFor({ google_review_url: null, review_platforms: [{ platform: "facebook", url: "https://fb.com/x/reviews" }] })?.platform).toBe("facebook");
    expect(reviewLinkFor({ google_review_url: null, review_platforms: [] })).toBeNull();
  });
  it("templates pass the no-incentive, no-gating rule", () => {
    const ctx = safetyContextFor({});
    for (const t of reviewTemplates("Sam", "Shine Time", "https://g.page/r/x")) {
      const ids = checkSafety({ kind: "review_request", caption: t.text }, ctx).findings.map((f) => f.rule_id);
      expect(ids).not.toContain("review_incentive_or_gating");
      expect(t.text).toContain("https://g.page/r/x");
    }
  });
});
