-- ===========================================================================
-- FitDesk membership management features
--   1. Cancel membership (admin)
--   2. Pause / resume membership (admin) with validity preservation
--   3. Persistent admin notifications, including expired-unpaid QR scan alerts
--   4. 'paused' membership status
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Enum: add 'paused'
-- ---------------------------------------------------------------------------
alter type public.membership_status add value if not exists 'paused';

-- ---------------------------------------------------------------------------
-- 2. Memberships: cancellation + pause metadata
-- ---------------------------------------------------------------------------
alter table public.memberships
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null,
  add column if not exists cancellation_reason text,
  add column if not exists paused_at timestamptz,
  add column if not exists paused_by uuid references public.profiles(id) on delete set null,
  add column if not exists pause_reason text,
  add column if not exists resumed_at timestamptz,
  add column if not exists resumed_by uuid references public.profiles(id) on delete set null,
  add column if not exists total_paused_days integer not null default 0,
  add column if not exists paused_until date;

-- ---------------------------------------------------------------------------
-- 3. Pause/resume history
-- ---------------------------------------------------------------------------
create table if not exists public.membership_pauses (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  paused_at timestamptz not null default now(),
  paused_by uuid references public.profiles(id) on delete set null,
  reason text,
  resumed_at timestamptz,
  resumed_by uuid references public.profiles(id) on delete set null,
  paused_days integer,
  created_at timestamptz not null default now()
);

create index if not exists membership_pauses_membership_idx
  on public.membership_pauses (membership_id, paused_at desc);
create index if not exists membership_pauses_gym_idx
  on public.membership_pauses (gym_id);

-- ---------------------------------------------------------------------------
-- 4. Admin notifications
-- ---------------------------------------------------------------------------
create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  user_id uuid references public.profiles(id) on delete set null,
  membership_id uuid references public.memberships(id) on delete set null,
  is_read boolean not null default false,
  read_at timestamptz,
  read_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Idempotency: one expired-unpaid notification per membership per expiry date.
create unique index if not exists admin_notifications_expired_unpaid_unique
  on public.admin_notifications (gym_id, membership_id, kind, (payload->>'expiry_date'))
  where kind = 'membership_expired_unpaid';

create index if not exists admin_notifications_gym_read_idx
  on public.admin_notifications (gym_id, is_read, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
alter table public.membership_pauses enable row level security;
alter table public.admin_notifications enable row level security;

-- membership_pauses: gym admins only
drop policy if exists membership_pauses_admin_all on public.membership_pauses;
create policy membership_pauses_admin_all on public.membership_pauses
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true and p.gym_id = membership_pauses.gym_id))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true and p.gym_id = membership_pauses.gym_id));

-- admin_notifications: gym admins only
drop policy if exists admin_notifications_admin_all on public.admin_notifications;
create policy admin_notifications_admin_all on public.admin_notifications
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true and p.gym_id = admin_notifications.gym_id))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true and p.gym_id = admin_notifications.gym_id));

-- ---------------------------------------------------------------------------
-- 6. Helper: admin_assert (already exists) returns gym_id
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 7. admin_cancel_membership
-- ---------------------------------------------------------------------------
create or replace function public.admin_cancel_membership(
  p_membership_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gym_id uuid := public.admin_assert();
  v_membership public.memberships;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_membership
    from public.memberships
   where id = p_membership_id
     and gym_id = v_gym_id
   for update;

  if not found then
    raise exception 'MEMBERSHIP_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_membership.status = 'cancelled' then
    raise exception 'ALREADY_CANCELLED' using errcode = 'P0001';
  end if;

  -- Cannot cancel a paused membership without resuming? Allow cancel from any non-cancelled state.
  update public.memberships
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancellation_reason = v_reason,
         updated_at = now()
   where id = p_membership_id;

  return jsonb_build_object(
    'membership_id', p_membership_id,
    'status', 'cancelled',
    'cancelled_at', now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. admin_pause_membership
-- ---------------------------------------------------------------------------
create or replace function public.admin_pause_membership(
  p_membership_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gym_id uuid := public.admin_assert();
  v_membership public.memberships;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if v_reason is null then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_membership
    from public.memberships
   where id = p_membership_id
     and gym_id = v_gym_id
   for update;

  if not found then
    raise exception 'MEMBERSHIP_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_membership.status = 'cancelled' then
    raise exception 'CANCELLED_MEMBERSHIP' using errcode = 'P0001';
  end if;

  if v_membership.status = 'paused' then
    raise exception 'ALREADY_PAUSED' using errcode = 'P0001';
  end if;

  if v_membership.status <> 'active' then
    raise exception 'MEMBERSHIP_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  -- If membership already expired, pausing is not meaningful.
  if v_membership.ends_on < v_today then
    raise exception 'MEMBERSHIP_EXPIRED' using errcode = 'P0001';
  end if;

  update public.memberships
     set status = 'paused',
         paused_at = now(),
         paused_by = auth.uid(),
         pause_reason = v_reason,
         paused_until = v_today,
         updated_at = now()
   where id = p_membership_id;

  insert into public.membership_pauses (membership_id, gym_id, paused_at, paused_by, reason)
  values (p_membership_id, v_gym_id, now(), auth.uid(), v_reason);

  return jsonb_build_object(
    'membership_id', p_membership_id,
    'status', 'paused',
    'paused_at', now(),
    'paused_from', v_today
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. admin_resume_membership
-- ---------------------------------------------------------------------------
create or replace function public.admin_resume_membership(
  p_membership_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gym_id uuid := public.admin_assert();
  v_membership public.memberships;
  v_pause public.membership_pauses;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_paused_days integer;
  v_new_ends_on date;
begin
  select * into v_membership
    from public.memberships
   where id = p_membership_id
     and gym_id = v_gym_id
   for update;

  if not found then
    raise exception 'MEMBERSHIP_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_membership.status = 'cancelled' then
    raise exception 'CANCELLED_MEMBERSHIP' using errcode = 'P0001';
  end if;

  if v_membership.status <> 'paused' then
    raise exception 'NOT_PAUSED' using errcode = 'P0001';
  end if;

  -- Find the open pause row.
  select * into v_pause
    from public.membership_pauses
   where membership_id = p_membership_id
     and resumed_at is null
   order by paused_at desc
   limit 1
   for update;

  if not found then
    raise exception 'NO_OPEN_PAUSE' using errcode = 'P0001';
  end if;

  v_paused_days := greatest(1, (v_today - coalesce(v_membership.paused_until, v_today::date)) + 1);
  -- Ensure at least the days since paused_until; if resumed same day, 1 day.
  if v_paused_days < 1 then v_paused_days := 1; end if;

  v_new_ends_on := v_membership.ends_on + v_paused_days;

  update public.membership_pauses
     set resumed_at = now(),
         resumed_by = auth.uid(),
         paused_days = v_paused_days
   where id = v_pause.id;

  update public.memberships
     set status = 'active',
         ends_on = v_new_ends_on,
         total_paused_days = total_paused_days + v_paused_days,
         paused_at = null,
         paused_by = null,
         pause_reason = null,
         paused_until = null,
         resumed_at = now(),
         resumed_by = auth.uid(),
         updated_at = now()
   where id = p_membership_id;

  return jsonb_build_object(
    'membership_id', p_membership_id,
    'status', 'active',
    'paused_days', v_paused_days,
    'new_ends_on', v_new_ends_on
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. admin_list_notifications
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_notifications(
  p_limit integer default 50
) returns table (
  id uuid,
  kind text,
  title text,
  body text,
  payload jsonb,
  user_id uuid,
  membership_id uuid,
  member_name text,
  member_phone text,
  is_read boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_gym_id uuid := public.admin_assert();
begin
  return query
  select n.id, n.kind, n.title, n.body, n.payload, n.user_id, n.membership_id,
         p.full_name, p.phone, n.is_read, n.created_at
    from public.admin_notifications n
    left join public.profiles p on p.id = n.user_id
   where n.gym_id = v_gym_id
   order by n.created_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. admin_unread_notification_count
-- ---------------------------------------------------------------------------
create or replace function public.admin_unread_notification_count()
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_gym_id uuid := public.admin_assert();
  v_count integer;
begin
  select count(*)::integer into v_count
    from public.admin_notifications
   where gym_id = v_gym_id
     and is_read = false;
  return coalesce(v_count, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. admin_mark_notification_read
-- ---------------------------------------------------------------------------
create or replace function public.admin_mark_notification_read(
  p_notification_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gym_id uuid := public.admin_assert();
begin
  update public.admin_notifications
     set is_read = true,
         read_at = now(),
         read_by = auth.uid()
   where id = p_notification_id
     and gym_id = v_gym_id;
  if not found then
    raise exception 'NOTIFICATION_NOT_FOUND' using errcode = 'P0001';
  end if;
  return jsonb_build_object('id', p_notification_id, 'is_read', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. admin_mark_all_notifications_read
-- ---------------------------------------------------------------------------
create or replace function public.admin_mark_all_notifications_read()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gym_id uuid := public.admin_assert();
  v_count integer;
begin
  update public.admin_notifications
     set is_read = true,
         read_at = now(),
         read_by = auth.uid()
   where gym_id = v_gym_id
     and is_read = false;
  get diagnostics v_count = row_count;
  return jsonb_build_object('marked', v_count);
end;
$$;

-- ---------------------------------------------------------------------------
-- 14. Modify check_in_with_qr to add expired-unpaid notification
--     (recreate with notification logic, preserving existing behavior)
-- ---------------------------------------------------------------------------
-- We patch by replacing the function. The new version adds, after the active
-- membership lookup fails, a notification insert for expired-unpaid members
-- past the 3-day grace period, then raises MEMBERSHIP_INACTIVE as before.
create or replace function public.check_in_with_qr(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_qr public.gym_qr_codes;
  v_membership public.memberships;
  v_latest_membership public.memberships;
  v_attendance public.attendance;
  v_gym_name text;
  v_profile public.profiles;
  v_has_closure boolean := false;
  v_paid boolean := false;
  v_notify boolean := false;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  if p_token is null or length(btrim(p_token)) = 0 then
    raise exception 'INVALID_QR' using errcode = 'P0001';
  end if;

  select * into v_qr
    from public.gym_qr_codes
   where token_hash = encode(extensions.digest(btrim(p_token), 'sha256'), 'hex')
     and is_active = true
     and revoked_at is null
   limit 1;

  if not found then
    raise exception 'INVALID_QR' using errcode = 'P0001';
  end if;

  select * into v_profile
    from public.profiles
   where id = v_user;

  if not found or v_profile.profile_completed = false then
    raise exception 'PROFILE_INCOMPLETE' using errcode = 'P0001';
  end if;

  if v_qr.gym_id is not null and v_qr.gym_id <> v_profile.gym_id then
    raise exception 'QR_GYM_MISMATCH' using errcode = '42501';
  end if;

  select exists (
    select 1
      from public.announcements
     where gym_id = v_profile.gym_id
       and is_active = true
       and kind in ('holiday', 'closure')
       and starts_on <= v_today
       and (ends_on is null or ends_on >= v_today)
  ) into v_has_closure;

  if v_has_closure then
    raise exception 'GYM_CLOSED' using errcode = 'P0001';
  end if;

  -- Active membership covering today.
  select * into v_membership
    from public.memberships
   where user_id = v_user
     and gym_id = v_profile.gym_id
     and status = 'active'
     and starts_on <= v_today
     and ends_on >= v_today
   order by ends_on desc
   limit 1;

  if not found then
    -- Expired-unpaid notification logic (past 3-day grace period).
    select * into v_latest_membership
      from public.memberships
     where user_id = v_user
       and gym_id = v_profile.gym_id
     order by ends_on desc
     limit 1;

    if found and v_latest_membership.ends_on is not null
       and v_today >= (v_latest_membership.ends_on + 4) then
      -- Check if paid: any approved payment created after expiry.
      select exists (
        select 1 from public.payments
         where user_id = v_user
           and gym_id = v_profile.gym_id
           and status = 'approved'
           and created_at::date > v_latest_membership.ends_on
      ) into v_paid;

      if not v_paid and v_latest_membership.status <> 'cancelled' and v_latest_membership.status <> 'paused' then
        v_notify := true;
      end if;
    end if;

    if v_notify then
      insert into public.admin_notifications (gym_id, kind, title, body, payload, user_id, membership_id)
      values (
        v_profile.gym_id,
        'membership_expired_unpaid',
        'Membership Expired — ' || coalesce(v_profile.full_name, 'Member'),
        coalesce(v_profile.full_name, 'Member') || ' scanned the gym attendance QR code, but their membership expired on ' ||
          to_char(v_latest_membership.ends_on, 'DD Mon YYYY') || ' and the outstanding payment is still unpaid.',
        jsonb_build_object(
          'member_name', v_profile.full_name,
          'phone', v_profile.phone,
          'package_id', v_latest_membership.package_id,
          'expiry_date', v_latest_membership.ends_on,
          'attempted_at', now()
        ),
        v_user,
        v_latest_membership.id
      )
      on conflict do nothing;

      return jsonb_build_object(
        'status', 'membership_inactive',
        'message', 'Your membership expired on ' || to_char(v_latest_membership.ends_on, 'DD Mon YYYY') || '. Please renew to continue.',
        'member_name', v_profile.full_name
      );
    end if;

    raise exception 'MEMBERSHIP_INACTIVE' using errcode = 'P0001';
  end if;

  select coalesce(name, 'FitDesk') into v_gym_name
    from public.gyms
   where id = v_profile.gym_id;

  select * into v_attendance
    from public.attendance
   where user_id = v_user
     and check_in_date = v_today;

  if found then
    return jsonb_build_object(
      'status', 'already_checked_in',
      'attendance_id', v_attendance.id,
      'check_in_at', v_attendance.check_in_at,
      'check_in_date', v_attendance.check_in_date,
      'gym_name', coalesce(v_gym_name, 'FitDesk'),
      'message', 'You already checked in today. One scan per day is enough.'
    );
  end if;

  insert into public.attendance (user_id, check_in_at, source, gym_qr_id)
  values (v_user, now(), 'qr', v_qr.id)
  on conflict (user_id, check_in_date) do nothing
  returning * into v_attendance;

  if v_attendance.id is null then
    select * into v_attendance
      from public.attendance
     where user_id = v_user
       and check_in_date = v_today;

    return jsonb_build_object(
      'status', 'already_checked_in',
      'attendance_id', v_attendance.id,
      'check_in_at', v_attendance.check_in_at,
      'check_in_date', v_attendance.check_in_date,
      'gym_name', coalesce(v_gym_name, 'FitDesk'),
      'message', 'You already checked in today. One scan per day is enough.'
    );
  end if;

  return jsonb_build_object(
    'status', 'checked_in',
    'attendance_id', v_attendance.id,
    'check_in_at', v_attendance.check_in_at,
    'check_in_date', v_attendance.check_in_date,
    'gym_name', coalesce(v_gym_name, 'FitDesk'),
    'message', 'You''re in. Have a strong session.'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 15. Grants
-- ---------------------------------------------------------------------------
grant execute on function public.admin_cancel_membership(uuid, text) to authenticated;
grant execute on function public.admin_pause_membership(uuid, text) to authenticated;
grant execute on function public.admin_resume_membership(uuid) to authenticated;
grant execute on function public.admin_list_notifications(integer) to authenticated;
grant execute on function public.admin_unread_notification_count() to authenticated;
grant execute on function public.admin_mark_notification_read(uuid) to authenticated;
grant execute on function public.admin_mark_all_notifications_read() to authenticated;

revoke all on function public.admin_cancel_membership(uuid, text) from public, anon;
revoke all on function public.admin_pause_membership(uuid, text) from public, anon;
revoke all on function public.admin_resume_membership(uuid) from public, anon;
revoke all on function public.admin_list_notifications(integer) from public, anon;
revoke all on function public.admin_unread_notification_count() from public, anon;
revoke all on function public.admin_mark_notification_read(uuid) from public, anon;
revoke all on function public.admin_mark_all_notifications_read() from public, anon;

-- ---------------------------------------------------------------------------
-- 16. RLS on new tables: no anon access
-- ---------------------------------------------------------------------------
revoke all on public.membership_pauses from anon;
revoke all on public.admin_notifications from anon;
