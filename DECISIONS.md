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
