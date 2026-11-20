-- 0008_weight_goal_and_medications.sql
-- Profile details for goal planning (all optional) and a medication tracker.

------------------------------------------------------------------------------
-- About you (optional): used for the birthday countdown and a calorie estimate.
------------------------------------------------------------------------------

alter table public.profiles
  add column birthday date check (birthday between '1900-01-01' and '2100-01-01'),
  add column height_cm numeric(5, 1) check (height_cm between 100 and 250),
  add column sex text check (sex in ('male', 'female')),
  add column activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active'));

-- Medications can be switched off like any other module.
alter table public.profiles drop constraint profiles_disabled_modules_check;
alter table public.profiles add constraint profiles_disabled_modules_check
  check (disabled_modules <@ array[
    'checkin', 'habits', 'journal', 'workouts', 'food', 'people', 'tasks', 'notes', 'review', 'insights', 'medications'
  ]::text[]);

------------------------------------------------------------------------------
-- Medications
------------------------------------------------------------------------------

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  dose text check (char_length(dose) <= 50),
  form text not null default 'tablet' check (form in ('tablet', 'capsule', 'liquid', 'injection', 'other')),
  purpose text check (char_length(purpose) <= 100),
  instructions text check (char_length(instructions) <= 300),
  -- Daily times for scheduled medicines; empty for "as needed".
  schedule_times time[] not null default '{}',
  -- Days to take it (0 = Sunday); empty means every day.
  weekdays smallint[] not null default '{}' check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  as_needed boolean not null default false,
  start_date date not null default current_date,
  end_date date,
  -- Optional pill count; goes down as doses are marked taken.
  pills_left numeric(7, 2) check (pills_left >= 0),
  pills_per_dose numeric(4, 2) not null default 1 check (pills_per_dose > 0 and pills_per_dose <= 20),
  refill_at integer check (refill_at between 0 and 1000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medications_id_user unique (id, user_id),
  constraint medications_has_schedule check (as_needed or cardinality(schedule_times) between 1 and 8),
  constraint medications_dates check (end_date is null or end_date >= start_date)
);

create index medications_user_idx on public.medications (user_id);

select public.apply_owner_rls('medications');

create table public.medication_doses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  medication_id uuid not null,
  day date not null,
  -- The scheduled time this dose belongs to; null for as-needed doses.
  scheduled_time time,
  status text not null check (status in ('taken', 'skipped')),
  taken_at timestamptz not null default now(),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medication_doses_once unique (medication_id, day, scheduled_time),
  constraint medication_doses_med_fk foreign key (medication_id, user_id)
    references public.medications (id, user_id) on delete cascade
);

create index medication_doses_user_day_idx on public.medication_doses (user_id, day desc);

select public.apply_owner_rls('medication_doses');

-- "How I'm feeling on it": side effects and observations, for appointments.
create table public.medication_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  medication_id uuid,
  day date not null,
  text text not null check (char_length(btrim(text)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medication_notes_med_fk foreign key (medication_id, user_id)
    references public.medications (id, user_id) on delete set null (medication_id)
);

create index medication_notes_user_day_idx on public.medication_notes (user_id, day desc);

select public.apply_owner_rls('medication_notes');

-- Marks a dose taken or skipped and keeps the pill count right, in one
-- transaction. Changing a dose from taken to skipped gives the pill back.
create or replace function public.log_dose(
  p_medication uuid, p_day date, p_time time, p_status text, p_note text default null)
returns public.medication_doses
language plpgsql
security invoker
set search_path = ''
as $$
declare
  m public.medications;
  d public.medication_doses;
  was_taken boolean := false;
begin
  if p_status not in ('taken', 'skipped') then
    raise exception 'Unknown dose status %', p_status using errcode = '22023';
  end if;

  select * into m from public.medications where id = p_medication for update;
  if not found then
    raise exception 'Medication not found' using errcode = 'P0002';
  end if;

  if p_time is not null then
    select * into d from public.medication_doses
     where medication_id = p_medication and day = p_day and scheduled_time = p_time
     for update;
  end if;

  if d.id is not null then
    was_taken := d.status = 'taken';
    update public.medication_doses set status = p_status, note = p_note, taken_at = now()
     where id = d.id returning * into d;
  else
    insert into public.medication_doses (medication_id, day, scheduled_time, status, note)
    values (p_medication, p_day, p_time, p_status, p_note)
    returning * into d;
  end if;

  if m.pills_left is not null then
    if p_status = 'taken' and not was_taken then
      update public.medications set pills_left = greatest(0, pills_left - pills_per_dose) where id = m.id;
    elsif p_status <> 'taken' and was_taken then
      update public.medications set pills_left = pills_left + pills_per_dose where id = m.id;
    end if;
  end if;

  return d;
end;
$$;

-- Removes a logged dose (undo), returning the pill if it had been taken.
create or replace function public.undo_dose(p_dose uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  d public.medication_doses;
begin
  select * into d from public.medication_doses where id = p_dose for update;
  if not found then
    raise exception 'Dose not found' using errcode = 'P0002';
  end if;
  if d.status = 'taken' then
    update public.medications set pills_left = pills_left + pills_per_dose
     where id = d.medication_id and pills_left is not null;
  end if;
  delete from public.medication_doses where id = p_dose;
end;
$$;

-- Import includes medications.
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
    'medications', 'medication_doses', 'medication_notes'];
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
