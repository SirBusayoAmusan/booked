import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireBusiness } from "@/lib/auth";

export const metadata: Metadata = { title: "More" };

export default async function MorePage(props: PageProps<"/business/[id]/more">) {
  const { id } = await props.params;
  await requireBusiness(id);
  const base = `/business/${id}`;
  const links = [
    { href: `${base}/reply`, label: "Reply Helper", hint: "Draft a reply to a customer message" },
    { href: `${base}/review`, label: "Weekly review", hint: "Enquiries, bookings and revenue vs plan cost" },
    { href: `${base}/page`, label: "Your public page", hint: "Mini site, link in bio, contact buttons" },
    { href: `${base}/positioning`, label: "Positioning and fact sheet", hint: "The facts Booked is allowed to use" },
    { href: "/settings", label: "Settings", hint: "Billing, notifications, voice, export, delete" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-bold">More</h1>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="block font-medium">{l.label}</span>
                <span className="block text-sm text-muted-foreground">{l.hint}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <form action="/auth/signout" method="post">
        <button className="min-h-11 text-sm text-muted-foreground underline">Sign out</button>
      </form>
    </div>
  );
}
