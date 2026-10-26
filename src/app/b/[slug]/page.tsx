import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare, Phone } from "lucide-react";
import { getPublicBusiness } from "@/lib/public-business";
import { createClient } from "@/lib/supabase/server";
import { smsHref, telHref, whatsappHref } from "@/lib/utils";
import { EnquiryForm } from "./enquiry-form";

export async function generateMetadata(props: PageProps<"/b/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const b = await getPublicBusiness(slug);
  if (!b) return {};
  return {
    title: { absolute: b.name || "Booked" },
    description: [b.trade, b.service_area].filter(Boolean).join(" · "),
    robots: b.public_page_noindex ? { index: false, follow: false } : undefined,
  };
}

export default async function PublicBusinessPage(props: PageProps<"/b/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const src = typeof sp.src === "string" && /^[a-z0-9]{4,16}$/.test(sp.src) ? sp.src : null;
  const b = await getPublicBusiness(slug);
  if (!b) notFound();

  let preview = false;
  if (!b.public_page_published) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id !== b.owner_id) notFound();
    preview = true;
  }

  const contactOn = b.setup_checklist_state?.status?.contact_buttons !== "hidden";
  const services = (b.services ?? []).filter((s) => s.name);
  const photos = (b.public_photos ?? []).slice(0, 9);
  const bookHref = b.external_booking_url ? `/r/book/${b.slug}${src ? `?src=${src}` : ""}` : null;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-16 pt-6">
      {preview && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Preview: only you can see this until you publish it.</p>
      )}
      <header className="mb-5">
        <h1 className="text-2xl font-bold">{b.name}</h1>
        {b.trade && <p className="text-muted-foreground">{b.trade}</p>}
        {(b.service_area || b.city) && <p className="mt-1 text-sm text-muted-foreground">Serving {b.service_area || b.city}</p>}
      </header>

      <div className="flex flex-col gap-2">
        {bookHref && (
          <a href={bookHref} className="flex h-12 items-center justify-center rounded-xl bg-primary text-base font-semibold text-primary-foreground">
            Book now
          </a>
        )}
        {contactOn && b.phone && (
          <div className="grid grid-cols-2 gap-2">
            <a href={telHref(b.phone)} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card font-semibold">
              <Phone className="h-4 w-4" /> Call
            </a>
            <a href={smsHref(b.phone)} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card font-semibold">
              <MessageSquare className="h-4 w-4" /> Text
            </a>
          </div>
        )}
        {contactOn && b.whatsapp_number && (
          <a href={whatsappHref(b.whatsapp_number, `Hi ${b.name}, I found you online.`)} className="flex h-12 items-center justify-center rounded-xl border border-border bg-card font-semibold">
            WhatsApp
          </a>
        )}
      </div>

      {services.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 font-semibold">Services</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {services.map((s) => (
              <li key={s.name} className="flex items-start justify-between gap-3 px-4 py-3">
                <span>
                  <span className="block font-medium">{s.name}</span>
                  {s.duration && <span className="block text-sm text-muted-foreground">{s.duration}</span>}
                </span>
                {s.price_or_range && <span className="shrink-0 text-sm font-medium">{s.price_or_range}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {photos.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 font-semibold">Our work</h2>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              // Owner-supplied URLs on arbitrary hosts, so a plain img is used.
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.url} src={p.url} alt={p.caption ?? "Work photo"} className="aspect-square w-full rounded-xl object-cover" loading="lazy" />
            ))}
          </div>
        </section>
      )}

      {b.opening_hours && (
        <section className="mt-8">
          <h2 className="mb-1 font-semibold">Hours</h2>
          <p className="text-sm text-muted-foreground">{b.opening_hours}</p>
        </section>
      )}

      <section className="mt-8" id="enquire">
        <h2 className="mb-1 font-semibold">Send an enquiry</h2>
        <p className="mb-3 text-sm text-muted-foreground">Got a question first? Send it here and {b.name} will get back to you.</p>
        <EnquiryForm slug={b.slug} src={src} services={services.map((s) => s.name)} businessName={b.name} />
      </section>

      <footer className="mt-10 text-center text-xs text-muted-foreground">
        Page made with{" "}
        <Link href="/" className="underline">
          Booked
        </Link>
        .{" "}
        <Link href="/privacy" className="underline">
          Privacy
        </Link>
      </footer>
    </main>
  );
}
