import type { Metadata } from "next";
import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { formatDate } from "@/lib/config/locale";
import { addDays } from "@/lib/utils";
import type { Post, ShootDay } from "@/lib/types";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PlatformBadge } from "@/components/post-badges";
import { ShootChecklist } from "./checklist";

export const metadata: Metadata = { title: "Shoot Day" };

export default async function ShootDayPage(props: PageProps<"/business/[id]/shoot/[weekStart]">) {
  const { id, weekStart } = await props.params;
  const { supabase, business } = await requireBusiness(id);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(weekStart);
  const { data: sdData } = valid
    ? await supabase.from("shoot_days").select("*, calendars!inner(status)").eq("business_id", id).eq("week_start", weekStart).neq("calendars.status", "archived").order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const shootDay = sdData as (ShootDay & { calendars?: unknown }) | null;

  const { data: postsData } = valid
    ? await supabase.from("posts").select("id, hook, platform, publish_date, no_filming, status, shot_list").eq("business_id", id).gte("publish_date", weekStart).lte("publish_date", addDays(weekStart, 6)).order("publish_date")
    : { data: [] };
  const posts = (postsData ?? []) as Pick<Post, "id" | "hook" | "platform" | "publish_date" | "no_filming" | "status" | "shot_list">[];
  const fallback = posts.filter((p) => p.no_filming);

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/business/${id}/today`} className="text-sm text-muted-foreground">
        ← Today
      </Link>
      <div>
        <h1 className="text-xl font-bold">Shoot Day</h1>
        <p className="text-sm text-muted-foreground">Week of {valid ? formatDate(weekStart, business.locale, { day: "numeric", month: "long" }) : ""}</p>
      </div>

      {!shootDay ? (
        <Card>
          <CardTitle>No shoot planned this week</CardTitle>
          <CardDescription>This week&apos;s posts don&apos;t need filming, or there&apos;s no plan yet.</CardDescription>
        </Card>
      ) : (
        <ShootChecklist
          shootDayId={shootDay.id}
          businessId={id}
          minutes={shootDay.estimated_minutes}
          groups={shootDay.plan.location_groups ?? []}
          done={shootDay.done_shots ?? []}
          status={shootDay.status}
        />
      )}

      {fallback.length > 0 && (
        <Card className="flex flex-col gap-2">
          <CardTitle>No-filming posts</CardTitle>
          <CardDescription>Short on time? These need no filming at all.</CardDescription>
          <ul className="flex flex-col gap-2">
            {fallback.map((p) => (
              <li key={p.id}>
                <Link href={`/business/${id}/posts/${p.id}`} className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm">
                  <PlatformBadge platform={p.platform} />
                  <span className="flex-1">{p.hook}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
