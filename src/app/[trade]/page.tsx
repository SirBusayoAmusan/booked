import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Landing } from "@/components/marketing/landing";
import { TRADES, getTrade } from "@/lib/config/trades";

export const dynamicParams = false;

export function generateStaticParams() {
  return TRADES.map((t) => ({ trade: t.slug }));
}

export async function generateMetadata(props: PageProps<"/[trade]">): Promise<Metadata> {
  const t = getTrade((await props.params).trade);
  return t ? { title: `Booked for ${t.label.toLowerCase()}`, description: `A 20-minute weekly marketing routine for ${t.name} owners: what to post, enquiries and reviews.` } : {};
}

export default async function TradeLanding(props: PageProps<"/[trade]">) {
  const t = getTrade((await props.params).trade);
  if (!t) notFound();
  return <Landing trade={t} />;
}
