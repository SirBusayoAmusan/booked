import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSafetyConfig } from "@/lib/safety/config";
import { getPlan } from "@/lib/config/plans";
import { addDays } from "@/lib/utils";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { SafetyRulesEditor } from "./safety-editor";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");

export default async function AdminPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const cohortStart = addDays(now.toISOString().slice(0, 10), -60);

  const [{ data: profiles }, { data: runs }, { data: businesses }, config] = await Promise.all([
    admin.from("profiles").select("user_id, email, plan_id, subscription_status, created_at, updated_at, referred_by"),
    admin.from("ai_runs").select("user_id, cost_usd, tokens_in, tokens_out, status").gte("created_at", monthStart).limit(100000),
    admin.from("businesses").select("id, owner_id, created_at"),
    getSafetyConfig(),
  ]);

  // AI cost per user this month vs plan revenue.
  const cost = new Map<string, { cost: number; runs: number; errors: number; tokens: number }>();
  for (const r of runs ?? []) {
    const c = cost.get(r.user_id) ?? { cost: 0, runs: 0, errors: 0, tokens: 0 };
    c.cost += Number(r.cost_usd ?? 0);
    c.runs += 1;
    c.errors += r.status === "ok" ? 0 : 1;
    c.tokens += (r.tokens_in ?? 0) + (r.tokens_out ?? 0);
    cost.set(r.user_id, c);
  }
  const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const costRows = [...cost.entries()]
    .map(([userId, c]) => {
      const p = profileById.get(userId);
      const paying = p && ["active", "trialing", "past_due"].includes(p.subscription_status);
      const revenue = paying ? getPlan(p!.plan_id).prices.USD : 0;
      return { userId, email: p?.email ?? userId, status: p?.subscription_status ?? "?", plan: p?.plan_id ?? "?", ...c, revenue, share: revenue ? c.cost / revenue : null };
    })
    .sort((a, b) => b.cost - a.cost);
  const totalCost = costRows.reduce((s, r) => s + r.cost, 0);

  // Activation for owners who signed up in the last 60 days.
  const cohort = (businesses ?? []).filter((b) => b.created_at >= cohortStart);
  const ids = cohort.map((b) => b.id);
  const [{ data: posted }, { data: enq }, { data: booked }] = ids.length
    ? await Promise.all([
        admin.from("posts").select("business_id, posted_at").in("business_id", ids).not("posted_at", "is", null),
        admin.from("enquiries").select("business_id, created_at").in("business_id", ids),
        admin.from("enquiries").select("business_id, value_usd").in("business_id", ids).in("status", ["booked", "completed"]),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  let firstPost7 = 0;
  let posts8 = 0;
  let enq3 = 0;
  let bookingWithValue = 0;
  for (const b of cohort) {
    const start = new Date(b.created_at).getTime();
    const within = (iso: string, days: number) => new Date(iso).getTime() - start <= days * 86_400_000;
    const ps = (posted ?? []).filter((p) => p.business_id === b.id);
    if (ps.some((p) => within(p.posted_at!, 7))) firstPost7++;
    if (ps.filter((p) => within(p.posted_at!, 30)).length >= 8) posts8++;
    if ((enq ?? []).filter((e) => e.business_id === b.id && within(e.created_at, 30)).length >= 3) enq3++;
    if ((booked ?? []).some((e) => e.business_id === b.id && e.value_usd !== null)) bookingWithValue++;
  }

  const byStatus: Record<string, number> = {};
  for (const p of profiles ?? []) byStatus[p.subscription_status] = (byStatus[p.subscription_status] ?? 0) + 1;
  const canceled30 = (profiles ?? []).filter((p) => p.subscription_status === "canceled" && p.updated_at >= addDays(now.toISOString().slice(0, 10), -30)).length;
  const everPaid = (byStatus.active ?? 0) + (byStatus.past_due ?? 0) + (byStatus.paused ?? 0) + (byStatus.canceled ?? 0);
  const referred = (profiles ?? []).filter((p) => p.referred_by).length;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <h1 className="text-2xl font-bold">Admin</h1>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Card>
          <CardDescription>First post within 7 days</CardDescription>
          <p className="text-2xl font-bold">{pct(firstPost7, cohort.length)}</p>
          <CardDescription>
            {firstPost7} of {cohort.length} new businesses (60 days)
          </CardDescription>
        </Card>
        <Card>
          <CardDescription>8+ posts in first 30 days</CardDescription>
          <p className="text-2xl font-bold">{pct(posts8, cohort.length)}</p>
        </Card>
        <Card>
          <CardDescription>3+ enquiries in first 30 days</CardDescription>
          <p className="text-2xl font-bold">{pct(enq3, cohort.length)}</p>
        </Card>
        <Card>
          <CardDescription>Logged a booking with a value</CardDescription>
          <p className="text-2xl font-bold">{pct(bookingWithValue, cohort.length)}</p>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardTitle>Subscriptions</CardTitle>
          <ul className="mt-2 text-sm">
            {Object.entries(byStatus).map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span>{k}</span>
                <span className="font-semibold">{v}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>Churn</CardTitle>
          <p className="mt-2 text-2xl font-bold">{canceled30}</p>
          <CardDescription>Canceled in the last 30 days (by last update). {pct(byStatus.canceled ?? 0, everPaid)} of everyone who reached a paid state has canceled.</CardDescription>
        </Card>
        <Card>
          <CardTitle>AI cost this month</CardTitle>
          <p className="mt-2 text-2xl font-bold">${totalCost.toFixed(2)}</p>
          <CardDescription>Target: under 15% of plan revenue per user. {referred} accounts came from affiliates.</CardDescription>
        </Card>
      </div>

      <Card className="mt-3 overflow-x-auto">
        <CardTitle>AI cost per user (this month)</CardTitle>
        <table className="mt-2 w-full min-w-[640px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1">User</th>
              <th>Plan</th>
              <th>Status</th>
              <th className="text-right">Runs</th>
              <th className="text-right">Errors</th>
              <th className="text-right">Tokens</th>
              <th className="text-right">Cost</th>
              <th className="text-right">% of plan</th>
            </tr>
          </thead>
          <tbody>
            {costRows.slice(0, 200).map((r) => (
              <tr key={r.userId} className="border-t border-border">
                <td className="py-1">{r.email}</td>
                <td>{r.plan}</td>
                <td>{r.status}</td>
                <td className="text-right">{r.runs}</td>
                <td className="text-right">{r.errors}</td>
                <td className="text-right">{r.tokens.toLocaleString()}</td>
                <td className="text-right">${r.cost.toFixed(2)}</td>
                <td className={r.share !== null && r.share > 0.15 ? "text-right font-semibold text-destructive" : "text-right"}>{r.share === null ? "–" : `${(r.share * 100).toFixed(1)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mt-3 flex flex-col gap-2">
        <CardTitle>Safety rules</CardTitle>
        <CardDescription>
          Version {config.version}, last verified {config.last_verified}. Platform policies change: re-check and bump the date regularly.
        </CardDescription>
        <SafetyRulesEditor initial={config} />
      </Card>
    </main>
  );
}
