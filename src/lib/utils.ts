import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function randomCode(len = 7) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function appUrl(path = "") {
  return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "") + path;
}

// Monday of the week containing `d`, as YYYY-MM-DD.
export function weekStart(d: Date = new Date()) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay();
  x.setUTCDate(x.getUTCDate() - ((day + 6) % 7));
  return x.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number) {
  const x = new Date(iso + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

// Today's date in a given IANA timezone, as YYYY-MM-DD.
export function todayIn(timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function monthStart(iso: string) {
  return iso.slice(0, 8) + "01";
}

export function nextMonthStart(iso: string) {
  const d = new Date(iso.slice(0, 8) + "01T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function telHref(phone: string) {
  return "tel:" + phone.replace(/[^\d+]/g, "");
}

export function smsHref(phone: string, body?: string) {
  return "sms:" + phone.replace(/[^\d+]/g, "") + (body ? "?&body=" + encodeURIComponent(body) : "");
}

export function whatsappHref(phone: string, text?: string) {
  return "https://wa.me/" + phone.replace(/[^\d]/g, "") + (text ? "?text=" + encodeURIComponent(text) : "");
}

// Current time in ms. Server components read the clock once per request.
export function nowMs() {
  return Date.now();
}
