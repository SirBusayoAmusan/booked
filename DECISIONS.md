# Decisions log

Every assumption and tradeoff made during the build, newest at the bottom of each milestone.

## Milestone 1: Foundation

- **Next.js 16.4 (App Router), React 19.3.** `create-next-app` enables `cacheComponents` and `partialPrefetching` by default. Turned both off: every app screen is per-user and cookie-bound, so the classic dynamic rendering model is simpler and has fewer traps.
- **Middleware is `src/proxy.ts`.** Next 16 renamed Middleware to Proxy. It only refreshes the Supabase session and does an optimistic redirect; real authorisation is in pages, routes and RLS.
- **shadcn/ui-style components are written by hand** in `src/components/ui` (Button, Card, Input, Badge) using `class-variance-authority`, `clsx` and `tailwind-merge`, instead of running the shadcn CLI. Same patterns, no registry fetch, fewer files.
- **Supabase schema is one SQL migration** (`supabase/migrations/0001_init.sql`). RLS is on for every table. Child tables use a `owns_business()` security-definer helper. Public traffic (enquiry form, tracked redirects, webhooks, cron, admin) uses the service-role client in server routes only; there are no anon policies.
- **Billing columns on `profiles` are protected by a trigger**, so a signed-in user cannot upgrade themselves by updating their own row. Only the service role (webhooks) can change plan and status.
- **Extra columns beyond the spec**, each for a feature in scope: `profiles.notification_prefs`, `profiles.is_admin`, `profiles.past_due_since`, `profiles.current_period_end`; `businesses.onboarding_answers`, `onboarding_step`, `onboarding_completed_at`, `fact_sheet_confirmed_at`, `positioning_confirmed_at`, `offers_enabled`, `public_page_published`, `public_page_noindex`, `public_photos`; `posts.ref`, `confirmed_items`, `no_filming`; `enquiries.booked_at`, `completed_at`, `overdue_notified_at`; `shoot_days.done_shots`; `calendars.generation_state`; `link_clicks.kind` (tracked link vs Book now click); `ai_runs.user_id`, `cost_usd`, `output` (cache); `weekly_reviews.summary`, `next_week_focus`; `safety_rules_meta.rules`.
- **Rate limiting uses a Postgres fixed-window counter** (`rate_limits` + `hit_rate_limit()`), not Redis. One less service; fine at MVP volume.
- **RLS is tested against plain Postgres** with a stub `auth` schema (`supabase/tests/`). Run `npm run test:db` with a local Postgres.
- **PWA**: `app/manifest.ts`, a service worker that handles push and install but does not cache pages (owners must never see stale enquiries). Icons are generated PNGs.
- **`/home`** is the post-sign-in and PWA start URL. It routes to onboarding, positioning review or Today.
- **Bottom navigation** has five tabs: Today, Calendar, Enquiries, Reviews, More. Reply Helper, weekly review, public page and positioning live under More.

## Milestone 2 and 2b: Onboarding, fact sheet, positioning, presence, Get Found

- **AI calls use `client.beta.messages.parse` with Zod structured outputs** (`betaZodOutputFormat`), then validate again with Zod and an optional custom check, retrying once with the error fed back. Model comes from `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`, as the spec says). Effort defaults to `medium`.
- **Server-side refusal fallback is on** (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) for models that support it, so a rare false-positive refusal gets re-run instead of failing.
- **Every AI run is logged** to `ai_runs` with tokens and an estimated cost (prices in `config/plans.ts`). Identical inputs reuse a successful output from the last 30 days (`cache: true`) for fact sheet, positioning and setup guidance.
- **Per-user hourly AI cap** of 60 calls via the Postgres rate limiter, on top of monthly plan limits.
- **The fact sheet is checked for invented prices**: any number in a service price that doesn't appear in the owner's answers fails validation and triggers a retry.
- **Onboarding AI runs before the trial starts** (fact sheet, positioning, setup guidance; capped at 8 runs per account). Owners see their positioning before being asked to start the trial. Calendar generation and everything after it needs an active or trialing subscription.
- **Onboarding has 14 screens**: a basics screen (name, trade, country; timezone auto-detected in the browser) plus the 13 spec questions. The presence question is the yes/no checks screen. Answers autosave 800 ms after the last change and on every Next/Back.
- **Booking method adds `text`** to the spec's `whatsapp|call|form|dm`, since the spec says to default to SMS/text for US owners.
- **`setup_checklist_state` holds `{ status, guidance }`**: per-item status (`todo`, `done`, `hidden`) and the AI-written guidance. If setup guidance fails, the static checklist copy is used.
- **"Not for me" hides a checklist item**. The Facebook page item only shows for trades where it usually matters (cleaners, trades, detailers, groomers, rentals).
- **Contact buttons**: shown on the public page whenever a phone number exists, unless the owner turns them off. Turning them on marks the checklist item done.
- **Public page photos are pasted URLs** with a permission checkbox. No upload storage in the MVP (image hosting would need a bucket and moderation).
- **Public pages default to `noindex`**. Unpublished pages are visible only to the signed-in owner as a preview.
- **Book now goes through `/r/book/[slug]`**, which logs a `booking_link` click and adds `utm_source=booked` and `utm_campaign=<tracking code>` to the owner's booking link. Booked doesn't claim to see bookings made there.
- **Click logging skips link-preview bots** (Facebook, WhatsApp, Slack and similar) so tracked counts aren't inflated by previews.

## Milestones 3 and 4: Calendar, posts, Shoot Day, safety gate

- **Calendars are generated one week per request.** The browser calls `POST /api/ai/calendar` until it reports `done`, with a progress bar. Each request stays well under the 60-second serverless limit, and a failed week can be resumed without losing finished weeks (`calendars.generation_state`).
- **Weeks are Monday-start and overlap the month.** Weeks already over are skipped, so "rest of this month" plans only what's left. Owners can also plan next month.
- **Cadence comes from weekly hours**: 3 primary posts a week up to 1 hour, 4 above that, plus 1 Google post when allowed. Shoot Day is capped at half the weekly budget, between 15 and 40 minutes. The model's plan is rejected (and retried once) if it breaks the budget, uses a platform the owner can't use, plans face-on-camera shots for an owner who said no, has no no-filming fallback, or dates posts outside the week.
- **Allowed platforms come from the presence assessment**: no Facebook posts without a page, no Google posts without a profile (and only on plans with the Google Business Profile pack; trials get it), WhatsApp status only with a WhatsApp number. Instagram is the fallback when nothing else applies.
- **Code words are only assigned when the owner has offers enabled**, normalised to capitals, and made unique per business by adding a number (also enforced by a unique index).
- **Regenerating a week replaces only unposted posts** from today onward. Regenerating a post keeps its tracking code so links already shared still work. Both count against the monthly regeneration limit.
- **The previous calendar for the same month is archived** only when the new one finishes, so owners always have a working plan.
- **Last month's weekly review** (summary and recommendations) is passed into the next calendar as context.
- **Edit-learning**: every saved caption edit is stored in `style_examples` on every plan. The five most recent are fed into prompts on plans with voice learning (Growth, and the trial).
- **Safety gate**: a deterministic engine (`src/lib/safety/safety.ts`) reading `rules.json`. Admins can publish a new rules version from the admin screen into `safety_rules_meta`; the newest valid version wins, without a deploy.
  - Extra rules beyond the spec: `unfilled_placeholder` (a `[placeholder]` left in copy is high severity) and `owner_banned_words` (high).
  - **Every price and offer needs owner confirmation**, even ones in the fact sheet, because prices go stale. Prices not in the fact sheet can't be confirmed; they must be edited. Each `needs_owner_confirmation` item from the AI is also a confirm step. Confirmations are stored as `rule_id:matched text` in `posts.confirmed_items`.
  - Fake urgency can be confirmed as real by the owner, as the spec says.
  - `review_incentive_or_gating` applies to review requests and to any post that mentions reviews, so "five-star finish" in an ordinary post isn't flagged.
  - Fabricated proof is detected with heuristics (quotes, counts of customers or reviews, ratings, percentages, years of experience, awards, named customers) checked against the fact sheet and permissioned proof. The optional AI review pass for fabricated proof is not wired in yet; the deterministic check runs on every generation and edit.
  - Customer-photo findings are skipped when the owner has confirmed permission for their proof assets.
  - Posts with high findings can't be marked ready or posted. Medium findings show but don't block.
- **Live lint while editing** calls `POST /api/safety/check` without saving.

## Milestones 5 and 6: Enquiry capture, replies, Review Kit

- **Tracked links** are `/r/{tracking_code}`. They log a click (salted, daily-rotating hash of IP + user agent; no raw IPs), then redirect to `/b/{slug}?src={code}`. The enquiry form sends `src`, and a matching post makes the enquiry `tracked_link` with `post_id`.
- **The public enquiry form** has a consent checkbox (required), privacy notice, a honeypot field, and Postgres rate limits: 10 per hour per IP hash and 60 per hour per business.
- **Quick Log** sources: picking a code word or a recent post sets `source = code_word` with `post_id`; anything else is `manual` with the "how did they find you" answer in `source_note`. Logged enquiries start as Contacted by default, since the owner is usually already talking to them.
- **`enquiries.value_usd` holds the job value in the business's own currency** (USD, GBP or AUD), despite the column name from the spec. The CSV header names the currency.
- **Status timestamps**: moving out of New sets `first_contacted_at`; Booked sets `booked_at`; Completed sets `completed_at`. The ROI card counts enquiries by `booked_at` this month.
- **Contacting from the inbox** (call, text, WhatsApp, email, copying a Reply Helper draft) marks a New enquiry as Contacted, which stops the overdue reminder.
- **Overdue reminder** is a cron (`/api/cron/overdue-enquiries`, every 30 minutes in `vercel.json`) that sends one reminder per enquiry once it's older than the owner's limit (default 2 hours): web push if subscribed, otherwise email. Vercel Hobby only allows daily crons, so this needs Vercel Pro (or an external scheduler hitting the route with `CRON_SECRET`).
- **Reply Helper** rejects drafts containing any number that isn't in the fact sheet, saved replies or the customer's own message, then retries once. Copy is disabled while `[placeholders]` remain. Saving an edited draft to the library also stores a `reply` style example.
- **Review requests** count against the monthly limit whether drafted by AI or from a template. Templates work without AI (and when generation is paused). AI drafts are checked against the review-incentive and gating rule and must contain the review link.
- **Review link**: Google first, else the first other platform the owner added (Facebook recommendations, Yelp, Trustpilot, Checkatrade, ProductReview, hipages, depending on country). No in-house feedback form, so there's no way to filter unhappy customers away from public reviews.
- **QR codes** are generated server-side as SVG and PNG with the `qrcode` package. The spec's `/api/reviews/qr/[businessId].svg` is implemented as `/api/reviews/qr/[file]` because a Next.js dynamic segment can't carry a fixed suffix; `{businessId}.svg` and `{businessId}.png` both work. QR routes require the owner to be signed in.
- **Printables**: a poster and a sheet of 8 business cards, printed from the browser with print CSS hiding the app chrome.
- **Review prompts on Today** show jobs marked completed in the last 3 days with no review request yet.

## Milestone 7: Billing with Whop

- **Read the current Whop docs before writing billing code** (docs.whop.com, October 2026). Whop now calls plans "variants" but IDs still start with `plan_`, and the SDK and webhook names still say `plan`.
- **Pinned API version**: `WHOP_API_VERSION_DATE` (default `2026-10-24`, the newest version in the docs at build time), passed to the SDK's `apiVersionDate`. Sandbox vs production is `WHOP_ENVIRONMENT` (`sandbox` by default) using the SDK's `WhopEnvironment`.
- **Extra env vars**: `WHOP_ENVIRONMENT`, and optional per-currency plan IDs (`WHOP_PLAN_ID_SOLO_GBP`, `WHOP_PLAN_ID_GROWTH_AUD`, …) that fall back to `WHOP_PLAN_ID_SOLO` / `WHOP_PLAN_ID_GROWTH`. `WHOP_ACCOUNT_ID` and `WHOP_PRODUCT_ID` are kept in `.env.example` for setup but the code doesn't need them, because checkout uses existing plan IDs.
- **The 7-day trial is configured on the Whop plans** (Whop sets trials on recurring plans/checkout links, `trial_period_days`), not in code.
- **Checkout** creates a Whop checkout configuration for the plan with `metadata.app_user_id` (Whop copies checkout metadata onto the membership and payments) and sends the owner to its `purchase_url`. That is how webhooks are linked to Booked accounts. Owners only enter card details on Whop.
- **Webhooks** (`POST /api/billing/webhook`) read the raw body as text and verify it with the SDK's `unwrapWebhook` (Standard Webhooks signature plus a 5-minute timestamp tolerance) before parsing. Unsigned or tampered requests get 401.
- **Idempotency**: the `webhook-id` header is inserted into `billing_events` (unique). A duplicate returns 200 without reprocessing. If processing fails, the row is removed so Whop's retry is processed.
- **State comes from the API, not the payload.** For `membership.*` and `payment.failed`/`payment.succeeded`, the handler re-reads the membership with `memberships.retrieve`, because Whop says deliveries can arrive out of order and webhook payloads never include the affiliate. Subscribe the endpoint to `membership.activated`, `membership.updated`, `membership.trial_ending_soon`, `payment.failed` and `payment.succeeded` (`membership.updated` also covers deactivation and cancel-at-period-end).
- **Status mapping**: `trialing` to trialing; `active` and `completed` to active; `past_due` and `unresolved` to past_due; `canceled` and `expired` to canceled; any state with `most_recent_action = paused_at` to paused. `past_due_since` is set the first time a membership goes past due, for the 3-day grace period.
- **Trials get the Growth feature set** (`TRIAL_PLAN` in config) so owners can judge the full product; after the trial they get the plan they chose.
- **Pause** calls Whop's pause (stops payment collection). Booked treats paused accounts as read-only, per the spec. **Cancel** is always at period end, so owners keep what they paid for. Undo cancel is supported.
- **Manage billing** sends owners to the membership's `manage_url` on Whop (card, receipts, invoices, cancel).
- **Affiliates**: a `?a=code` on any page sets a 30-day `booked_aff` cookie, passed as `affiliate_code` at checkout. When the API returns the affiliate on the membership, its user ID is stored in `profiles.referred_by`. Commission rates are set in the Whop dashboard, not in code.
- **`BILLING_PROVIDER=stripe`** selects a placeholder provider that fails clearly until a Stripe implementation is written. Product code only uses `getBillingProvider()`.
- **Account deletion** cancels the subscription at period end first, then deletes the auth user (all data cascades). If the cancel fails, deletion stops and the owner is asked to cancel from Manage billing, so nobody is charged for a deleted account.
- **Refund promise in the UI**: "ask within 14 days of the first charge, no questions asked". Refunds are issued manually from the Whop dashboard; this needs a matching line in the terms (done) and a person to action requests.

## Milestone 8: Weekly loop and ROI

- **Weekly metrics are computed live** from posts, clicks, enquiries, bookings and review requests for a Monday-start week, and the review page always shows fresh numbers. The stored `weekly_reviews` row holds the written summary, top posts and recommendations.
- **Solo plan gets a plain, numbers-only summary**; Growth (and trials) get the AI review with up to 3 recommendations. The AI review is rejected and retried if it mentions a number that isn't in the input or a post that isn't in the data. Under 5 enquiries across the 4 weeks, it's told to say there isn't enough data yet.
- **Top posts are ranked by tracked enquiries, then tracked clicks**, including clicks and enquiries this week on posts from earlier weeks.
- **ROI** is logged revenue (job values on enquiries booked in the period) vs the plan price in the business's currency. The UI says "logged" and explains it isn't every job.
- **Monday digest** runs hourly and sends between 7:00 and 11:59 on Monday in each owner's timezone, once per week (`weekly_reviews.email_sent_at`). It builds last week's review first if needed. It's skipped for owners who turned it off, and for paused or canceled accounts.
- **Post-day push** (`/api/cron/post-reminders`, hourly) is an extra cron for the spec's optional "push at the owner's chosen time on days with a post due". Once-per-day and once-per-month guards reuse the Postgres rate limiter.
- **Month-end reminder** runs from the 25th (local time, after 9:00) if next month has no calendar, once per month. Push first, email if the owner has no push subscription.
- **Cron schedules need Vercel Pro** (hourly and half-hourly). On Hobby, call the routes from any scheduler with `Authorization: Bearer $CRON_SECRET`. The digest stops after about 4 minutes and picks up the rest next hour; at larger scale this should move to a queue.
- **Emails go through Resend**. Without `RESEND_API_KEY` they're logged and skipped, so local development works.
