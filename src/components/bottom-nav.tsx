"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Inbox, Menu, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav({ businessId }: { businessId: string }) {
  const pathname = usePathname();
  const base = `/business/${businessId}`;
  const items = [
    { href: `${base}/today`, label: "Today", icon: Home, match: ["/today", "/shoot"] },
    { href: `${base}/calendar`, label: "Calendar", icon: CalendarDays, match: ["/calendar", "/posts"] },
    { href: `${base}/enquiries`, label: "Enquiries", icon: Inbox, match: ["/enquiries", "/reply"] },
    { href: `${base}/reviews`, label: "Reviews", icon: Star, match: ["/reviews"] },
    { href: `${base}/more`, label: "More", icon: Menu, match: ["/more", "/review", "/page", "/positioning"] },
  ];
  const sub = pathname.slice(base.length);
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {items.map(({ href, label, icon: Icon, match }) => {
          const active = match.some((m) => sub === m || sub.startsWith(m + "/"));
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs",
                  active ? "font-semibold text-primary" : "text-muted-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
