-- Child Rewarding App: schema for the shared Supabase project (Cashbook project)
-- Run ONCE in the Supabase SQL Editor. Only creates NEW objects prefixed rw_.
-- Does not touch any Cashbook table (books, transactions, profiles, ...).

begin;

-- ---------------------------------------------------------------
-- 0. Today's date in India time (used for defaults and validation)
-- ---------------------------------------------------------------
create or replace function public.rw_today()
returns date
language sql stable
as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

-- ---------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------
create table public.rw_families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

create table public.rw_family_members (
  family_id   uuid not null references public.rw_families(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('parent', 'kid')),
  created_at  timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table public.rw_family_invites (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.rw_families(id) on delete cascade,
  email       text not null,
  role        text not null check (role in ('parent', 'kid')),
  invited_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);
create unique index rw_family_invites_family_email_uq
  on public.rw_family_invites (family_id, lower(email));

create table public.rw_kids (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.rw_families(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  created_at  timestamptz not null default now()
);
create index rw_kids_family_idx on public.rw_kids (family_id);

create table public.rw_habits (
  id          uuid primary key default gen_random_uuid(),
  kid_id      uuid not null references public.rw_kids(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  points      integer not null check (points > 0),
  frequency   text not null check (frequency in ('daily', 'weekly', 'monthly')),
  start_date  date not null default public.rw_today(),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index rw_habits_kid_idx on public.rw_habits (kid_id);

-- One row per habit per period. Row exists = reviewed (done or not_done).
create table public.rw_habit_logs (
  id            uuid primary key default gen_random_uuid(),
  habit_id      uuid not null references public.rw_habits(id) on delete cascade,
  period_start  date not null,
  status        text not null check (status in ('done', 'not_done')),
  points        integer not null default 0,   -- frozen at the time of review
  reviewed_by   uuid references auth.users(id),
  reviewed_at   timestamptz not null default now(),
  unique (habit_id, period_start)
);

create table public.rw_transactions (
  id            uuid primary key default gen_random_uuid(),
  kid_id        uuid not null references public.rw_kids(id) on delete cascade,
  points        integer not null check (points <> 0),   -- + add, - deduct
  reason        text not null check (length(trim(reason)) > 0),
  occurred_on   date not null default public.rw_today(),
  source        text not null default 'manual' check (source in ('manual', 'habit')),
  -- deleting the habit log (undo) deletes its transaction
  habit_log_id  uuid unique references public.rw_habit_logs(id) on delete cascade,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check ((source = 'habit') = (habit_log_id is not null))
);
create index rw_transactions_kid_date_idx on public.rw_transactions (kid_id, occurred_on desc);

create or replace function public.rw_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger rw_transactions_touch
  before update on public.rw_transactions
  for each row execute function public.rw_touch_updated_at();

-- ---------------------------------------------------------------
-- 2. Helper functions (security definer so RLS policies don't recurse)
-- ---------------------------------------------------------------
create or replace function public.rw_is_member(p_family uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from rw_family_members
    where family_id = p_family and user_id = auth.uid()
  )
$$;

create or replace function public.rw_is_parent(p_family uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from rw_family_members
    where family_id = p_family and user_id = auth.uid() and role = 'parent'
  )
$$;

create or replace function public.rw_family_of_kid(p_kid uuid)
returns uuid
language sql stable security definer set search_path = public
as $$ select family_id from rw_kids where id = p_kid $$;

create or replace function public.rw_family_of_habit(p_habit uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select k.family_id from rw_habits h join rw_kids k on k.id = h.kid_id
  where h.id = p_habit
$$;

-- ---------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------
alter table public.rw_families        enable row level security;
alter table public.rw_family_members  enable row level security;
alter table public.rw_family_invites  enable row level security;
alter table public.rw_kids            enable row level security;
alter table public.rw_habits          enable row level security;
alter table public.rw_habit_logs      enable row level security;
alter table public.rw_transactions    enable row level security;

-- Families: members read; parents edit/delete. Creating goes through rw_create_family().
create policy rw_families_select on public.rw_families
  for select to authenticated using (public.rw_is_member(id));
create policy rw_families_update on public.rw_families
  for update to authenticated using (public.rw_is_parent(id)) with check (public.rw_is_parent(id));
create policy rw_families_delete on public.rw_families
  for delete to authenticated using (public.rw_is_parent(id));

-- Members: members read; parents can remove. Adding goes through rw_create_family / rw_accept_invites.
create policy rw_members_select on public.rw_family_members
  for select to authenticated using (public.rw_is_member(family_id));
create policy rw_members_delete on public.rw_family_members
  for delete to authenticated using (public.rw_is_parent(family_id));

-- Invites: parents manage; the invited person can see their own invite.
create policy rw_invites_select on public.rw_family_invites
  for select to authenticated
  using (public.rw_is_parent(family_id) or lower(email) = lower(auth.jwt() ->> 'email'));
create policy rw_invites_insert on public.rw_family_invites
  for insert to authenticated
  with check (public.rw_is_parent(family_id) and invited_by = auth.uid());
create policy rw_invites_delete on public.rw_family_invites
  for delete to authenticated using (public.rw_is_parent(family_id));

-- Kids
create policy rw_kids_select on public.rw_kids
  for select to authenticated using (public.rw_is_member(family_id));
create policy rw_kids_insert on public.rw_kids
  for insert to authenticated with check (public.rw_is_parent(family_id));
create policy rw_kids_update on public.rw_kids
  for update to authenticated using (public.rw_is_parent(family_id)) with check (public.rw_is_parent(family_id));
create policy rw_kids_delete on public.rw_kids
  for delete to authenticated using (public.rw_is_parent(family_id));

-- Habits
create policy rw_habits_select on public.rw_habits
  for select to authenticated using (public.rw_is_member(public.rw_family_of_kid(kid_id)));
create policy rw_habits_insert on public.rw_habits
  for insert to authenticated with check (public.rw_is_parent(public.rw_family_of_kid(kid_id)));
create policy rw_habits_update on public.rw_habits
  for update to authenticated
  using (public.rw_is_parent(public.rw_family_of_kid(kid_id)))
  with check (public.rw_is_parent(public.rw_family_of_kid(kid_id)));
create policy rw_habits_delete on public.rw_habits
  for delete to authenticated using (public.rw_is_parent(public.rw_family_of_kid(kid_id)));

-- Habit logs: members read; parents can delete (= undo). Creating goes through rw_review_habit().
create policy rw_logs_select on public.rw_habit_logs
  for select to authenticated using (public.rw_is_member(public.rw_family_of_habit(habit_id)));
create policy rw_logs_delete on public.rw_habit_logs
  for delete to authenticated using (public.rw_is_parent(public.rw_family_of_habit(habit_id)));

-- Transactions: members read; parents add/edit/delete MANUAL entries only.
-- Habit entries are created and removed through rw_review_habit() / undo.
create policy rw_tx_select on public.rw_transactions
  for select to authenticated using (public.rw_is_member(public.rw_family_of_kid(kid_id)));
create policy rw_tx_insert on public.rw_transactions
  for insert to authenticated
  with check (
    public.rw_is_parent(public.rw_family_of_kid(kid_id))
    and source = 'manual' and habit_log_id is null and created_by = auth.uid()
  );
create policy rw_tx_update on public.rw_transactions
  for update to authenticated
  using (public.rw_is_parent(public.rw_family_of_kid(kid_id)) and source = 'manual')
  with check (public.rw_is_parent(public.rw_family_of_kid(kid_id)) and source = 'manual' and habit_log_id is null);
create policy rw_tx_delete on public.rw_transactions
  for delete to authenticated
  using (public.rw_is_parent(public.rw_family_of_kid(kid_id)) and source = 'manual');

-- ---------------------------------------------------------------
-- 4. Actions
-- ---------------------------------------------------------------

-- Create a family and make the caller its first parent.
create or replace function public.rw_create_family(p_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into rw_families (name, created_by) values (p_name, auth.uid()) returning id into v_id;
  insert into rw_family_members (family_id, user_id, role) values (v_id, auth.uid(), 'parent');
  return v_id;
end $$;

-- Call after login: turns pending invites for the caller's email into memberships.
create or replace function public.rw_accept_invites()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_count integer;
begin
  if auth.uid() is null or v_email is null then return 0; end if;
  with moved as (
    delete from rw_family_invites where lower(email) = v_email returning family_id, role
  ), ins as (
    insert into rw_family_members (family_id, user_id, role)
    select family_id, auth.uid(), role from moved
    on conflict (family_id, user_id) do nothing
    returning 1
  )
  select count(*) into v_count from ins;
  return coalesce(v_count, 0);
end $$;

-- Mark a habit period as done or not_done. Done adds the points. Already-reviewed periods are frozen:
-- to change one, delete its habit log first (undo), then review again.
create or replace function public.rw_review_habit(p_habit_id uuid, p_period_start date, p_status text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  c_window_days constant integer := 30;
  v_today  date := public.rw_today();
  v_habit  rw_habits%rowtype;
  v_family uuid;
  v_end    date;
  v_log    uuid;
begin
  if p_status not in ('done', 'not_done') then raise exception 'Invalid status'; end if;

  select * into v_habit from rw_habits where id = p_habit_id;
  if not found then raise exception 'Habit not found'; end if;

  select family_id into v_family from rw_kids where id = v_habit.kid_id;
  if not rw_is_parent(v_family) then raise exception 'Not allowed'; end if;

  if v_habit.frequency = 'weekly'  and p_period_start <> date_trunc('week',  p_period_start::timestamp)::date
    then raise exception 'Weekly period must start on a Monday'; end if;
  if v_habit.frequency = 'monthly' and p_period_start <> date_trunc('month', p_period_start::timestamp)::date
    then raise exception 'Monthly period must start on the 1st'; end if;

  v_end := case v_habit.frequency
             when 'daily'  then p_period_start
             when 'weekly' then p_period_start + 6
             else (p_period_start + interval '1 month' - interval '1 day')::date
           end;

  if p_period_start > v_today then raise exception 'Period is in the future'; end if;
  if v_end < v_habit.start_date then raise exception 'Period is before the habit started'; end if;
  if v_end < v_today - c_window_days then raise exception 'Period is older than % days', c_window_days; end if;

  if exists (select 1 from rw_habit_logs where habit_id = p_habit_id and period_start = p_period_start) then
    raise exception 'Already reviewed. Undo it first to change it.';
  end if;

  insert into rw_habit_logs (habit_id, period_start, status, points, reviewed_by)
  values (p_habit_id, p_period_start, p_status,
          case when p_status = 'done' then v_habit.points else 0 end, auth.uid())
  returning id into v_log;

  if p_status = 'done' then
    insert into rw_transactions (kid_id, points, reason, occurred_on, source, habit_log_id, created_by)
    values (v_habit.kid_id, v_habit.points, v_habit.name, least(v_end, v_today), 'habit', v_log, auth.uid());
  end if;

  return v_log;
end $$;

-- Pending (unreviewed) habit items for the last p_days days. Parents only.
create or replace function public.rw_pending_habits(p_days integer default 30)
returns table (
  habit_id uuid, kid_id uuid, kid_name text, habit_name text,
  points integer, frequency text, period_start date, period_end date
)
language sql stable security definer set search_path = public
as $$
  select x.habit_id, x.kid_id, x.kid_name, x.habit_name, x.points, x.frequency, x.period_start, x.period_end
  from (
    select distinct
      h.id as habit_id, h.kid_id, k.name as kid_name, h.name as habit_name,
      h.points, h.frequency, h.start_date,
      case h.frequency
        when 'daily'  then g::date
        when 'weekly' then date_trunc('week',  g)::date
        else               date_trunc('month', g)::date
      end as period_start,
      case h.frequency
        when 'daily'  then g::date
        when 'weekly' then date_trunc('week',  g)::date + 6
        else               (date_trunc('month', g) + interval '1 month' - interval '1 day')::date
      end as period_end
    from rw_habits h
    join rw_kids k on k.id = h.kid_id
    cross join lateral generate_series(
      (public.rw_today() - p_days)::timestamp, public.rw_today()::timestamp, interval '1 day'
    ) as g
    where h.active and rw_is_parent(k.family_id)
  ) x
  where x.period_end >= x.start_date
    and not exists (
      select 1 from rw_habit_logs l
      where l.habit_id = x.habit_id and l.period_start = x.period_start
    )
  order by x.period_start desc, x.kid_name, x.habit_name
$$;

-- ---------------------------------------------------------------
-- 5. Totals per kid (respects RLS of the caller)
-- ---------------------------------------------------------------
create or replace view public.rw_kid_totals with (security_invoker = true) as
select
  k.id as kid_id,
  k.family_id,
  k.name,
  coalesce(sum(t.points), 0)                                   as balance,
  coalesce(sum(t.points) filter (where t.points > 0), 0)       as total_earned,
  coalesce(-sum(t.points) filter (where t.points < 0), 0)      as total_deducted
from public.rw_kids k
left join public.rw_transactions t on t.kid_id = k.id
group by k.id;

-- ---------------------------------------------------------------
-- 6. Function permissions: signed-in users only
-- ---------------------------------------------------------------
revoke all on function public.rw_create_family(text)                  from public, anon;
revoke all on function public.rw_accept_invites()                     from public, anon;
revoke all on function public.rw_review_habit(uuid, date, text)       from public, anon;
revoke all on function public.rw_pending_habits(integer)              from public, anon;
grant execute on function public.rw_create_family(text)               to authenticated;
grant execute on function public.rw_accept_invites()                  to authenticated;
grant execute on function public.rw_review_habit(uuid, date, text)    to authenticated;
grant execute on function public.rw_pending_habits(integer)           to authenticated;

commit;
