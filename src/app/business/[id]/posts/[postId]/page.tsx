import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { getAccess } from "@/lib/billing/access";
import { formatDate } from "@/lib/config/locale";
import { getSafetyConfig } from "@/lib/safety/config";
import { appUrl, weekStart } from "@/lib/utils";
import type { Post } from "@/lib/types";
import { PostEditor } from "./editor";

export const metadata: Metadata = { title: "Post" };

export default async function PostPage(props: PageProps<"/business/[id]/posts/[postId]">) {
  const { id, postId } = await props.params;
  const { supabase, business, profile } = await requireBusiness(id);
  const { data } = await supabase.from("posts").select("*").eq("id", postId).eq("business_id", id).maybeSingle();
  if (!data) notFound();
  const post = data as Post;
  const [config, { count: clicks }, { count: enquiries }] = await Promise.all([
    getSafetyConfig(),
    supabase.from("link_clicks").select("id", { count: "exact", head: true }).eq("post_id", postId),
    supabase.from("enquiries").select("id", { count: "exact", head: true }).eq("post_id", postId),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/business/${id}/calendar`} className="text-sm text-muted-foreground">
        ← Calendar
      </Link>
      <p className="text-sm text-muted-foreground">
        {formatDate(post.publish_date, business.locale, { weekday: "long", day: "numeric", month: "long" })}
        {post.pillar ? ` · ${post.pillar}` : ""}
        {post.format ? ` · ${post.format}` : ""}
      </p>
      <PostEditor
        post={post}
        trackedLink={appUrl(`/r/${post.tracking_code}`)}
        canGenerate={getAccess(profile).canGenerate}
        disclaimer={config.disclaimer}
        stats={{ clicks: clicks ?? 0, enquiries: enquiries ?? 0 }}
        shootHref={post.shoot_day_id ? `/business/${id}/shoot/${weekStart(new Date(post.publish_date + "T00:00:00Z"))}` : null}
      />
    </div>
  );
}
