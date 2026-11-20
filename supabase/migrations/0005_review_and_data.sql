-- 0005_review_and_data.sql
-- Weekly reviews, the weekly summary, import and account deletion.

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  went_well text not null default '' check (char_length(went_well) <= 5000),
  didnt_go_well text not null default '' check (char_length(didnt_go_well) <= 5000),
  learned text not null default '' check (char_length(learned) <= 5000),
  next_focus text not null default '' check (char_length(next_focus) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_reviews_one_per_week unique (user_id, week_start)
);

select public.apply_owner_rls('weekly_reviews');

-- Totals for one week (p_start..p_end inclusive), computed from real records.
-- p_tz converts task completion instants to local days; p_today decides what
-- counts as overdue. Runs with the caller's rights (RLS applies).
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
    'habit_completions', (select count(*) from public.habit_completions where day between p_start and p_end),
    'workouts', (select count(*) from public.workouts where day between p_start and p_end),
    'cardio_sessions', (select count(*) from public.cardio_entries where day between p_start and p_end),
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

-- Imports a Steady JSON export in one transaction: either everything is
-- written or nothing is. Rows keep their ids (so re-importing the same file
-- skips what is already there) but always belong to the caller.
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
    'follow_ups', 'tasks', 'notes', 'weekly_reviews'];
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

    -- Writable columns: everything except user_id (which defaults to the
    -- caller) and generated search columns.
    select array_agg(column_name::text order by ordinal_position) into allowed
    from information_schema.columns
    where table_schema = 'public' and table_name = t
      and is_generated = 'NEVER' and column_name <> 'user_id';

    n := 0;
    for r in select value from jsonb_array_elements(rows) loop
      if jsonb_typeof(r) <> 'object' then
        raise exception 'Invalid row in %', t using errcode = '22023';
      end if;
      -- Only the keys present in this row, so missing ones get column defaults.
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

-- Permanently deletes the caller's account. Every table cascades from
-- auth.users, so all of their data goes with it.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
