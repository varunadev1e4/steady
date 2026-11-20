-- 0006_beginner_plans.sql
-- Guided beginner plans (walking, home strength, gentle yoga). The plan
-- content ships with the app (src/features/plans/content.ts); this table only
-- records which plans the user is following, from when, and on which days.

create table public.plan_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id text not null check (plan_id in ('walk-12', 'home-strength-8', 'gentle-yoga-8')),
  start_date date not null,
  -- Planned days (0 = Sunday).
  weekdays smallint[] not null default '{}' check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  -- The workout template created for strength plans.
  template_id uuid,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_enrollments_template_fk foreign key (template_id, user_id)
    references public.workout_templates (id, user_id) on delete set null (template_id)
);

-- At most one active enrollment per plan.
create unique index plan_enrollments_one_active on public.plan_enrollments (user_id, plan_id) where ended_at is null;

select public.apply_owner_rls('plan_enrollments');

-- Starts (or restarts) a plan in one transaction. For strength plans
-- p_template = {"name", "notes", "library": [{name, muscle_group, equipment}],
-- "exercises": [{name, target_sets, rep_min, rep_max}]}: the exercises are
-- added to the user's library if missing, and the plan's template is created
-- (or reused from an earlier run of the same plan and reset).
create or replace function public.start_plan(p_plan text, p_start date, p_weekdays smallint[], p_template jsonb default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_template uuid;
  v_exercise uuid;
  v_id uuid;
  e jsonb;
  pos int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  update public.plan_enrollments set ended_at = now() where plan_id = p_plan and ended_at is null;

  if p_template is not null then
    for e in select value from jsonb_array_elements(coalesce(p_template -> 'library', '[]'::jsonb)) loop
      insert into public.exercises (name, muscle_group, equipment, is_custom)
      values (e ->> 'name', e ->> 'muscle_group', coalesce(e ->> 'equipment', 'bodyweight'), false)
      on conflict do nothing;
    end loop;

    select pe.template_id into v_template
    from public.plan_enrollments pe
    where pe.plan_id = p_plan and pe.template_id is not null
    order by pe.created_at desc
    limit 1;

    if v_template is null then
      insert into public.workout_templates (name, notes, weekdays)
      values (p_template ->> 'name', nullif(p_template ->> 'notes', ''), p_weekdays)
      returning id into v_template;
    else
      update public.workout_templates
         set name = p_template ->> 'name', notes = nullif(p_template ->> 'notes', ''), weekdays = p_weekdays, archived_at = null
       where id = v_template;
      delete from public.template_exercises where template_id = v_template;
    end if;

    for e in select value from jsonb_array_elements(coalesce(p_template -> 'exercises', '[]'::jsonb)) loop
      select x.id into v_exercise from public.exercises x where lower(x.name) = lower(e ->> 'name') limit 1;
      if v_exercise is null then
        raise exception 'Exercise % is missing from the library', e ->> 'name' using errcode = 'P0002';
      end if;
      update public.exercises set archived_at = null where id = v_exercise and archived_at is not null;
      insert into public.template_exercises (template_id, exercise_id, position, target_sets, rep_min, rep_max)
      values (v_template, v_exercise, pos, (e ->> 'target_sets')::smallint, (e ->> 'rep_min')::smallint, (e ->> 'rep_max')::smallint);
      pos := pos + 1;
    end loop;
  end if;

  insert into public.plan_enrollments (plan_id, start_date, weekdays, template_id)
  values (p_plan, p_start, coalesce(p_weekdays, '{}'), v_template)
  returning id into v_id;

  return v_id;
end;
$$;

-- Import now includes plan enrollments (after templates, which they reference).
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
    'follow_ups', 'tasks', 'notes', 'weekly_reviews', 'plan_enrollments'];
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
