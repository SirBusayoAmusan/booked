import type { Currency } from "./plans";

export type Country = "US" | "UK" | "AU";
export type Locale = "en-US" | "en-GB" | "en-AU";

export const LAUNCH_COUNTRIES: Country[] = ["US", "UK", "AU"];

export const COUNTRY_DEFAULTS: Record<Country, { locale: Locale; currency: Currency; timezone: string; label: string }> = {
  US: { locale: "en-US", currency: "USD", timezone: "America/New_York", label: "United States" },
  UK: { locale: "en-GB", currency: "GBP", timezone: "Europe/London", label: "United Kingdom" },
  AU: { locale: "en-AU", currency: "AUD", timezone: "Australia/Sydney", label: "Australia" },
};

// Review platforms offered per country. Google is the default everywhere;
// others only when the owner already has a profile there.
export const REVIEW_PLATFORMS: Record<Country, { id: string; label: string }[]> = {
  US: [
    { id: "google", label: "Google" },
    { id: "facebook", label: "Facebook recommendations" },
    { id: "yelp", label: "Yelp" },
  ],
  UK: [
    { id: "google", label: "Google" },
    { id: "facebook", label: "Facebook recommendations" },
    { id: "trustpilot", label: "Trustpilot" },
    { id: "checkatrade", label: "Checkatrade" },
  ],
  AU: [
    { id: "google", label: "Google" },
    { id: "facebook", label: "Facebook recommendations" },
    { id: "productreview", label: "ProductReview.com.au" },
    { id: "hipages", label: "hipages" },
  ],
};

export function formatMoney(amount: number, currency: Currency, locale: Locale = "en-US") {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(date: string | Date, locale: Locale = "en-US", opts?: Intl.DateTimeFormatOptions) {
  const d = typeof date === "string" ? new Date(date.length === 10 ? date + "T12:00:00Z" : date) : date;
  return new Intl.DateTimeFormat(locale, opts ?? { weekday: "short", day: "numeric", month: "short" }).format(d);
}

export function countryFromTimezone(tz: string): Country {
  if (tz.startsWith("Europe/London") || tz.startsWith("Europe/Belfast")) return "UK";
  if (tz.startsWith("Australia/")) return "AU";
  return "US";
}
