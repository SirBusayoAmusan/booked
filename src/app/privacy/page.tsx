import type { Metadata } from "next";
import { LegalLayout } from "@/components/marketing/legal-layout";

export const metadata: Metadata = { title: "Privacy notice" };

// Plain-language notice. Placeholders in [brackets] must be completed, and the
// whole text reviewed by a qualified professional, before launch.
export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy notice" updated="26 October 2026">
      <p>
        This notice explains what Booked collects, why, and your choices. Booked is operated by [legal entity name], [registered address] (&quot;we&quot;). Contact:
        [privacy contact email].
      </p>

      <h2>Two kinds of people</h2>
      <p>
        <strong>Business owners</strong> sign up to use Booked. <strong>Enquirers</strong> are people who send an enquiry to a business through a Booked page. For
        enquirer data, the business owner decides how it&apos;s used and we process it on their behalf.
      </p>

      <h2>What we collect from business owners</h2>
      <ul>
        <li>Account details: email address, and your Google name if you sign in with Google.</li>
        <li>Business details you enter: services, prices, hours, area, voice samples, proof you choose to share.</li>
        <li>Content we generate for you, and your edits to it.</li>
        <li>Subscription status from our payments provider (Whop). We never receive or store your card details.</li>
        <li>Optional push notification subscriptions for your device.</li>
      </ul>

      <h2>What we collect from enquirers</h2>
      <ul>
        <li>What you type into an enquiry form: name, phone or email, the service and your message, and your consent to be contacted.</li>
        <li>When you tap a tracked link: the time, the referring site, and a salted hash of your IP address and browser that changes daily. We never store raw IP addresses.</li>
      </ul>
      <p>Your enquiry goes only to the business you contacted, so they can reply. Booked does not message you, sell your data, or use it for advertising.</p>

      <h2>How we use data</h2>
      <ul>
        <li>To run the service: plans, posts, enquiry inbox, reminders, weekly emails.</li>
        <li>To generate drafts with AI. Business details are sent to our AI provider (Anthropic) to write content; enquirer messages are sent only when an owner asks for a reply draft.</li>
        <li>To bill subscriptions through Whop.</li>
        <li>To keep the service secure and prevent abuse (rate limits, spam protection).</li>
      </ul>

      <h2>Where data is stored</h2>
      <p>
        Data is stored with Supabase in [region, e.g. US East (N. Virginia)] and the app is hosted on Vercel. Emails are sent with Resend. These providers process data
        for us under contract. Data may be transferred outside your country with appropriate safeguards.
      </p>

      <h2>Cookies and analytics</h2>
      <p>We use only the cookies needed to keep you signed in and to remember an affiliate referral for 30 days. We don&apos;t use advertising or tracking cookies.</p>

      <h2>How long we keep data</h2>
      <p>
        Owner data is kept while your account is open. Enquiry data is kept until the business owner deletes it or closes their account. Deleting an account removes its
        data from our live systems straight away and from backups within [30] days.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live (for example under US state privacy laws, the UK GDPR or the Australian Privacy Act), you can ask to access, correct, export or delete
        your data, and to object to some uses. Owners can export and delete their data in Settings. Enquirers can ask the business they contacted, or email us at [privacy
        contact email] and we&apos;ll pass the request on and help. You can also complain to your local regulator (for example the ICO in the UK or the OAIC in
        Australia).
      </p>

      <h2>Children</h2>
      <p>Booked is for business owners and is not intended for children.</p>

      <h2>Changes</h2>
      <p>We&apos;ll update this page and the date above when this notice changes, and email owners about significant changes.</p>
    </LegalLayout>
  );
}
