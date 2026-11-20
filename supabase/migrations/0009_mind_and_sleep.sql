-- 0009_mind_and_sleep.sql
-- Mood-lifting activities (behavioural activation), PHQ-9 / GAD-7 self-checks,
-- a cravings log, and bedtime / wake time on check-ins.

------------------------------------------------------------------------------
-- Sleep timing on the daily check-in (the day you woke up).
------------------------------------------------------------------------------

alter table public.check_ins
  add column bedtime time,
  add column wake_time time;

------------------------------------------------------------------------------
-- Activities: small planned things, with mood rated before and after (1–10).
------------------------------------------------------------------------------

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  category text not null default 'other'
    check (category in ('pleasure', 'achievement', 'connection', 'movement', 'self_care', 'other')),
  planned_time time,
  status text not null default 'planned' check (status in ('planned', 'done', 'skipped')),
  mood_before smallint check (mood_before between 1 and 10),
  mood_after smallint check (mood_after between 1 and 10),
  note text check (char_length(note) <= 500),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index activities_user_day_idx on public.activities (user_id, day desc);

select public.apply_owner_rls('activities');

------------------------------------------------------------------------------
-- Self-check questionnaires (PHQ-9, GAD-7). Each answer is 0–3; the total is
-- computed by the database so it can never disagree with the answers.
------------------------------------------------------------------------------

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('phq9', 'gad7')),
  day date not null,
  answers smallint[] not null check (answers <@ array[0, 1, 2, 3]::smallint[]),
  -- "How difficult have these problems made it…" (0–3), optional.
  difficulty smallint check (difficulty between 0 and 3),
  score smallint generated always as (
    coalesce(answers[1], 0) + coalesce(answers[2], 0) + coalesce(answers[3], 0) + coalesce(answers[4], 0)
    + coalesce(answers[5], 0) + coalesce(answers[6], 0) + coalesce(answers[7], 0) + coalesce(answers[8], 0)
    + coalesce(answers[9], 0)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessments_answer_count check (
    (kind = 'phq9' and cardinality(answers) = 9) or (kind = 'gad7' and cardinality(answers) = 7))
);

create index assessments_user_day_idx on public.assessments (user_id, kind, day desc);

select public.apply_owner_rls('assessments');

------------------------------------------------------------------------------
-- Cravings and emotional eating
------------------------------------------------------------------------------

create table public.cravings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  logged_at timestamptz not null default now(),
  trigger text not null check (trigger in ('hungry', 'stressed', 'sad', 'bored', 'tired', 'habit', 'social', 'other')),
  intensity smallint not null check (intensity between 1 and 5),
  food text check (char_length(food) <= 120),
  waited_minutes smallint check (waited_minutes between 0 and 240),
  intensity_after smallint check (intensity_after between 1 and 5),
  outcome text check (outcome in ('passed', 'alternative', 'ate_some', 'ate_planned', 'ate_more')),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cravings_user_day_idx on public.cravings (user_id, day desc);

select public.apply_owner_rls('cravings');

------------------------------------------------------------------------------
-- Import includes the new tables.
------------------------------------------------------------------------------

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
    'follow_ups', 'tasks', 'notes', 'weekly_reviews', 'plan_enrollments', 'health_readings', 'goals',
    'medications', 'medication_doses', 'medication_notes', 'activities', 'assessments', 'cravings'];
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
