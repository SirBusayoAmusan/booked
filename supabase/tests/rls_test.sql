-- RLS smoke test: user A must not see or modify user B's rows.
\set ON_ERROR_STOP on
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','a@example.com'),
                              ('00000000-0000-0000-0000-00000000000b','b@example.com');
insert into public.businesses (id, owner_id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000a','A Co','a-co'),
  ('10000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000b','B Co','b-co');
insert into public.enquiries (business_id, name) values
  ('10000000-0000-0000-0000-00000000000a','Alice'), ('10000000-0000-0000-0000-00000000000b','Bob');

set role authenticated;
set request.jwt.claim.role = 'authenticated';
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

do $$
declare n int;
begin
  select count(*) into n from public.businesses;
  if n <> 1 then raise exception 'businesses visible: %', n; end if;
  select count(*) into n from public.enquiries;
  if n <> 1 then raise exception 'enquiries visible: %', n; end if;
  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'profiles visible: %', n; end if;
  update public.enquiries set name = 'hacked' where business_id = '10000000-0000-0000-0000-00000000000b';
  begin
    insert into public.enquiries (business_id, name) values ('10000000-0000-0000-0000-00000000000b','x');
    raise exception 'cross-tenant insert was allowed';
  exception when insufficient_privilege then null;
  end;
  -- Billing columns cannot be self-upgraded.
  update public.profiles set subscription_status = 'active', is_admin = true;
end $$;

reset role;
do $$
begin
  if exists (select 1 from public.enquiries where name = 'hacked') then raise exception 'cross-tenant update'; end if;
  if exists (select 1 from public.profiles where subscription_status = 'active' or is_admin) then
    raise exception 'billing columns were self-updated';
  end if;
end $$;
select 'RLS tests passed' as result;
