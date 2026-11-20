-- 0003_body.sql
-- Workouts, cardio, body measurements, foods and meals.
-- Weights are always stored in kilograms; the app converts for display when
-- the user prefers pounds.

------------------------------------------------------------------------------
-- Exercise library and templates
------------------------------------------------------------------------------

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  muscle_group text not null check (muscle_group in (
    'chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'glutes', 'core', 'full_body')),
  equipment text not null default 'other' check (equipment in (
    'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'other')),
  is_custom boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercises_id_user unique (id, user_id)
);

create unique index exercises_user_name_idx on public.exercises (user_id, lower(name));

select public.apply_owner_rls('exercises');

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  notes text check (char_length(notes) <= 2000),
  -- Days this template is planned for (0 = Sunday). Drives "Today's workout".
  weekdays smallint[] not null default '{}' check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_templates_id_user unique (id, user_id)
);

create index workout_templates_user_idx on public.workout_templates (user_id);

select public.apply_owner_rls('workout_templates');

create table public.template_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_id uuid not null,
  exercise_id uuid not null,
  position smallint not null default 0,
  target_sets smallint not null default 3 check (target_sets between 1 and 10),
  rep_min smallint not null default 8 check (rep_min between 1 and 100),
  rep_max smallint not null default 12 check (rep_max between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_exercises_rep_range check (rep_min <= rep_max),
  constraint template_exercises_template_fk foreign key (template_id, user_id)
    references public.workout_templates (id, user_id) on delete cascade,
  constraint template_exercises_exercise_fk foreign key (exercise_id, user_id)
    references public.exercises (id, user_id) on delete cascade
);

create index template_exercises_template_idx on public.template_exercises (template_id, position);

select public.apply_owner_rls('template_exercises');

------------------------------------------------------------------------------
-- Workouts and sets
------------------------------------------------------------------------------

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  template_id uuid,
  name text not null default 'Workout' check (char_length(name) between 1 and 80),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workouts_id_user unique (id, user_id),
  -- Deleting a template keeps the workout history (only template_id is cleared).
  constraint workouts_template_fk foreign key (template_id, user_id)
    references public.workout_templates (id, user_id) on delete set null (template_id)
);

create index workouts_user_day_idx on public.workouts (user_id, day desc);

select public.apply_owner_rls('workouts');

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid not null,
  exercise_id uuid not null,
  exercise_position smallint not null default 0,
  set_number smallint not null check (set_number between 1 and 50),
  weight_kg numeric(7, 3) not null default 0 check (weight_kg between 0 and 1000),
  reps smallint not null default 0 check (reps between 0 and 1000),
  is_warmup boolean not null default false,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_sets_workout_fk foreign key (workout_id, user_id)
    references public.workouts (id, user_id) on delete cascade,
  -- Exercises with history are archived, not deleted.
  constraint workout_sets_exercise_fk foreign key (exercise_id, user_id)
    references public.exercises (id, user_id) on delete restrict
);

create index workout_sets_workout_idx on public.workout_sets (workout_id);
create index workout_sets_user_exercise_idx on public.workout_sets (user_id, exercise_id);

select public.apply_owner_rls('workout_sets');

-- Saves a workout and replaces all of its sets in one transaction.
create or replace function public.save_workout(p_workout jsonb, p_sets jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_workout ->> 'id', '')::uuid;
begin
  if v_id is null then
    insert into public.workouts (day, template_id, name, started_at, ended_at, notes)
    values (
      (p_workout ->> 'day')::date,
      nullif(p_workout ->> 'template_id', '')::uuid,
      coalesce(nullif(btrim(p_workout ->> 'name'), ''), 'Workout'),
      coalesce((p_workout ->> 'started_at')::timestamptz, now()),
      (p_workout ->> 'ended_at')::timestamptz,
      nullif(p_workout ->> 'notes', ''))
    returning id into v_id;
  else
    update public.workouts set
      day = coalesce((p_workout ->> 'day')::date, day),
      name = coalesce(nullif(btrim(p_workout ->> 'name'), ''), name),
      ended_at = (p_workout ->> 'ended_at')::timestamptz,
      notes = nullif(p_workout ->> 'notes', '')
    where id = v_id;
    if not found then
      raise exception 'Workout not found' using errcode = 'P0002';
    end if;
  end if;

  delete from public.workout_sets where workout_id = v_id;

  insert into public.workout_sets (
    workout_id, exercise_id, exercise_position, set_number, weight_kg, reps, is_warmup, completed)
  select
    v_id,
    (s ->> 'exercise_id')::uuid,
    coalesce((s ->> 'exercise_position')::smallint, 0),
    (s ->> 'set_number')::smallint,
    coalesce((s ->> 'weight_kg')::numeric, 0),
    coalesce((s ->> 'reps')::smallint, 0),
    coalesce((s ->> 'is_warmup')::boolean, false),
    coalesce((s ->> 'completed')::boolean, false)
  from jsonb_array_elements(coalesce(p_sets, '[]'::jsonb)) s;

  return v_id;
end;
$$;

-- Saves a template and replaces its exercise list in one transaction.
create or replace function public.save_template(p_template jsonb, p_exercises jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_template ->> 'id', '')::uuid;
  v_days smallint[] := coalesce(
    array(select (d)::smallint from jsonb_array_elements_text(coalesce(p_template -> 'weekdays', '[]'::jsonb)) d),
    '{}');
begin
  if v_id is null then
    insert into public.workout_templates (name, notes, weekdays)
    values (btrim(p_template ->> 'name'), nullif(p_template ->> 'notes', ''), v_days)
    returning id into v_id;
  else
    update public.workout_templates
       set name = btrim(p_template ->> 'name'), notes = nullif(p_template ->> 'notes', ''), weekdays = v_days
     where id = v_id;
    if not found then
      raise exception 'Template not found' using errcode = 'P0002';
    end if;
  end if;

  delete from public.template_exercises where template_id = v_id;

  insert into public.template_exercises (template_id, exercise_id, position, target_sets, rep_min, rep_max)
  select v_id, (e ->> 'exercise_id')::uuid, (ord - 1)::smallint,
         coalesce((e ->> 'target_sets')::smallint, 3),
         coalesce((e ->> 'rep_min')::smallint, 8),
         coalesce((e ->> 'rep_max')::smallint, 12)
  from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb)) with ordinality as x(e, ord);

  return v_id;
end;
$$;

-- For each exercise, the completed working sets from its most recent session
-- (excluding p_exclude, the workout being logged). Used to prefill the logger
-- and for progressive overload suggestions.
create or replace function public.last_sets(p_exercise_ids uuid[], p_exclude uuid default null)
returns table (exercise_id uuid, set_number smallint, weight_kg numeric, reps smallint, day date)
language sql
stable
security invoker
set search_path = ''
as $$
  with latest as (
    select distinct on (s.exercise_id) s.exercise_id, s.workout_id, w.day
    from public.workout_sets s
    join public.workouts w on w.id = s.workout_id
    where s.exercise_id = any (p_exercise_ids)
      and s.completed and not s.is_warmup
      and (p_exclude is null or s.workout_id <> p_exclude)
    order by s.exercise_id, w.day desc, w.started_at desc
  )
  select s.exercise_id, s.set_number, s.weight_kg, s.reps, l.day
  from public.workout_sets s
  join latest l on l.workout_id = s.workout_id and l.exercise_id = s.exercise_id
  where s.completed and not s.is_warmup
  order by s.exercise_id, s.set_number;
$$;

------------------------------------------------------------------------------
-- Cardio and body measurements
------------------------------------------------------------------------------

create table public.cardio_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  activity text not null check (char_length(btrim(activity)) between 1 and 40),
  duration_min smallint not null check (duration_min between 1 and 1440),
  distance_km numeric(6, 2) check (distance_km between 0 and 1000),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cardio_entries_user_day_idx on public.cardio_entries (user_id, day desc);

select public.apply_owner_rls('cardio_entries');

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  weight_kg numeric(6, 2) check (weight_kg between 20 and 400),
  waist_cm numeric(5, 1) check (waist_cm between 10 and 300),
  hips_cm numeric(5, 1) check (hips_cm between 10 and 300),
  chest_cm numeric(5, 1) check (chest_cm between 10 and 300),
  arm_cm numeric(5, 1) check (arm_cm between 5 and 150),
  thigh_cm numeric(5, 1) check (thigh_cm between 10 and 200),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 2 and 70),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint body_measurements_one_per_day unique (user_id, day)
);

select public.apply_owner_rls('body_measurements');

------------------------------------------------------------------------------
-- Food
------------------------------------------------------------------------------

alter table public.profiles
  add column meal_tags text[] not null default array['home-cooked', 'whole-food', 'restaurant', 'snack', 'junk']
    check (cardinality(meal_tags) <= 12);

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  serving text not null default '1 serving' check (char_length(serving) <= 60),
  protein_g numeric(5, 1) check (protein_g between 0 and 500),
  calories integer check (calories between 0 and 5000),
  carbs_g numeric(5, 1) check (carbs_g between 0 and 1000),
  is_favourite boolean not null default false,
  -- True for the approximate starter values Steady installs (editable).
  is_starter boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foods_id_user unique (id, user_id)
);

create unique index foods_user_name_idx on public.foods (user_id, lower(name));

select public.apply_owner_rls('foods');

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  eaten_at timestamptz not null default now(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  food_id uuid,
  servings numeric(5, 2) not null default 1 check (servings > 0 and servings <= 20),
  -- Totals for this meal (servings already applied), copied at logging time so
  -- editing a food later doesn't rewrite history.
  protein_g numeric(6, 1) check (protein_g between 0 and 1000),
  calories integer check (calories between 0 and 20000),
  carbs_g numeric(6, 1) check (carbs_g between 0 and 2000),
  tags text[] not null default '{}' check (cardinality(tags) <= 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meals_food_fk foreign key (food_id, user_id)
    references public.foods (id, user_id) on delete set null (food_id)
);

create index meals_user_day_idx on public.meals (user_id, day desc);

select public.apply_owner_rls('meals');

------------------------------------------------------------------------------
-- Starter library: every user gets their own editable copy of common
-- exercises and approximate values for common Indian foods.
------------------------------------------------------------------------------

create or replace function public.install_starter_library(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.exercises (user_id, name, muscle_group, equipment, is_custom)
  select p_user, e.name, e.muscle, e.equipment, false
  from (values
    ('Barbell bench press', 'chest', 'barbell'),
    ('Incline dumbbell press', 'chest', 'dumbbell'),
    ('Dumbbell bench press', 'chest', 'dumbbell'),
    ('Push-up', 'chest', 'bodyweight'),
    ('Cable fly', 'chest', 'cable'),
    ('Chest dip', 'chest', 'bodyweight'),
    ('Overhead press', 'shoulders', 'barbell'),
    ('Seated dumbbell shoulder press', 'shoulders', 'dumbbell'),
    ('Lateral raise', 'shoulders', 'dumbbell'),
    ('Face pull', 'shoulders', 'cable'),
    ('Rear delt fly', 'shoulders', 'dumbbell'),
    ('Deadlift', 'back', 'barbell'),
    ('Barbell row', 'back', 'barbell'),
    ('One-arm dumbbell row', 'back', 'dumbbell'),
    ('Pull-up', 'back', 'bodyweight'),
    ('Chin-up', 'back', 'bodyweight'),
    ('Lat pulldown', 'back', 'cable'),
    ('Seated cable row', 'back', 'cable'),
    ('Barbell curl', 'biceps', 'barbell'),
    ('Dumbbell curl', 'biceps', 'dumbbell'),
    ('Hammer curl', 'biceps', 'dumbbell'),
    ('Triceps pushdown', 'triceps', 'cable'),
    ('Overhead triceps extension', 'triceps', 'dumbbell'),
    ('Skull crusher', 'triceps', 'barbell'),
    ('Close-grip bench press', 'triceps', 'barbell'),
    ('Back squat', 'legs', 'barbell'),
    ('Front squat', 'legs', 'barbell'),
    ('Goblet squat', 'legs', 'dumbbell'),
    ('Leg press', 'legs', 'machine'),
    ('Romanian deadlift', 'legs', 'barbell'),
    ('Walking lunge', 'legs', 'dumbbell'),
    ('Bulgarian split squat', 'legs', 'dumbbell'),
    ('Leg curl', 'legs', 'machine'),
    ('Leg extension', 'legs', 'machine'),
    ('Standing calf raise', 'legs', 'machine'),
    ('Hip thrust', 'glutes', 'barbell'),
    ('Glute bridge', 'glutes', 'bodyweight'),
    ('Plank (reps = seconds)', 'core', 'bodyweight'),
    ('Hanging leg raise', 'core', 'bodyweight'),
    ('Cable crunch', 'core', 'cable'),
    ('Kettlebell swing', 'full_body', 'kettlebell')
  ) as e(name, muscle, equipment)
  on conflict do nothing;

  -- Approximate per-serving values: protein g, kcal, carbs g.
  insert into public.foods (user_id, name, serving, protein_g, calories, carbs_g, is_starter)
  select p_user, f.name, f.serving, f.protein, f.kcal, f.carbs, true
  from (values
    ('Roti / chapati', '1 medium (40 g)', 3.1, 120, 18.0),
    ('Phulka', '1 piece (30 g)', 2.5, 85, 15.0),
    ('Plain paratha', '1 piece', 4.0, 220, 30.0),
    ('Aloo paratha', '1 piece', 5.0, 290, 40.0),
    ('Naan', '1 piece', 9.0, 260, 45.0),
    ('White rice, cooked', '1 cup (160 g)', 4.3, 205, 45.0),
    ('Brown rice, cooked', '1 cup (160 g)', 5.0, 215, 45.0),
    ('Jeera rice', '1 cup', 4.5, 250, 45.0),
    ('Vegetable biryani', '1 plate (250 g)', 8.0, 400, 60.0),
    ('Chicken biryani', '1 plate (300 g)', 25.0, 550, 65.0),
    ('Toor dal', '1 bowl (150 g)', 9.0, 150, 20.0),
    ('Dal makhani', '1 bowl (150 g)', 9.0, 280, 25.0),
    ('Rajma', '1 bowl (150 g)', 10.0, 220, 30.0),
    ('Chole', '1 bowl (150 g)', 10.0, 250, 32.0),
    ('Sambar', '1 bowl (150 g)', 6.0, 130, 18.0),
    ('Rasam', '1 bowl', 2.0, 60, 8.0),
    ('Idli', '1 piece', 2.0, 60, 12.0),
    ('Plain dosa', '1 dosa', 4.0, 170, 28.0),
    ('Masala dosa', '1 dosa', 6.0, 300, 45.0),
    ('Uttapam', '1 piece', 5.0, 200, 32.0),
    ('Medu vada', '1 piece', 3.0, 140, 12.0),
    ('Upma', '1 bowl (200 g)', 5.0, 250, 38.0),
    ('Poha', '1 bowl (200 g)', 5.0, 270, 45.0),
    ('Pongal', '1 bowl (200 g)', 7.0, 300, 40.0),
    ('Paneer', '100 g', 18.0, 265, 3.0),
    ('Palak paneer', '1 bowl (200 g)', 14.0, 280, 10.0),
    ('Paneer bhurji', '1 bowl (150 g)', 20.0, 320, 8.0),
    ('Chicken curry', '1 bowl (200 g)', 25.0, 300, 8.0),
    ('Butter chicken', '1 bowl (200 g)', 24.0, 420, 12.0),
    ('Tandoori chicken', '2 pieces (200 g)', 40.0, 330, 5.0),
    ('Grilled chicken breast', '100 g', 31.0, 165, 0.0),
    ('Fish curry', '1 bowl (200 g)', 22.0, 250, 6.0),
    ('Boiled egg', '1 large', 6.0, 78, 0.6),
    ('Omelette', '2 eggs', 13.0, 190, 2.0),
    ('Egg bhurji', '2 eggs', 13.0, 210, 4.0),
    ('Curd / dahi', '1 bowl (150 g)', 5.0, 90, 7.0),
    ('Greek yogurt', '150 g', 15.0, 140, 6.0),
    ('Buttermilk / chaas', '1 glass', 3.0, 40, 5.0),
    ('Milk, toned', '1 glass (250 ml)', 8.0, 150, 12.0),
    ('Sweet lassi', '1 glass', 7.0, 220, 32.0),
    ('Masala chai with sugar', '1 cup', 3.0, 90, 13.0),
    ('Raita', '1 bowl', 4.0, 80, 7.0),
    ('Mixed vegetable sabzi', '1 bowl', 4.0, 150, 15.0),
    ('Aloo sabzi', '1 bowl', 3.0, 180, 25.0),
    ('Bhindi fry', '1 bowl', 3.0, 150, 12.0),
    ('Sprouts salad', '1 bowl (100 g)', 8.0, 120, 18.0),
    ('Moong dal chilla', '1 piece', 7.0, 120, 15.0),
    ('Besan chilla', '1 piece', 6.0, 150, 16.0),
    ('Khichdi', '1 bowl (250 g)', 9.0, 280, 45.0),
    ('Curd rice', '1 bowl', 6.0, 250, 40.0),
    ('Lemon rice', '1 bowl', 4.0, 280, 45.0),
    ('Pav bhaji', '2 pav with bhaji', 10.0, 450, 60.0),
    ('Samosa', '1 piece', 4.0, 260, 30.0),
    ('Pakora', '5 pieces', 4.0, 220, 20.0),
    ('Dhokla', '2 pieces', 4.0, 150, 20.0),
    ('Roasted chana', '30 g', 6.0, 110, 18.0),
    ('Peanuts', '30 g', 7.0, 170, 5.0),
    ('Almonds', '10 pieces', 3.0, 70, 2.5),
    ('Banana', '1 medium', 1.3, 105, 27.0),
    ('Apple', '1 medium', 0.5, 95, 25.0),
    ('Soya chunks, cooked', '50 g dry', 26.0, 175, 17.0),
    ('Whey protein', '1 scoop (30 g)', 24.0, 120, 3.0),
    ('Oats with milk', '1 bowl', 10.0, 250, 38.0),
    ('Whole wheat bread', '1 slice', 3.5, 80, 14.0),
    ('Peanut butter', '1 tbsp', 4.0, 95, 3.0),
    ('Gulab jamun', '1 piece', 2.0, 150, 22.0)
  ) as f(name, serving, protein, kcal, carbs)
  on conflict do nothing;
end;
$$;

revoke execute on function public.install_starter_library(uuid) from public, anon, authenticated;

-- New sign-ups get a profile and the starter library.
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

  perform public.install_starter_library(new.id);
  return new;
end;
$$;

-- Users who signed up before this migration get the library now.
select public.install_starter_library(id) from auth.users;
