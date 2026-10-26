import { formatMoney, type Locale } from "@/lib/config/locale";
import type { Roi } from "@/lib/roi";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export function RoiCard({ roi, locale, period = "this month", href }: { roi: Roi; locale: Locale; period?: string; href?: string }) {
  const ratio = roi.planPrice > 0 ? roi.revenue / roi.planPrice : 0;
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <CardTitle>Logged results {period}</CardTitle>
        {href && (
          <a href={href} className="text-sm text-primary underline">
            Details
          </a>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-2xl font-bold">{roi.bookings}</p>
          <p className="text-xs text-muted-foreground">Bookings</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{formatMoney(roi.revenue, roi.currency, locale)}</p>
          <p className="text-xs text-muted-foreground">Logged revenue</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{formatMoney(roi.planPrice, roi.currency, locale)}</p>
          <p className="text-xs text-muted-foreground">Plan cost</p>
        </div>
      </div>
      <CardDescription>
        {roi.revenue > 0 ? `Logged revenue is ${ratio.toFixed(1)}× your plan cost. ` : ""}
        Based on bookings you&apos;ve logged, not every job. {roi.bookingsWithoutValue > 0 && `${roi.bookingsWithoutValue} booking${roi.bookingsWithoutValue === 1 ? " has" : "s have"} no job value yet.`}
      </CardDescription>
    </Card>
  );
}
