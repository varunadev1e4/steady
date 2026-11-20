-- 0001_foundation.sql
-- Shared helpers, the profiles table, and automatic profile creation on sign-up.

------------------------------------------------------------------------------
-- Helpers
------------------------------------------------------------------------------

-- Keeps updated_at current on every row update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- True when tz is an IANA time zone name Postgres understands (e.g. 'Asia/Kolkata').
create or replace function public.is_valid_time_zone(tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

-- Applies the standard owner-only security to a user-owned table:
--   * Row Level Security on
--   * select / insert / update / delete allowed only where auth.uid() = user_id
--   * updated_at maintained by trigger
-- Every user-owned table calls this, so the policies are identical everywhere.
create or replace function public.apply_owner_rls(tbl text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('alter table public.%I enable row level security', tbl);

  execute format(
    'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
    tbl || '_select_own', tbl);
  execute format(
    'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
    tbl || '_insert_own', tbl);
  execute format(
    'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
    tbl || '_update_own', tbl);
  execute format(
    'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
    tbl || '_delete_own', tbl);

  execute format(
    'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
    tbl || '_set_updated_at', tbl);
end;
$$;

-- Only migrations (run as the database owner) may call this.
revoke execute on function public.apply_owner_rls(text) from public, anon, authenticated;

------------------------------------------------------------------------------
-- Profiles: one row per user, holding settings and optional targets.
------------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  time_zone text not null default 'UTC',
  -- 0 = Sunday, 1 = Monday
  week_start smallint not null default 1 check (week_start in (0, 1)),
  units text not null default 'kg' check (units in ('kg', 'lb')),
  date_format text not null default 'd MMM yyyy'
    check (date_format in ('d MMM yyyy', 'MMM d, yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy')),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  -- Modules the user has switched off. Empty means everything is on.
  disabled_modules text[] not null default '{}'
    check (disabled_modules <@ array[
      'checkin', 'habits', 'journal', 'workouts', 'food', 'people', 'tasks', 'notes', 'review', 'insights'
    ]::text[]),
  -- Optional targets. Null means "no target".
  protein_target_g integer check (protein_target_g between 1 and 500),
  water_target_glasses integer check (water_target_glasses between 1 and 40),
  weekly_workout_target integer check (weekly_workout_target between 1 and 14),
  calories_enabled boolean not null default false,
  calorie_target integer check (calorie_target between 500 and 10000),
  -- Progressive overload step in the user's chosen unit.
  overload_increment numeric(5, 2) not null default 2.5 check (overload_increment > 0 and overload_increment <= 50),
  journal_lock_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per user: preferences, optional targets and module switches.';

-- Reject unknown time zones so date maths never silently falls back to UTC.
create or replace function public.profiles_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_valid_time_zone(new.time_zone) then
    raise exception 'Unknown time zone: %', new.time_zone using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger profiles_validate
  before insert or update of time_zone on public.profiles
  for each row execute function public.profiles_validate();

select public.apply_owner_rls('profiles');

------------------------------------------------------------------------------
-- Create a profile automatically when someone signs up.
-- The browser passes its time zone and name as sign-up metadata.
------------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text := coalesce(new.raw_user_meta_data ->> 'time_zone', 'UTC');
  name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
begin
  if not public.is_valid_time_zone(tz) then
    tz := 'UTC';
  end if;

  insert into public.profiles (user_id, display_name, time_zone)
  values (new.id, left(name, 80), tz);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
