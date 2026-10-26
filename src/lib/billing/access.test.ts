import { describe, expect, it } from "vitest";
import { getAccess } from "./access";
import { mapWhopStatus } from "./status";

const now = new Date("2026-10-26T12:00:00Z");
const base = { plan_id: "solo" as const, past_due_since: null, trial_ends_at: null };

describe("access rules per subscription state", () => {
  it("trialing gets full access on the trial plan", () => {
    const a = getAccess({ ...base, subscription_status: "trialing", trial_ends_at: "2026-10-30T00:00:00Z" }, now);
    expect(a.canGenerate).toBe(true);
    expect(a.plan.id).toBe("growth");
  });
  it("active gets full access within plan limits", () => {
    const a = getAccess({ ...base, subscription_status: "active" }, now);
    expect(a).toMatchObject({ canGenerate: true, readOnly: false, banner: null });
    expect(a.plan.limits.reply_helper_runs_per_month).toBe(60);
  });
  it("past_due keeps generating for 3 days, then stops, always with a banner", () => {
    const inGrace = getAccess({ ...base, subscription_status: "past_due", past_due_since: "2026-10-25T12:00:00Z" }, now);
    expect(inGrace.canGenerate).toBe(true);
    expect(inGrace.banner?.tone).toBe("danger");
    const after = getAccess({ ...base, subscription_status: "past_due", past_due_since: "2026-10-22T12:00:00Z" }, now);
    expect(after.canGenerate).toBe(false);
    expect(after.readOnly).toBe(false);
  });
  it("canceled, paused and none are read-only", () => {
    for (const s of ["canceled", "paused", "none"] as const) {
      const a = getAccess({ ...base, subscription_status: s }, now);
      expect(a.canGenerate).toBe(false);
      expect(a.readOnly).toBe(true);
    }
  });
});

describe("Whop status mapping", () => {
  it("maps membership states", () => {
    expect(mapWhopStatus({ status: "trialing" })).toBe("trialing");
    expect(mapWhopStatus({ status: "active" })).toBe("active");
    expect(mapWhopStatus({ status: "past_due" })).toBe("past_due");
    expect(mapWhopStatus({ status: "unresolved" })).toBe("past_due");
    expect(mapWhopStatus({ status: "canceled" })).toBe("canceled");
    expect(mapWhopStatus({ status: "expired" })).toBe("canceled");
    expect(mapWhopStatus({ status: "active", most_recent_action: "paused_at" })).toBe("paused");
  });
});
