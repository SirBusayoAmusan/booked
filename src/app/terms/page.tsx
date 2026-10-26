import type { Metadata } from "next";
import { LegalLayout } from "@/components/marketing/legal-layout";

export const metadata: Metadata = { title: "Terms" };

// Plain-language terms. Placeholders in [brackets] must be completed, and the
// whole text reviewed by a qualified professional, before launch.
export default function TermsPage() {
  return (
    <LegalLayout title="Terms of service" updated="26 October 2026">
      <p>These terms are an agreement between you and [legal entity name] (&quot;Booked&quot;, &quot;we&quot;). By using Booked you agree to them.</p>

      <h2>What Booked does</h2>
      <ul>
        <li>Booked plans and drafts marketing content, helps you track enquiries and drafts messages for you to send.</li>
        <li>Booked does not post to your social accounts, does not ask for your social media passwords, and does not take bookings or payments for you.</li>
        <li>
          Booked drafts SMS, WhatsApp and email messages for you to send yourself. It never sends marketing messages to your customers on its own. You are responsible for
          following texting and marketing rules where you and your customers are.
        </li>
      </ul>

      <h2>Your content and facts</h2>
      <ul>
        <li>You own your business information, your enquiries and the content Booked drafts for you.</li>
        <li>Booked writes only from the facts you give it. You must check prices, offers, availability and claims before you post or send anything.</li>
        <li>
          The safety check is a lint based on general advertising principles, not legal advice, and doesn&apos;t cover every rule in every country, state or platform.
        </li>
        <li>Don&apos;t use Booked to post fake reviews, fake testimonials or misleading claims, or to offer rewards for reviews or only ask happy customers.</li>
      </ul>

      <h2>No guaranteed results</h2>
      <p>We can&apos;t promise any number of enquiries, bookings, reviews or income. Results depend on your business, your market and what you do.</p>

      <h2>Plans, trials and billing</h2>
      <ul>
        <li>Paid plans start with a free trial. Unless you cancel before it ends, your plan renews each billing period until you cancel.</li>
        <li>Billing is handled by Whop, our payments provider, under their terms. We don&apos;t see or store your card details.</li>
        <li>
          You can pause or cancel any time in Settings. Cancelling takes effect at the end of the current billing period. If you&apos;re not happy with your first charge,
          ask for a refund within 14 days and we&apos;ll refund it, no questions asked.
        </li>
        <li>Plan limits (for example calendars and drafts per month) are shown on the pricing page and may change with notice.</li>
      </ul>

      <h2>Enquirer data</h2>
      <p>
        When people send you enquiries through Booked, you decide how that data is used and you must use it lawfully: only to reply to them and serve them, unless they agree
        to more. We process it on your behalf as described in our privacy notice.
      </p>

      <h2>Acceptable use</h2>
      <p>Don&apos;t misuse Booked: no unlawful, misleading or harmful content, no spam, no attempts to break or overload the service.</p>

      <h2>Liability</h2>
      <p>
        Booked is provided as is. To the extent the law allows, our total liability is limited to the fees you paid in the 12 months before the claim. Nothing in these
        terms limits rights you have under consumer law that can&apos;t be excluded.
      </p>

      <h2>Ending</h2>
      <p>You can delete your account any time in Settings. We may suspend accounts that break these terms. You can export your data before you leave.</p>

      <h2>Contact</h2>
      <p>[support email] · [legal entity name], [registered address]. Governing law: [jurisdiction].</p>
    </LegalLayout>
  );
}
