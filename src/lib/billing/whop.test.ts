import { beforeEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "standardwebhooks";

const inserted: string[] = [];
const deleted: string[] = [];
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: async (row: { event_id: string }) => {
        if (inserted.includes(row.event_id)) return { error: { code: "23505", message: "duplicate" } };
        inserted.push(row.event_id);
        return { error: null };
      },
      delete: () => ({ eq: async (_k: string, v: string) => void deleted.push(v) }),
    }),
  }),
}));

const SECRET = "ws_" + Buffer.from("booked-test-secret-booked-test-secret").toString("hex");

function signed(body: object, id = "msg_1") {
  const payload = JSON.stringify(body);
  const ts = new Date();
  const wh = new Webhook(Buffer.from(SECRET).toString("base64"));
  const signature = wh.sign(id, ts, payload);
  return { payload, headers: { "webhook-id": id, "webhook-timestamp": String(Math.floor(ts.getTime() / 1000)), "webhook-signature": signature } };
}

describe("Whop webhook handling", () => {
  beforeEach(() => {
    process.env.WHOP_WEBHOOK_SECRET = SECRET;
    inserted.length = 0;
    deleted.length = 0;
  });

  it("rejects unsigned and tampered requests", async () => {
    const { whopProvider } = await import("./whop");
    const r1 = await whopProvider.handleWebhook(JSON.stringify({ type: "membership.updated", data: {} }), {});
    expect(r1).toMatchObject({ ok: false, status: 401 });
    const s = signed({ type: "other.event", data: {} });
    const r2 = await whopProvider.handleWebhook(s.payload.replace("other", "tampered"), s.headers);
    expect(r2).toMatchObject({ ok: false, status: 401 });
  });

  it("accepts a valid signature and treats a replay as a duplicate", async () => {
    const { whopProvider } = await import("./whop");
    const s = signed({ type: "other.event", data: {} }, "msg_replay");
    const first = await whopProvider.handleWebhook(s.payload, s.headers);
    expect(first).toMatchObject({ ok: true });
    const second = await whopProvider.handleWebhook(s.payload, s.headers);
    expect(second).toMatchObject({ ok: true, duplicate: true });
  });
});
