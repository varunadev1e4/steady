-- 0007_health_goals_photos.sql
-- Health readings, goals, steps, progress photos (private Storage bucket),
-- and a richer period summary for monthly/yearly reviews.

------------------------------------------------------------------------------
-- Settings and steps
------------------------------------------------------------------------------

alter table public.profiles
  add column glucose_unit text not null default 'mg/dL' check (glucose_unit in ('mg/dL', 'mmol/L')),
  add column steps_target integer check (steps_target between 1000 and 50000);

-- Steps are a daily count from the phone, typed in. Like water, one number per
-- day, so they live on the day's check-in row.
alter table public.check_ins
  add column steps integer check (steps between 0 and 200000);

------------------------------------------------------------------------------
-- Health readings
------------------------------------------------------------------------------

create table public.health_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  taken_at timestamptz not null default now(),
  systolic smallint check (systolic between 60 and 260),
  diastolic smallint check (diastolic between 30 and 160),
  resting_hr smallint check (resting_hr between 25 and 220),
  -- Stored in mg/dL; shown in the unit chosen in Settings.
  glucose_mg_dl numeric(5, 1) check (glucose_mg_dl between 20 and 700),
  glucose_context text check (glucose_context in ('fasting', 'after_meal', 'random')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_readings_bp_pair check ((systolic is null) = (diastolic is null)),
  constraint health_readings_bp_order check (systolic is null or systolic > diastolic),
  constraint health_readings_glucose_context check ((glucose_mg_dl is null) = (glucose_context is null)),
  constraint health_readings_something check (systolic is not null or resting_hr is not null or glucose_mg_dl is not null)
);

create index health_readings_user_day_idx on public.health_readings (user_id, day desc);

select public.apply_owner_rls('health_readings');

------------------------------------------------------------------------------
-- Goals (progress is computed from the user's own logs in the app)
------------------------------------------------------------------------------

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  kind text not null check (kind in (
    'weekly_activity_minutes', 'longest_walk', 'weight', 'workouts_per_week', 'steps_daily_avg', 'custom')),
  target numeric(9, 2) not null check (target > 0),
  -- Weight goals remember where you started (kg) to show progress.
  start_value numeric(9, 2),
  -- Custom goals are updated by hand.
  current_value numeric(9, 2),
  unit text check (char_length(unit) <= 20),
  due_date date,
  achieved_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_user_idx on public.goals (user_id);

select public.apply_owner_rls('goals');

------------------------------------------------------------------------------
-- Progress photos: files in a private Storage bucket, one folder per user
-- ("<user id>/<file>"), plus a row per photo for dates and notes.
------------------------------------------------------------------------------

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  path text not null unique,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A row can only point into its owner's own folder.
  constraint progress_photos_own_folder check (split_part(path, '/', 1) = user_id::text)
);

create index progress_photos_user_day_idx on public.progress_photos (user_id, day desc);

select public.apply_owner_rls('progress_photos');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "progress_photos_files_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "progress_photos_files_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "progress_photos_files_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "progress_photos_files_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

------------------------------------------------------------------------------
-- Period summary: week_summary now also reports steps and active minutes,
-- and is used for monthly and yearly reviews too (any date range).
------------------------------------------------------------------------------

create or replace function public.week_summary(p_start date, p_end date, p_tz text, p_today date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'check_in_days', (select count(*) from public.check_ins where day between p_start and p_end and mood is not null),
    'mood_avg', (select round(avg(mood), 2) from public.check_ins where day between p_start and p_end),
    'energy_avg', (select round(avg(energy), 2) from public.check_ins where day between p_start and p_end),
    'stress_avg', (select round(avg(stress), 2) from public.check_ins where day between p_start and p_end),
    'sleep_avg', (select round(avg(sleep_hours), 2) from public.check_ins where day between p_start and p_end),
    'water_avg', (select round(avg(water_glasses), 1) from public.check_ins
                  where day between p_start and p_end and water_glasses > 0),
    'steps_avg', (select round(avg(steps)) from public.check_ins where day between p_start and p_end and steps > 0),
    'steps_days', (select count(*) from public.check_ins where day between p_start and p_end and steps > 0),
    'habit_completions', (select count(*) from public.habit_completions where day between p_start and p_end),
    'workouts', (select count(*) from public.workouts where day between p_start and p_end),
    'workout_minutes', (select coalesce(round(sum(least(180, extract(epoch from (ended_at - started_at)) / 60))), 0)
                        from public.workouts where day between p_start and p_end and ended_at > started_at),
    'cardio_sessions', (select count(*) from public.cardio_entries where day between p_start and p_end),
    'cardio_minutes', (select coalesce(sum(duration_min), 0) from public.cardio_entries where day between p_start and p_end),
    'protein_by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'protein', p) order by day)
      from (select day, sum(protein_g) as p from public.meals
            where day between p_start and p_end group by day) d
    ), '[]'::jsonb),
    'meals', (select count(*) from public.meals where day between p_start and p_end),
    'journal_entries', (select count(*) from public.journal_entries where day between p_start and p_end),
    'journal_days', (select count(distinct day) from public.journal_entries where day between p_start and p_end),
    'journal_words', (select coalesce(sum(word_count), 0) from public.journal_entries where day between p_start and p_end),
    'people_contacted', (select count(distinct person_id) from public.interactions where day between p_start and p_end),
    'in_person', (select count(*) from public.interactions where day between p_start and p_end and kind = 'in_person'),
    'tasks_completed', (select count(*) from public.tasks
                        where status = 'done' and (done_at at time zone p_tz)::date between p_start and p_end),
    'tasks_overdue', (select count(*) from public.tasks
                      where status = 'open' and due_date < least(p_end + 1, p_today))
  );
$$;

-- Import includes the new tables (photo files can't travel in a JSON file).
create or replace function public.import_backup(p_data jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  tables text[] := array[
    'exercises', 'foods', 'habits', 'habit_completions', 'check_ins', 'journal_prompts',
    'journal_entries', 'thought_records', 'workout_templates', 'template_exercises', 'workouts',
    'workout_sets', 'cardio_entries', 'body_measurements', 'meals', 'people', 'interactions',
    'follow_ups', 'tasks', 'notes', 'weekly_reviews', 'plan_enrollments', 'health_readings', 'goals'];
  t text;
  allowed text[];
  cols text;
  rows jsonb;
  r jsonb;
  n bigint;
  k bigint;
  result jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  foreach t in array tables loop
    rows := p_data -> t;
    if rows is null or jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) = 0 then
      continue;
    end if;

    select array_agg(column_name::text order by ordinal_position) into allowed
    from information_schema.columns
    where table_schema = 'public' and table_name = t
      and is_generated = 'NEVER' and column_name <> 'user_id';

    n := 0;
    for r in select value from jsonb_array_elements(rows) loop
      if jsonb_typeof(r) <> 'object' then
        raise exception 'Invalid row in %', t using errcode = '22023';
      end if;
      select string_agg(quote_ident(c), ', ') into cols from unnest(allowed) c where r ? c;
      if cols is null then continue; end if;
      execute format(
        'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) '
        || 'on conflict do nothing', t, cols)
        using r;
      get diagnostics k = row_count;
      n := n + k;
    end loop;

    result := result || jsonb_build_object(t, n);
  end loop;

  return result;
end;
$$;
