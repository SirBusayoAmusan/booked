import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { getAccess } from "@/lib/billing/access";
import { BottomNav } from "@/components/bottom-nav";
import { cn } from "@/lib/utils";

export default async function BusinessLayout(props: LayoutProps<"/business/[id]">) {
  const { id } = await props.params;
  const { business, profile } = await requireBusiness(id);
  const access = getAccess(profile);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="no-print sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
          <Link href={`/business/${id}/today`} className="truncate font-semibold">
            {business.name || "Your business"}
          </Link>
          <Link href="/settings" className="flex h-11 items-center px-2 text-sm text-muted-foreground">
            Settings
          </Link>
        </div>
        {access.banner && (
          <div
            className={cn(
              "px-4 py-2 text-sm",
              access.banner.tone === "danger" && "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100",
              access.banner.tone === "warning" && "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
              access.banner.tone === "info" && "bg-teal-50 text-teal-900 dark:bg-teal-950 dark:text-teal-100",
            )}
          >
            <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2">
              <span>{access.banner.text}</span>
              {access.banner.cta && (
                <a href={access.banner.cta.href} className="font-semibold underline">
                  {access.banner.cta.label}
                </a>
              )}
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-4">{props.children}</main>
      <BottomNav businessId={id} />
    </div>
  );
}
