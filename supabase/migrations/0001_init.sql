-- Booked: initial schema.
-- Every table has id, created_at, updated_at. RLS is enabled on every table.
-- Owners can only reach rows belonging to businesses they own. Public traffic
-- (enquiry form, tracked redirects, webhooks, cron) goes through server routes
-- that use the service role key, never through anon policies.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  plan_id text not null default 'solo',
  billing_provider text not null default 'whop',
  billing_customer_ref text,
  billing_membership_ref text,
  subscription_status text not null default 'none'
    check (subscription_status in ('none','trialing','active','past_due','paused','canceled')),
  trial_ends_at timestamptz,
  past_due_since timestamptz,
  current_period_end timestamptz,
  referred_by text,
  billing_currency text,
  is_admin boolean not null default false,
  notification_prefs jsonb not null default
    '{"digest_email": true, "overdue_hours": 2, "post_day_push": false, "post_day_hour": 9, "push_enabled": false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create a profile for every new auth user.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email) values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------- businesses
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  slug text not null unique,
  trade text,
  city text,
  service_area text,
  neighbourhoods text[] not null default '{}',
  languages text[] not null default '{}',
  services jsonb not null default '[]'::jsonb,
  opening_hours text,
  ideal_customer_notes text,
  voice_notes text,
  voice_samples text[] not null default '{}',
  banned_words text[] not null default '{}',
  faces_on_camera boolean not null default true,
  weekly_hours_available numeric not null default 1,
  platforms text[] not null default '{}',
  booking_method text not null default 'call' check (booking_method in ('whatsapp','call','form','dm','text')),
  whatsapp_number text,
  phone text,
  google_review_url text,
  google_business_url text,
  regulated_notes text,
  proof_assets jsonb not null default '[]'::jsonb,
  fact_sheet jsonb,
  fact_sheet_confirmed_at timestamptz,
  positioning_summary jsonb,
  positioning_confirmed_at timestamptz,
  quiet_season boolean not null default false,
  offers_enabled boolean not null default false,
  country text not null default 'US' check (country in ('US','UK','AU')),
  timezone text not null default 'America/New_York',
  locale text not null default 'en-US' check (locale in ('en-US','en-GB','en-AU')),
  currency text not null default 'USD' check (currency in ('USD','GBP','AUD')),
  review_platforms jsonb not null default '[]'::jsonb,
  licence_or_registration_ref text,
  booking_tool text not null default 'none'
    check (booking_tool in ('square','jobber','booksy','fresha','calendly','other','none')),
  external_booking_url text,
  presence jsonb not null default '{}'::jsonb,
  setup_checklist_state jsonb not null default '{}'::jsonb,
  onboarding_answers jsonb not null default '{}'::jsonb,
  onboarding_step int not null default 0,
  onboarding_completed_at timestamptz,
  public_page_published boolean not null default false,
  public_page_noindex boolean not null default true,
  public_photos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index businesses_owner_idx on public.businesses(owner_id);

-- Helper used by every child-table policy.
create or replace function public.owns_business(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.businesses b where b.id = bid and b.owner_id = auth.uid());
$$;

-- --------------------------------------------------------------- calendars
create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  month_start date not null,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  strategy jsonb not null default '{}'::jsonb,
  generation_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index calendars_business_idx on public.calendars(business_id, month_start);

-- -------------------------------------------------------------- shoot_days
create table public.shoot_days (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  week_start date not null,
  estimated_minutes int not null default 0,
  plan jsonb not null default '{}'::jsonb,
  done_shots text[] not null default '{}',
  status text not null default 'planned' check (status in ('planned','done','skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shoot_days_business_idx on public.shoot_days(business_id, week_start);

-- ------------------------------------------------------------------- posts
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  shoot_day_id uuid references public.shoot_days(id) on delete set null,
  ref text,
  publish_date date not null,
  platform text not null check (platform in ('instagram','facebook','tiktok','google_business','whatsapp_status')),
  pillar text,
  format text,
  hook text,
  caption text not null default '',
  on_screen_text jsonb not null default '[]'::jsonb,
  shot_list jsonb not null default '[]'::jsonb,
  hashtags text[] not null default '{}',
  cta_type text,
  promo_code_word text,
  asset_needed text,
  needs_owner_confirmation jsonb not null default '[]'::jsonb,
  confirmed_items jsonb not null default '[]'::jsonb,
  safety_status text not null default 'pass' check (safety_status in ('pass','pass_with_changes','blocked')),
  safety_findings jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','ready','posted','skipped')),
  posted_at timestamptz,
  tracking_code text not null unique,
  original_caption text,
  edited_caption text,
  no_filming boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_business_date_idx on public.posts(business_id, publish_date);
-- Code words are unique per business (case-insensitive).
create unique index posts_code_word_unique on public.posts(business_id, lower(promo_code_word))
  where promo_code_word is not null;

-- --------------------------------------------------------------- enquiries
create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  source text not null default 'manual' check (source in ('tracked_link','public_page','code_word','manual')),
  source_note text,
  name text,
  contact text,
  service_requested text,
  message text,
  status text not null default 'new' check (status in ('new','contacted','booked','completed','lost')),
  value_usd numeric,
  first_contacted_at timestamptz,
  booked_at timestamptz,
  completed_at timestamptz,
  overdue_notified_at timestamptz,
  notes text,
  consent_to_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index enquiries_business_idx on public.enquiries(business_id, created_at desc);

-- ----------------------------------------------------------- saved_replies
create table public.saved_replies (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  service text,
  body text not null,
  uses int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --------------------------------------------------------- review_requests
create table public.review_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  enquiry_id uuid references public.enquiries(id) on delete set null,
  customer_first_name text,
  channel text not null default 'sms' check (channel in ('sms','whatsapp','email','in_person_qr')),
  message_used text,
  status text not null default 'drafted'
    check (status in ('drafted','sent_by_owner','reviewed_self_reported','ignored')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------- link_clicks
create table public.link_clicks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null default 'tracked_link' check (kind in ('tracked_link','booking_link')),
  clicked_at timestamptz not null default now(),
  referrer text,
  ua_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index link_clicks_business_idx on public.link_clicks(business_id, clicked_at);

-- ---------------------------------------------------------- weekly_reviews
create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  week_start date not null,
  metrics jsonb not null default '{}'::jsonb,
  roi jsonb not null default '{}'::jsonb,
  top_posts jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  summary text,
  next_week_focus text,
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, week_start)
);

-- ---------------------------------------------------------- style_examples
create table public.style_examples (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('caption','reply')),
  before text not null,
  after text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index style_examples_business_idx on public.style_examples(business_id, kind, created_at desc);

-- ---------------------------------------------------------- billing_events
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null unique,
  type text not null,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------- push_subscriptions
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ ai_runs
create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null,
  input_hash text not null,
  model text not null,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  cost_usd numeric not null default 0,
  status text not null,
  error text,
  output jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_runs_cache_idx on public.ai_runs(kind, input_hash) where status = 'ok';
create index ai_runs_user_idx on public.ai_runs(user_id, created_at);

-- -------------------------------------------------------- safety_rules_meta
create table public.safety_rules_meta (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  last_verified date not null,
  notes text,
  rules jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------- rate_limits
-- Fixed-window counters for public endpoints and AI calls. Keys are hashed.
create table public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (key, window_start)
);

create or replace function public.hit_rate_limit(p_key text, p_window_seconds int, p_max int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  ws timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  c int;
begin
  insert into public.rate_limits(key, window_start, count) values (p_key, ws, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1, updated_at = now()
  returning count into c;
  return c <= p_max;
end $$;
revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;

-- ------------------------------------------------------------ updated_at
do $$
declare t text;
begin
  foreach t in array array['profiles','businesses','calendars','shoot_days','posts','enquiries',
    'saved_replies','review_requests','link_clicks','weekly_reviews','style_examples',
    'billing_events','push_subscriptions','ai_runs','safety_rules_meta','rate_limits']
  loop
    execute format('create trigger %I_updated_at before update on public.%I
      for each row execute function public.set_updated_at()', t, t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- -------------------------------------------------------------- policies
-- profiles: a user reads and updates only their own row. Billing columns are
-- written by the service role (webhooks), so updates are limited by a trigger.
create policy profiles_select on public.profiles for select using (user_id = auth.uid());
create policy profiles_update on public.profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.protect_profile_billing() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    new.plan_id := old.plan_id;
    new.billing_provider := old.billing_provider;
    new.billing_customer_ref := old.billing_customer_ref;
    new.billing_membership_ref := old.billing_membership_ref;
    new.subscription_status := old.subscription_status;
    new.trial_ends_at := old.trial_ends_at;
    new.past_due_since := old.past_due_since;
    new.current_period_end := old.current_period_end;
    new.referred_by := old.referred_by;
    new.is_admin := old.is_admin;
  end if;
  return new;
end $$;
create trigger profiles_protect_billing before update on public.profiles
  for each row execute function public.protect_profile_billing();

create policy businesses_all on public.businesses for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['calendars','shoot_days','posts','enquiries','saved_replies',
    'review_requests','weekly_reviews','style_examples']
  loop
    execute format('create policy %I_owner on public.%I for all
      using (public.owns_business(business_id)) with check (public.owns_business(business_id))', t, t);
  end loop;
end $$;

-- Read-only for owners; written by the server.
create policy link_clicks_select on public.link_clicks for select using (public.owns_business(business_id));
create policy ai_runs_select on public.ai_runs for select using (user_id = auth.uid());
create policy push_owner on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- billing_events, safety_rules_meta, rate_limits: no policies, service role only.
