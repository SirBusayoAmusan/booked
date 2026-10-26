# Booked

The weekly social media routine for local service businesses, built around getting enquiries and reviews, not just posts.

Owners spend about 20 minutes a week: Booked tells them what to shoot, post and say, shows which posts brought enquiries, drafts replies from their real prices, and turns finished jobs into reviews. It doesn't post for them and doesn't replace their booking tool.

## What's in the box

| Area | Where |
| --- | --- |
| Onboarding interview, fact sheet, positioning | `src/app/onboarding`, `src/app/business/[id]/positioning`, `src/lib/ai/onboarding-fns.ts` |
| Presence assessment and Get Found checklist | `src/lib/config/checklist.ts`, `src/components/get-found-card.tsx` |
| 30-day calendar, Shoot Day, post detail | `src/app/business/[id]/calendar`, `.../shoot/[weekStart]`, `.../posts/[postId]`, `src/lib/ai/calendar-fns.ts` |
| Safety gate (rules JSON + engine + tests) | `src/lib/safety/` |
| Tracked links, public page, enquiry form | `src/app/r/`, `src/app/b/[slug]`, `src/app/api/public/enquiry` |
| Enquiry inbox, Quick Log, CSV export | `src/app/business/[id]/enquiries`, `src/app/api/enquiries` |
| Reply Helper and saved replies | `src/app/business/[id]/reply`, `src/lib/ai/reply-fns.ts` |
| Review Kit, QR codes, printables | `src/app/business/[id]/reviews`, `src/app/api/reviews/qr` |
| Weekly review, ROI, Monday digest, reminders | `src/app/business/[id]/review`, `src/lib/weekly.ts`, `src/app/api/cron/*` |
| Billing adapter (Whop) | `src/lib/billing/` |
| Landing pages, pricing, FAQ, legal | `src/components/marketing`, `src/app/[trade]`, `src/app/privacy`, `src/app/terms` |
| Admin (AI cost, activation, churn, safety rules) | `src/app/admin` |

Every assumption and tradeoff is recorded in [DECISIONS.md](DECISIONS.md).

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 with shadcn-style components · Supabase (Postgres, RLS, magic link and Google sign-in) · Anthropic API (server routes only) · Whop (billing, behind an adapter) · Resend · Web Push · Vercel Cron · Zod.

## Set up

1. **Install**: `npm install` (Node 20.9+).
2. **Supabase**: create a project in a region close to your launch market (US for launch). Run `supabase/migrations/0001_init.sql` in the SQL editor (or `supabase db push`). In Authentication, enable Email (magic link) and Google, and add `{APP_BASE_URL}/auth/callback` to the redirect URLs.
3. **Make yourself an admin**: `update profiles set is_admin = true where email = 'you@example.com';`
4. **Anthropic**: add `ANTHROPIC_API_KEY`. The model defaults to `claude-sonnet-5-5` (`ANTHROPIC_MODEL`).
5. **Whop (sandbox first)**: in sandbox.whop.com create one product with two recurring plans (Solo, Growth), each with a 7-day free trial. Create an API key with membership, checkout configuration and member-manage permissions. Create a webhook to `{APP_BASE_URL}/api/billing/webhook` for `membership.activated`, `membership.updated`, `membership.trial_ending_soon`, `payment.failed` and `payment.succeeded`, pinned to the same API version as `WHOP_API_VERSION_DATE`. Set `WHOP_ENVIRONMENT=sandbox` until the full flow passes. Test cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0341` saves but fails later charges (good for the past-due path).
6. **Resend**: add `RESEND_API_KEY` and a verified `EMAIL_FROM`.
7. **Web push (optional)**: `npx web-push generate-vapid-keys`, then set `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (same value) and `VAPID_PRIVATE_KEY`.
8. **Env**: copy `.env.example` to `.env.local` and fill it in. Set `CRON_SECRET` and `IP_HASH_SALT` to long random strings.
9. **Run**: `npm run dev`.

## Deploy (Vercel)

Import the repo, add the env vars, deploy. `vercel.json` schedules the crons (hourly digest window, 30-minute overdue check, hourly post reminders and month-end check), which needs Vercel Pro. On Hobby, call the `/api/cron/*` routes from any scheduler with `Authorization: Bearer $CRON_SECRET`.

## Checks

```bash
npm run typecheck   # route types + TypeScript
npm run lint
npm test            # unit tests, including 3+ pass and 3+ fail examples per safety rule
npm run test:db     # applies migrations to a local Postgres and checks RLS (needs psql)
```

## Before launch

- Fill in the `[placeholders]` in `src/app/privacy/page.tsx` and `src/app/terms/page.tsx`, and have both reviewed by a professional.
- Confirm in the current Whop docs: fees, supported currencies and local-currency plans, how sales tax, VAT and GST are handled, whether Whop is merchant of record, and what receipts owners can download. Set per-currency plan IDs (`WHOP_PLAN_ID_SOLO_GBP`, …) if you sell in GBP or AUD.
- Set up the Whop affiliate program in the dashboard (commission rate lives there, not in code).
- Re-verify the safety rules and bump `last_verified` from the admin screen.
