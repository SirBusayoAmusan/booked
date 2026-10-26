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
