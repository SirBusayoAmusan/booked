import { describe, expect, it } from "vitest";
import { allowedPlatforms, cadenceFor, shootBudgetMinutes, weeksForMonth } from "./calendar";

describe("weeksForMonth", () => {
  it("covers the whole month in Monday weeks", () => {
    const w = weeksForMonth("2026-11-01", "2026-10-26");
    expect(w[0]).toEqual({ week_start: "2026-10-26", from: "2026-11-01", to: "2026-11-01" });
    expect(w.at(-1)!.to).toBe("2026-11-30");
    expect(w).toHaveLength(6);
  });
  it("skips past weeks mid-month", () => {
    const w = weeksForMonth("2026-10-01", "2026-10-26");
    expect(w).toEqual([{ week_start: "2026-10-26", from: "2026-10-26", to: "2026-10-31" }]);
  });
});

describe("budgets", () => {
  it("fits cadence and shoot time to weekly hours", () => {
    expect(cadenceFor(0.5)).toBe(3);
    expect(cadenceFor(3)).toBe(4);
    expect(shootBudgetMinutes(0.5)).toBe(15);
    expect(shootBudgetMinutes(1)).toBe(30);
    expect(shootBudgetMinutes(5)).toBe(40);
  });
});

describe("allowedPlatforms", () => {
  const base = { whatsapp_number: null };
  it("skips Google and Facebook when the owner has neither", () => {
    expect(allowedPlatforms({ ...base, platforms: ["instagram", "facebook", "google_business"], presence: { instagram: true } }, true)).toEqual(["instagram"]);
  });
  it("adds Google posts only with a profile and the GBP pack", () => {
    const b = { ...base, platforms: ["instagram"], presence: { instagram: true, google_business: true } };
    expect(allowedPlatforms(b, true)).toContain("google_business");
    expect(allowedPlatforms(b, false)).not.toContain("google_business");
  });
  it("falls back to Instagram when nothing else is available", () => {
    expect(allowedPlatforms({ ...base, platforms: [], presence: {} }, false)).toEqual(["instagram"]);
  });
});
