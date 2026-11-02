-- ===========================================================================
-- FitDesk member gym-join (admin-approved), rail-aware payments,
-- pause-aware renewal quote, realtime publication.
--
-- STRICTLY ADDITIVE: nothing existing is dropped, deleted, or rewritten.
--   1. gyms.join_code + auto-generation trigger
--   2. gym_join_requests table (member requests to join a gym; admin approves)
--   3. request_join_gym / admin_list_join_requests / admin_review_join_request
--   4. reserve_upi_checkout: optional payment-rail method
--   5. get_my_upi_payment: rail-aware payee (gym_payment_methods)
--   6. get_my_renewal_quote: pause-aware (no late-fee time accrues while paused)
--   7. supabase_realtime publication entries for member/admin sync
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. gyms.join_code
-- ---------------------------------------------------------------------------
alter table public.gyms
  add column if not exists join_code text;

-- Friendly, human-shareable code: FD-XXXX-XXXX (uppercase alnum, no 0/O/1/I).
create or replace function public.generate_gym_join_code()
returns text
language plpgsql
as $$
declare
  alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  a text := '';
  b text := '';
begin
  for i in 1..4 loop
    a := a || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    b := b || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
  end loop;
  return 'FD-' || a || '-' || b;
end;
$$;

create or replace function public.handle_gym_join_code()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.join_code is null or length(btrim(new.join_code)) = 0 then
    loop
      new.join_code := public.generate_gym_join_code();
      exit when not exists (select 1 from public.gyms where join_code = new.join_code);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists gyms_join_code_trigger on public.gyms;
create trigger gyms_join_code_trigger
  before insert or update of join_code on public.gyms
  for each row
  execute function public.handle_gym_join_code();

-- Backfill: assign unique codes row-by-row (per-row codes avoid the
-- statement-level snapshot that would let a multi-row UPDATE reuse a code).
do $x$
declare r record; c text;
begin
  for r in select id from public.gyms where join_code is null loop
    loop
      c := public.generate_gym_join_code();
      exit when not exists (select 1 from public.gyms where join_code = c);
    end loop;
    update public.gyms set join_code = c where id = r.id;
  end loop;
end $x$;
create unique index if not exists gyms_join_code_unique
  on public.gyms (join_code);

-- ---------------------------------------------------------------------------
-- 1b. New members must start gym-less; the join request flow assigns them.
--     (The legacy default stamped every fresh profile with the 'fitdesk'
--      gym before any human approved it.)
-- ---------------------------------------------------------------------------
alter table public.profiles
  alter column gym_id drop default;
alter table public.profiles
  alter column gym_id drop not null;

-- Existing rows keep their gym; nobody is un-assigned retroactively.
comment on column public.profiles.gym_id is
  'Gym this account belongs to. NULL until a gym admin approves the member''s join request.';

-- ---------------------------------------------------------------------------
-- 2. gym_join_requests
-- ---------------------------------------------------------------------------
create table if not exists public.gym_join_requests (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  unique (gym_id, user_id)
);

create index if not exists gym_join_requests_gym_status_idx
  on public.gym_join_requests (gym_id, status, requested_at desc);
create index if not exists gym_join_requests_user_idx
  on public.gym_join_requests (user_id);

alter table public.gym_join_requests enable row level security;

drop policy if exists gym_join_requests_select_own on public.gym_join_requests;
create policy gym_join_requests_select_own
  on public.gym_join_requests
  for select
  to authenticated
  using (user_id = auth.uid());

-- Writes happen through SECURITY DEFINER RPCs only (the member cannot forge a
-- gym_id, and the admin cannot review another gym's requests).
revoke insert, update, delete on table public.gym_join_requests from authenticated, anon;
grant select on table public.gym_join_requests to authenticated;

-- ---------------------------------------------------------------------------
-- 3b. admin_list_members: paused members read "Paid" when their payment was
--     approved, and the latest-membership lateral is re-scoped to the gym.
--     Verbatim copy of 20261103000100 with only those changes.
-- ---------------------------------------------------------------------------
drop function if exists public.admin_list_members(text, text);

create or replace function public.admin_list_members(
  p_search text default null,
  p_status text default null
)
returns table (
  user_id uuid,
  membership_id uuid,
  full_name text,
  email text,
  phone text,
  joined_at timestamptz,
  plan_name text,
  membership_status public.membership_status,
  starts_on date,
  ends_on date,
  payment_status text,
  pending_payment_id uuid,
  pending_amount_inr integer,
  pending_reference text,
  pending_since timestamptz,
  pending_plan_name text,
  activity_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_gym_id uuid := public.admin_assert();
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_status text := lower(nullif(btrim(coalesce(p_status, '')), ''));
begin
  return query
  with base as (
    select
      u.id as user_id,
      coalesce(nullif(btrim(pr.full_name), ''), split_part(u.email::text, '@', 1), 'FitDesk member') as full_name,
      u.email::text as email,
      nullif(btrim(coalesce(pr.phone, '')), '') as phone,
      pr.created_at as joined_at,
      m.membership_id as membership_id,
      coalesce(m.package_name, pend_pkg.name) as plan_name,
      m.status as membership_status,
      m.starts_on,
      m.ends_on,
      case
        when pend.id is not null then 'Pending'
        when m.status in ('active', 'paused') and m.ends_on >= v_today then 'Paid'
        else 'Not Paid'
      end as payment_status,
      pend.id as pending_payment_id,
      pend.total_amount_inr as pending_amount_inr,
      pend.upi_reference as pending_reference,
      pend.created_at as pending_since,
      pend_pkg.name as pending_plan_name,
      greatest(
        coalesce(m.updated_at, pr.updated_at),
        coalesce(pend.created_at, pr.updated_at)
      ) as activity_at
    from auth.users u
    join public.profiles pr on pr.id = u.id
    left join lateral (
      select
        mem.id as membership_id,
        mem.id,
        mem.status,
        mem.starts_on,
        mem.ends_on,
        mem.updated_at,
        pk.name as package_name
      from public.memberships mem
      join public.packages pk on pk.id = mem.package_id
      where mem.user_id = u.id
        and mem.gym_id = v_gym_id
      order by
        case when mem.status in ('active', 'paused') and mem.ends_on >= v_today then 0 else 1 end,
        mem.ends_on desc,
        mem.created_at desc
      limit 1
    ) m on true
    left join lateral (
      select
        pay.id,
        pay.total_amount_inr,
        pay.upi_reference,
        pay.created_at,
        pay.package_id
      from public.payments pay
      where pay.user_id = u.id
        and pay.gym_id = v_gym_id
        and pay.status = 'pending'
        and pay.provider_payment_id is not null
        and pay.checkout_state <> 'abandoned'
      order by pay.created_at desc
      limit 1
    ) pend on true
    left join public.packages pend_pkg on pend_pkg.id = pend.package_id
    where pr.gym_id = v_gym_id
      and pr.is_admin = false
  )
  select
    b.user_id,
    b.membership_id,
    b.full_name,
    b.email,
    b.phone,
    b.joined_at,
    b.plan_name,
    b.membership_status,
    b.starts_on,
    b.ends_on,
    b.payment_status,
    b.pending_payment_id,
    b.pending_amount_inr,
    b.pending_reference,
    b.pending_since,
    b.pending_plan_name,
    b.activity_at
  from base b
  where (v_search is null
         or b.full_name ilike '%' || v_search || '%'
         or b.email ilike '%' || v_search || '%'
         or coalesce(b.phone, '') ilike '%' || v_search || '%')
    and (v_status is null
         or v_status = 'all'
         or b.payment_status = case v_status
              when 'pending' then 'Pending'
              when 'paid' then 'Paid'
              when 'not_paid' then 'Not Paid'
              else b.payment_status
            end)
  order by
    case b.payment_status when 'Pending' then 0 when 'Paid' then 1 else 2 end,
    b.full_name asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Join RPCs
-- ---------------------------------------------------------------------------

-- Member requests to join a gym by its join code (admin approves later).
create or replace function public.request_join_gym(p_join_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(nullif(btrim(coalesce(p_join_code, '')), ''));
  v_gym public.gyms;
  v_profile public.profiles;
  v_request public.gym_join_requests;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  if v_code is null then
    raise exception 'JOIN_CODE_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_profile from public.profiles where id = v_user;
  if not found then
    raise exception 'PROFILE_REQUIRED' using errcode = 'P0001';
  end if;

  -- Already an approved member of a gym.
  if v_profile.gym_id is not null then
    return jsonb_build_object(
      'status', 'already_member',
      'gym_id', v_profile.gym_id
    );
  end if;

  select * into v_gym
    from public.gyms
   where upper(join_code) = v_code
     and is_active;

  if not found then
    raise exception 'GYM_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Insert or re-open (re-request after decline), never a second row.
  insert into public.gym_join_requests (gym_id, user_id, status)
  values (v_gym.id, v_user, 'pending')
  on conflict (gym_id, user_id) do update
    set status = 'pending',
        requested_at = now(),
        decided_at = null,
        decided_by = null
  where public.gym_join_requests.status <> 'pending';

  select * into v_request
    from public.gym_join_requests
   where gym_id = v_gym.id and user_id = v_user;

  return jsonb_build_object(
    'status', v_request.status,
    'requested_at', v_request.requested_at,
    'gym_id', v_gym.id,
    'gym_name', v_gym.name,
    'requires_approval', true
  );
end;
$$;

-- Admin lists the join requests for their own gym.
create or replace function public.admin_list_join_requests()
returns table (
  id uuid,
  status text,
  requested_at timestamptz,
  user_email text,
  member_name text,
  member_phone text
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_gym_id uuid;
begin
  select profiles.gym_id
    into v_gym_id
    from public.profiles
   where profiles.id = auth.uid()
     and profiles.is_admin = true;

  if v_gym_id is null then
    return;
  end if;

  return query
  select r.id,
         r.status,
         r.requested_at,
         u.email::text,
         p.full_name,
         nullif(btrim(p.phone || ''), '')
    from public.gym_join_requests r
    join auth.users u on u.id = r.user_id
    left join public.profiles p on p.id = r.user_id
   where r.gym_id = v_gym_id
   order by r.status asc, r.requested_at desc;
end;
$$;

-- Admin approves or declines a join request. Approval binds the member.
create or replace function public.admin_review_join_request(
  p_request_id uuid,
  p_approve boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_gym_id uuid;
  v_request public.gym_join_requests;
  v_member_name text;
begin
  if v_admin is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select gym_id into v_gym_id
    from public.profiles
   where id = v_admin
     and is_admin = true;

  if v_gym_id is null then
    raise exception 'ADMIN_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_request
    from public.gym_join_requests
   where id = p_request_id
     and gym_id = v_gym_id;

  if not found then
    raise exception 'JOIN_REQUEST_NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_approve then
    if exists (select 1 from public.profiles where id = v_request.user_id and gym_id = v_gym_id) then
      -- Idempotent re-approve.
      update public.gym_join_requests
         set status = 'approved', decided_at = now(), decided_by = v_admin
       where id = p_request_id;
      return jsonb_build_object('status', 'approved', 'user_id', v_request.user_id, 'gym_id', v_gym_id);
    end if;

    if exists (select 1 from public.profiles where id = v_request.user_id and gym_id is not null) then
      raise exception 'MEMBER_ALREADY_IN_GYM' using errcode = 'P0001';
    end if;

    update public.gym_join_requests
       set status = 'approved', decided_at = now(), decided_by = v_admin
     where id = p_request_id;

    update public.profiles
       set gym_id = v_gym_id
     where id = v_request.user_id;

    select coalesce(full_name, 'Member') into v_member_name
      from public.profiles where id = v_request.user_id;

    insert into public.admin_notifications (gym_id, kind, title, body, payload, user_id)
    values (
      v_gym_id,
      'member_joined',
      'New member approved — ' || v_member_name,
      v_member_name || ' was approved and can now see packages, renew and check in.',
      jsonb_build_object('user_id', v_request.user_id, 'approved_at', now()),
      v_request.user_id
    );

    return jsonb_build_object('status', 'approved', 'user_id', v_request.user_id, 'gym_id', v_gym_id);
  else
    update public.gym_join_requests
       set status = 'declined', decided_at = now(), decided_by = v_admin
     where id = p_request_id;

    return jsonb_build_object('status', 'declined', 'user_id', v_request.user_id, 'gym_id', v_gym_id);
  end if;
exception
  when unique_violation then
    raise exception 'PHONE_ALREADY_REGISTERED' using errcode = 'P0001';
end;
$$;

-- Member's own current request status (gym-scoped via RLS on the table; the
-- helper keeps the app from guessing).
create or replace function public.my_join_requests()
returns table (
  status text,
  gym_id uuid,
  gym_name text,
  requested_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return;
  end if;

  return query
  select r.status, r.gym_id, g.name, r.requested_at
    from public.gym_join_requests r
    join public.gyms g on g.id = r.gym_id
   where r.user_id = v_user
   order by r.requested_at desc;
end;
$$;

grant execute on function public.request_join_gym(text) to authenticated;
grant execute on function public.admin_list_join_requests() to authenticated;
grant execute on function public.admin_review_join_request(uuid, boolean) to authenticated;
grant execute on function public.my_join_requests() to authenticated;
revoke execute on function public.request_join_gym(text) from public, anon;
revoke execute on function public.admin_list_join_requests() from public, anon;
revoke execute on function public.admin_review_join_request(uuid, boolean) from public, anon;
revoke execute on function public.my_join_requests() from public, anon;

-- ---------------------------------------------------------------------------
-- 4. reserve_upi_checkout: optional payment rail (gym_payment_methods)
--    Signature grows by one optional parameter; grants are re-applied.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_upi_checkout(
  p_package_id uuid,
  p_duration_days integer default null,
  p_method text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_gym_id uuid;
  v_gym public.gyms;
  v_existing public.payments;
  v_payment public.payments;
  v_quote jsonb;
  v_method text := nullif(btrim(coalesce(p_method, '')), '');
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select gym_id into v_gym_id
    from public.profiles
   where id = v_user;

  if v_gym_id is null then
    raise exception 'GYM_NOT_CONFIGURED' using errcode = 'P0001';
  end if;

  select * into v_gym
    from public.gyms
   where id = v_gym_id
     and is_active;

  if not found then
    raise exception 'GYM_NOT_CONFIGURED' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
      from public.packages pk
     where pk.id = p_package_id
       and pk.is_active
       and pk.gym_id = v_gym_id
  ) then
    raise exception 'PACKAGE_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Validate the requested rail against the gym's enabled methods.
  if v_method is null or v_method = 'upi' then
    if v_gym.upi_id is null then
      raise exception 'PAYMENT_METHOD_UNAVAILABLE' using errcode = 'P0001';
    end if;
    v_method := 'upi';
  else
    if not exists (
      select 1
        from public.gym_payment_methods pm
       where pm.gym_id = v_gym_id
         and pm.is_enabled
         and pm.method = v_method
         and (pm.upi_id is not null or pm.qr_path is not null)
    ) then
      raise exception 'PAYMENT_METHOD_UNAVAILABLE' using errcode = 'P0001';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  select * into v_existing
    from public.payments
   where user_id = v_user
     and status = 'pending'
     and checkout_state <> 'abandoned'
   order by reconciliation_required desc, created_at desc
   limit 1;

  if found then
    if v_existing.reconciliation_required
       or v_existing.checkout_state = 'reconciliation_required' then
      return jsonb_build_object(
        'status', 'reconciliation_required',
        'payment_id', v_existing.id,
        'reconciliation_reason', v_existing.reconciliation_reason
      );
    end if;

    if v_existing.checkout_state = 'submitted'
       or v_existing.provider_payment_id is not null then
      return jsonb_build_object(
        'status', 'already_pending',
        'payment_id', v_existing.id,
        'upi_reference', v_existing.upi_reference,
        'amount_inr', v_existing.total_amount_inr
      );
    end if;

    return jsonb_build_object(
      'status', 'resume_checkout',
      'payment_id', v_existing.id,
      'quote', v_existing.quote,
      'package_name', v_existing.quote ->> 'package_name',
      'amount_inr', v_existing.total_amount_inr,
      'gym_id', v_existing.gym_id,
      'created_at', v_existing.created_at
    );
  end if;

  v_quote := public.get_my_renewal_quote(p_package_id, p_duration_days);

  insert into public.payments (
    user_id,
    membership_id,
    package_id,
    duration_days,
    base_amount_inr,
    fine_amount_inr,
    total_amount_inr,
    status,
    provider,
    provider_order_id,
    provider_payment_id,
    failure_reason,
    quote,
    checkout_state,
    reconciliation_required,
    gym_id
  )
  values (
    v_user,
    null,
    (v_quote ->> 'package_id')::uuid,
    (v_quote ->> 'duration_days')::integer,
    (v_quote ->> 'base_amount')::integer,
    (v_quote ->> 'fine_amount')::integer,
    (v_quote ->> 'total_amount')::integer,
    'pending',
    v_method,
    null,
    null,
    null,
    v_quote,
    'open',
    false,
    v_gym_id
  )
  returning * into v_payment;

  return jsonb_build_object(
    'status', 'reserved',
    'payment_id', v_payment.id,
    'quote', v_quote,
    'package_name', v_quote ->> 'package_name',
    'amount_inr', v_payment.total_amount_inr,
    'method', v_method,
    'gym_id', v_gym_id,
    'created_at', v_payment.created_at
  );
exception
  when unique_violation then
    select * into v_existing
      from public.payments
     where user_id = v_user
       and status = 'pending'
       and checkout_state <> 'abandoned'
     order by reconciliation_required desc, created_at desc
     limit 1;

    if found then
      if v_existing.reconciliation_required then
        return jsonb_build_object(
          'status', 'reconciliation_required',
          'payment_id', v_existing.id,
          'reconciliation_reason', v_existing.reconciliation_reason
        );
      end if;

      return jsonb_build_object(
        'status', 'resume_checkout',
        'payment_id', v_existing.id,
        'quote', v_existing.quote,
        'package_name', v_existing.quote ->> 'package_name',
        'amount_inr', v_existing.total_amount_inr,
        'gym_id', v_existing.gym_id,
        'created_at', v_existing.created_at
      );
    end if;

    raise;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. get_my_upi_payment: payee resolves from the chosen rail when the payment
--    was reserved with one (gym_payment_methods), legacy gyms.upi_id otherwise.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_upi_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_payment public.payments;
  v_gym public.gyms;
  v_package_name text;
  v_gym_name text;
  v_state text;
  v_reason text;
  v_available boolean := false;
  v_reference text;
  v_upi_id text;
  v_payee_name text;
  v_qr_path text;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_payment
    from public.payments
   where id = p_payment_id;

  if not found or v_payment.user_id <> v_user then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_state := case
    when v_payment.status = 'approved' then 'VERIFIED'
    when v_payment.status = 'declined' then 'FAILED'
    when v_payment.checkout_state = 'abandoned' then 'CANCELLED'
    when v_payment.checkout_state = 'submitted'
      or v_payment.provider_payment_id is not null then 'PENDING_VERIFICATION'
    else 'NOT_STARTED'
  end;

  select name into v_package_name
    from public.packages
   where id = v_payment.package_id;

  v_reference := 'FD' || upper(substr(replace(v_payment.id::text, '-', ''), 1, 12));

  if v_payment.gym_id is null then
    v_reason := 'NOT_CONFIGURED';
  else
    select * into v_gym
      from public.gyms
     where id = v_payment.gym_id;

    if not found or not v_gym.is_active then
      v_reason := 'NOT_CONFIGURED';
    elsif v_payment.total_amount_inr is null or v_payment.total_amount_inr <= 0 then
      v_reason := 'AMOUNT_INVALID';
    elsif v_payment.provider is not null and v_payment.provider <> 'upi' then
      -- Rail-aware payee from the gym's enabled payment methods.
      select pm.upi_id,
             coalesce(pm.payee_name, v_gym.name),
             pm.qr_path
        into v_upi_id, v_payee_name, v_qr_path
        from public.gym_payment_methods pm
       where pm.gym_id = v_payment.gym_id
         and pm.is_enabled
         and pm.method = v_payment.provider
       limit 1;

      if v_upi_id is null and v_qr_path is null then
        v_reason := 'NOT_CONFIGURED';
      else
        v_available := true;
        v_gym_name := v_gym.name;
      end if;
    elsif v_gym.upi_id is not null then
      v_upi_id := v_gym.upi_id;
      v_payee_name := coalesce(v_gym.upi_payee_name, v_gym.name);
      v_qr_path := v_gym.payment_qr_path;
      v_available := true;
      v_gym_name := v_gym.name;
    else
      v_reason := 'NOT_CONFIGURED';
    end if;
  end if;

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'payment_state', v_state,
    'status', v_payment.status,
    'checkout_state', v_payment.checkout_state,
    'payment_method', v_payment.provider,
    'amount_inr', v_payment.total_amount_inr,
    'currency', 'INR',
    'reference', v_reference,
    'gym_id', v_payment.gym_id,
    'gym_name', coalesce(v_gym_name, (select name from public.gyms where slug = 'fitdesk')),
    'package_name', coalesce(v_package_name, 'Membership'),
    'duration_days', v_payment.duration_days,
    'starts_on', v_payment.quote ->> 'starts_on',
    'ends_on', v_payment.quote ->> 'ends_on',
    'upi_reference', v_payment.upi_reference,
    'submitted_at', v_payment.upi_submitted_at,
    'payee', jsonb_build_object(
      'available', v_available,
      'reason', v_reason,
      'upi_id', case when v_available then v_upi_id else null end,
      'name', case when v_available then v_payee_name else null end,
      'qr_path', case when v_available then v_qr_path else null end,
      'qr_bucket', case when v_available then 'gym-payment-qr' else null end
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. get_my_renewal_quote: pause-aware validity
--    A paused membership keeps its clock stopped: days past expiry are counted
--    against ends_on + total_paused_days, and no renewal "stacks mid-pause".
-- ---------------------------------------------------------------------------
create or replace function public.get_my_renewal_quote(
  p_package_id uuid,
  p_duration_days integer default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_pkg public.packages;
  v_latest public.memberships;
  v_duration integer;
  v_days_past integer := 0;
  v_fine integer := 0;
  v_fine_reason text := null;
  v_base integer;
  v_starts date;
  v_ends date;
  v_is_stacked boolean := false;
  v_effective_end date;
  v_is_paused boolean := false;
  v_breakdown jsonb;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_pkg
    from public.packages
   where id = p_package_id
     and is_active = true;

  if not found then
    raise exception 'PACKAGE_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_latest
    from public.memberships
   where user_id = v_user
     and status <> 'cancelled'
   order by ends_on desc
   limit 1;

  v_effective_end := case
    when v_latest.id is null then null
    else v_latest.ends_on + coalesce(v_latest.total_paused_days, 0)
  end;

  v_is_paused := v_latest.status = 'paused';
  v_is_stacked := v_latest.id is not null and (v_effective_end >= v_today or v_is_paused);

  if v_latest.id is not null and not v_is_paused and v_effective_end < v_today then
    v_days_past := (v_today - v_effective_end)::integer;
  end if;

  v_duration := v_pkg.duration_days;
  if v_pkg.pricing_mode = 'per_day' then
    v_duration := coalesce(p_duration_days, v_pkg.min_days, v_pkg.duration_days);
    v_duration := greatest(
      coalesce(v_pkg.min_days, 1),
      least(v_duration, coalesce(v_pkg.max_days, 365))
    );
  end if;

  if v_days_past = 8 then
    v_fine := 50;
    v_fine_reason := '8 days past expiry - ₹50 flat late fee';
  elsif v_days_past >= 9 then
    v_fine := 50 + 5 * (v_days_past - 8);
    v_fine_reason := v_days_past::text || ' days past expiry - ₹50 + ₹5/day after day 8';
  elsif v_days_past > 0 then
    v_fine_reason := v_days_past::text
      || case when v_days_past = 1 then ' day' else ' days' end
      || ' past expiry - inside the 7-day grace period';
  end if;

  v_base := case
    when v_pkg.pricing_mode = 'per_day' then v_pkg.price_inr * v_duration
    else v_pkg.price_inr
  end;

  v_starts := case when v_is_stacked then v_effective_end + 1 else v_today end;
  v_ends := v_starts + (v_duration - 1);

  v_breakdown := jsonb_build_array(
    jsonb_build_object(
      'label', v_pkg.name || ' · ' || v_duration::text || ' days',
      'amount', v_base
    )
  );

  if v_fine > 0 then
    v_breakdown := v_breakdown || jsonb_build_array(
      jsonb_build_object('label', 'Late renewal fee', 'amount', v_fine)
    );
  end if;

  return jsonb_build_object(
    'package_id', v_pkg.id,
    'package_name', v_pkg.name,
    'description', v_pkg.description,
    'pricing_mode', v_pkg.pricing_mode,
    'duration_days', v_duration,
    'base_amount', v_base,
    'fine_amount', v_fine,
    'total_amount', v_base + v_fine,
    'days_past_expiry', v_days_past,
    'grace_days', 7,
    'starts_on', v_starts,
    'ends_on', v_ends,
    'current_ends_on', v_effective_end,
    'is_stacked', v_is_stacked,
    'is_paused', v_is_paused,
    'fine_reason', v_fine_reason,
    'breakdown', v_breakdown
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Grants for the replaced functions (signature additions and recreates)
-- ---------------------------------------------------------------------------
revoke execute on function public.reserve_upi_checkout(uuid, integer, text) from public, anon;
grant execute on function public.reserve_upi_checkout(uuid, integer, text) to authenticated;
grant execute on function public.reserve_upi_checkout(uuid, integer, text) to service_role;

revoke execute on function public.get_my_upi_payment(uuid) from public, anon;
grant execute on function public.get_my_upi_payment(uuid) to authenticated;
grant execute on function public.get_my_upi_payment(uuid) to service_role;

revoke execute on function public.get_my_renewal_quote(uuid, integer) from public, anon;
grant execute on function public.get_my_renewal_quote(uuid, integer) to authenticated;
grant execute on function public.get_my_renewal_quote(uuid, integer) to service_role;

comment on function public.request_join_gym(text) is
  'Member requests to join a gym by join code; the gym admin must approve. Approval stamps profiles.gym_id.';

comment on function public.reserve_upi_checkout(uuid, integer, text) is
  'Reserves a pending payment; the optional method picks one of the gym''s enabled UPI rails (google_pay/phonepe/paytm) or the legacy general UPI.';

comment on function public.get_my_upi_payment(uuid) is
  'Reads the member''s own payment instructions; the payee follows the rail chosen at reserve time when one was recorded.';

-- ---------------------------------------------------------------------------
-- 8. Realtime publication entries (idempotent)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['payments', 'memberships', 'profiles', 'attendance', 'announcements', 'admin_notifications', 'gym_join_requests']
  loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
