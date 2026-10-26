import Link from "next/link";
import { Camera, Check, MessageSquare, Star } from "lucide-react";
import { PLANS, TRIAL_DAYS } from "@/lib/config/plans";
import { TRADES, type Trade } from "@/lib/config/trades";
import { formatMoney } from "@/lib/config/locale";

const FAQ = [
  {
    q: "I already use Square, Jobber, Booksy or Fresha. Do I need Booked?",
    a: "Those tools run bookings and payments. Booked plans your content and replies so more people reach them. Your Book button keeps pointing to the tool you already use.",
  },
  {
    q: "Why not just use ChatGPT or Canva?",
    a: "They write or design when you ask. Booked knows your services and prices, plans one weekly shoot, drafts replies from your real details, and shows what brought enquiries.",
  },
  { q: "Does it post for me?", a: "No. You copy and post yourself or paste into your scheduler. That also keeps your accounts safe. We never ask for your social media passwords." },
  {
    q: "What about Instagram links?",
    a: "Instagram captions can't hold clickable links. Booked uses your link in bio, story link stickers and simple code words people can mention when they message you. Facebook and Google posts get tracked links.",
  },
  { q: "Will it make up prices or reviews?", a: "No. It only uses facts you give it, and it asks you to confirm prices and offers before a post can be marked ready." },
  {
    q: "How do I know it is working?",
    a: "Tracked links, promo code words and a 10-second Quick Log show where enquiries come from. Numbers are labelled tracked because many enquiries come by call or text.",
  },
  { q: "Can I cancel?", a: "Yes, any time. You can pause during slow seasons and export your data." },
  {
    q: "I don't have a website or a Google profile. Can I still use Booked?",
    a: "Yes. Booked gives you a simple page with your services, photos and contact buttons, and walks you through setting up the basics step by step. You do the setup on each platform yourself.",
  },
];

export function Landing({ trade }: { trade: Trade }) {
  return (
    <div className="flex-1">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold text-primary">
          Booked
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <a href="#pricing" className="hidden sm:inline">
            Pricing
          </a>
          <Link href="/login" className="font-semibold">
            Sign in
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-4 pb-12 pt-8 sm:pt-16">
          <p className="text-sm font-semibold text-primary">For {trade.name} owners</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Know what to post. Get the enquiries. Collect the reviews.</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            A 20-minute weekly routine for {trade.name} owners. Your plan, your shoot list, your replies and your results in one place. Works alongside your booking tool.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/login?next=/onboarding" className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground">
              Start your {TRIAL_DAYS}-day free trial
            </Link>
            <a href="#sample" className="inline-flex h-12 items-center justify-center rounded-xl border border-border px-6 font-semibold">
              See a sample week
            </a>
          </div>
          <p className="mt-6 rounded-xl bg-secondary p-3 text-sm">
            We don&apos;t post for you and we don&apos;t replace Square, Jobber, Booksy or Fresha. We help you fill them.
          </p>
        </section>

        <section className="bg-card py-12">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-2xl font-bold">How it works</h2>
            <ol className="mt-6 grid gap-4 sm:grid-cols-3">
              {["Tell us about your business in about 8 minutes.", "Get a 30-day plan and one shoot list per week, in your voice.", "Post, reply and request reviews. See which posts brought enquiries."].map((s, i) => (
                <li key={i} className="rounded-2xl border border-border p-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{i + 1}</span>
                  <p className="mt-3">{s}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="sample" className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="text-2xl font-bold">A sample week for {trade.label.toLowerCase()}</h2>
          <p className="mt-1 text-muted-foreground">An example of the format. Your plan is written from your own services, prices and voice.</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" aria-hidden />
                <p className="font-semibold">Shoot Day: about {trade.shootDay.minutes} minutes</p>
              </div>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {trade.shootDay.shots.map((s) => (
                  <li key={s} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /> {s}
                  </li>
                ))}
              </ul>
            </div>
            <ul className="flex flex-col gap-2">
              {trade.sampleWeek.map((p) => (
                <li key={p.hook} className="rounded-2xl border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground">
                    {p.day} · {p.platform}
                    {p.noFilming ? " · no filming" : ""}
                  </p>
                  <p className="font-medium">{p.hook}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-card py-12">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 sm:grid-cols-2">
            {[
              { icon: Check, t: "Know what to post", d: "Open it Monday. Your week is planned." },
              { icon: Camera, t: "Film once", d: "One 20 to 40 minute session covers the week." },
              { icon: MessageSquare, t: "See what brings customers", d: "Know which posts led to enquiries, without pretending it is perfect." },
              { icon: Star, t: "Reply fast, collect reviews", d: "Answer the price DM in a minute. Ask happy customers the right way." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex gap-3">
                <Icon className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="font-semibold">{t}</p>
                  <p className="text-muted-foreground">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="text-2xl font-bold">Pricing</h2>
          <p className="mt-1 text-muted-foreground">
            {TRIAL_DAYS}-day free trial. Cancel any time, or pause for a quiet season.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {Object.values(PLANS).map((p) => (
              <div key={p.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
                <p className="text-lg font-semibold">{p.name}</p>
                <p className="text-3xl font-bold">
                  {formatMoney(p.prices.USD, "USD")}
                  <span className="text-base font-normal text-muted-foreground"> / month</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(p.prices.GBP, "GBP", "en-GB")} in the UK · {formatMoney(p.prices.AUD, "AUD", "en-AU")} in Australia
                </p>
                <ul className="flex flex-col gap-1 text-sm">
                  {p.includes.map((i) => (
                    <li key={i} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /> {i}
                    </li>
                  ))}
                </ul>
                <Link href="/login?next=/onboarding" className="mt-auto inline-flex h-11 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground">
                  Start free trial
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Booked doesn&apos;t post for you or take bookings. Payments are handled by Whop; we never see your card.</p>
        </section>

        <section className="bg-card py-12">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-2xl font-bold">Questions</h2>
            <div className="mt-4 divide-y divide-border">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-3">
                  <summary className="flex min-h-11 cursor-pointer items-center font-medium">{f.q}</summary>
                  <p className="pb-2 text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <div className="flex flex-wrap gap-3">
          {TRADES.map((t) => (
            <Link key={t.slug} href={`/${t.slug}`} className="underline">
              {t.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-3">
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
          <Link href="/terms" className="underline">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}
