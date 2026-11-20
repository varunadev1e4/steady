-- seed.sql — DEVELOPMENT DATA ONLY.
--
-- Never run this against your real (production) project. It is not run
-- automatically: you run it by hand in the SQL editor of a development project.
--
-- How to use:
--   1. Set up an account in the app as dev@steady.local (any PIN).
--   2. Paste this file into the Supabase SQL editor and run it.
--
-- Every seeded row belongs to dev@steady.local only, so removing the seed data
-- is just deleting that user (Authentication > Users > delete). All of their
-- rows are removed by "on delete cascade". See README "Seed data".
--
-- Running it twice adds a second copy of some rows; delete and recreate the
-- dev user to start fresh.

do $$
declare
  uid uuid := (select id from auth.users where email = 'dev@steady.local');
  today date := (now() at time zone 'Asia/Kolkata')::date;
  d date;
  i int;
  h_walk uuid;
  h_read uuid;
  h_gym uuid;
  tpl uuid;
  w uuid;
  ex_bench uuid;
  ex_row uuid;
  ex_squat uuid;
  p_asha uuid;
  p_ravi uuid;
  p_mum uuid;
begin
  if uid is null then
    raise notice 'Seed skipped: sign up as dev@steady.local first.';
    return;
  end if;

  perform setseed(0.42);

  update public.profiles
     set display_name = coalesce(display_name, 'Dev'),
         time_zone = 'Asia/Kolkata',
         protein_target_g = 90,
         water_target_glasses = 8,
         weekly_workout_target = 3
   where user_id = uid;

  -- Check-ins for the last 45 days (a few days skipped).
  for i in 1..45 loop
    d := today - i;
    continue when i % 9 = 0;
    insert into public.check_ins (user_id, day, mood, energy, stress, sleep_hours, sleep_quality, water_glasses, note)
    values (uid, d,
      least(5, greatest(1, 3 + round(random() * 2 - 0.8)::int)),
      least(5, greatest(1, 3 + round(random() * 2 - 1)::int)),
      least(5, greatest(1, 2 + round(random() * 2)::int)),
      round((5.5 + random() * 3.5)::numeric * 2) / 2,
      least(5, greatest(1, 3 + round(random() * 2 - 1)::int)),
      4 + floor(random() * 6)::int,
      case when i % 7 = 0 then 'Long day, but a good walk in the evening.' end)
    on conflict (user_id, day) do nothing;
  end loop;

  -- Habits with completions.
  insert into public.habits (user_id, name, icon, color, frequency, target_time, grace_enabled, start_date)
  values (uid, 'Walk 20 minutes', 'footprints', 'sage', 'daily', 'evening', true, today - 40)
  returning id into h_walk;
  insert into public.habits (user_id, name, icon, color, frequency, weekdays, target_time, start_date)
  values (uid, 'Read 10 pages', 'book', 'sky', 'weekdays', '{1,2,3,4,5}', 'evening', today - 40)
  returning id into h_read;
  insert into public.habits (user_id, name, icon, color, frequency, times_per_week, start_date)
  values (uid, 'Strength training', 'dumbbell', 'clay', 'weekly', 3, today - 40)
  returning id into h_gym;

  for i in 1..40 loop
    d := today - i;
    if random() < 0.8 then insert into public.habit_completions (user_id, habit_id, day) values (uid, h_walk, d); end if;
    if extract(isodow from d) < 6 and random() < 0.7 then
      insert into public.habit_completions (user_id, habit_id, day) values (uid, h_read, d);
    end if;
  end loop;

  -- A workout template and some logged workouts.
  select id into ex_bench from public.exercises where user_id = uid and name = 'Barbell bench press';
  select id into ex_row from public.exercises where user_id = uid and name = 'Barbell row';
  select id into ex_squat from public.exercises where user_id = uid and name = 'Back squat';

  insert into public.workout_templates (user_id, name, weekdays) values (uid, 'Full body', '{1,3,5}') returning id into tpl;
  insert into public.template_exercises (user_id, template_id, exercise_id, position, target_sets, rep_min, rep_max) values
    (uid, tpl, ex_squat, 0, 3, 6, 8),
    (uid, tpl, ex_bench, 1, 3, 8, 10),
    (uid, tpl, ex_row, 2, 3, 8, 10);

  for i in 0..8 loop
    d := today - 2 - i * 3;
    insert into public.workouts (user_id, day, template_id, name, started_at, ended_at)
    values (uid, d, tpl, 'Full body', d + time '07:00', d + time '07:55')
    returning id into w;
    insert into public.habit_completions (user_id, habit_id, day) values (uid, h_gym, d) on conflict do nothing;
    insert into public.workout_sets (user_id, workout_id, exercise_id, exercise_position, set_number, weight_kg, reps, completed)
    select uid, w, e.ex, e.pos, s, e.base + (8 - i) * 2.5, case when s = 3 then e.top - 1 else e.top end, true
    from (values (ex_squat, 0, 60.0, 8), (ex_bench, 1, 40.0, 10), (ex_row, 2, 40.0, 10)) as e(ex, pos, base, top),
         generate_series(1, 3) s;
  end loop;

  insert into public.cardio_entries (user_id, day, activity, duration_min, distance_km) values
    (uid, today - 1, 'Walk', 35, 3.2), (uid, today - 6, 'Cycle', 45, 14);

  insert into public.body_measurements (user_id, day, weight_kg, waist_cm)
  select uid, today - g * 7, 74 - g * 0.2 + random() * 0.4, case when g % 2 = 0 then 84 - g * 0.1 end
  from generate_series(0, 8) g;

  -- Meals for the last week.
  for i in 0..6 loop
    d := today - i;
    insert into public.meals (user_id, day, name, food_id, servings, protein_g, calories, carbs_g, tags)
    select uid, d, f.name, f.id, 1, f.protein_g, f.calories, f.carbs_g, x.tags
    from (values ('Poha', '{home-cooked}'::text[]), ('Toor dal', '{home-cooked}'), ('Roti / chapati', '{home-cooked}'),
                 ('Curd / dahi', '{whole-food}'), ('Samosa', '{snack,junk}')) as x(food, tags)
    join public.foods f on f.user_id = uid and f.name = x.food
    where i % 3 <> 0 or x.food <> 'Samosa';
  end loop;

  -- Journal.
  insert into public.journal_entries (user_id, day, entry_type, title, body, mood, tags, word_count, created_at) values
    (uid, today - 1, 'free', 'A quieter week', 'Work settled down. I walked most evenings and **slept better** than last week.', 4, '{work,sleep}', 14, now() - interval '1 day'),
    (uid, today - 3, 'gratitude', null, E'1. Chai with Ravi\n2. Rain in the afternoon\n3. Finishing the report', 4, '{gratitude}', 12, now() - interval '3 days'),
    (uid, today - 8, 'brain_dump', 'Too many tabs open', 'Taxes, the trip plan, calling the plumber, that book Asha mentioned…', 3, '{admin}', 11, now() - interval '8 days');
  insert into public.journal_entries (user_id, day, entry_type, fields, body, mood, word_count) values
    (uid, today - 2, 'evening',
     '{"went_well":"Long walk after dinner.","drained":"Back-to-back calls.","tomorrow":"Block an hour for deep work."}',
     E'## What went well\n\nLong walk after dinner.\n\n## What drained me\n\nBack-to-back calls.\n\n## One thing for tomorrow\n\nBlock an hour for deep work.',
     3, 21);

  -- People.
  insert into public.people (user_id, name, relationship, contact_every_days, birthday_month, birthday_day)
  values (uid, 'Asha', 'friend', 14, extract(month from today + 10)::int, extract(day from today + 10)::int) returning id into p_asha;
  insert into public.people (user_id, name, relationship, contact_every_days) values (uid, 'Ravi', 'colleague', 30) returning id into p_ravi;
  insert into public.people (user_id, name, relationship, contact_every_days) values (uid, 'Mum', 'family', 7) returning id into p_mum;
  insert into public.interactions (user_id, person_id, day, kind, note) values
    (uid, p_asha, today - 25, 'in_person', 'Coffee in the park'),
    (uid, p_ravi, today - 3, 'in_person', 'Lunch'),
    (uid, p_mum, today - 9, 'call', null);
  insert into public.follow_ups (user_id, person_id, text) values (uid, p_asha, 'Ask how the new job is going');

  -- Tasks and notes.
  insert into public.tasks (user_id, title, due_date, priority, repeat, tags) values
    (uid, 'Pay electricity bill', today, 'high', 'monthly', '{home}'),
    (uid, 'Book dentist appointment', today, 'medium', 'none', '{health}'),
    (uid, 'Renew passport', today - 2, 'medium', 'none', '{admin}'),
    (uid, 'Water the plants', today + 1, 'low', 'weekly', '{home}'),
    (uid, 'Plan weekend trip', null, 'low', 'none', '{}');
  insert into public.notes (user_id, title, body, tags, pinned) values
    (uid, 'Books to read', E'- The Overstory\n- Four Thousand Weeks', '{reading}', true),
    (uid, 'Trip ideas', 'Coorg in the monsoon? Check train times.', '{travel}', false);

  insert into public.weekly_reviews (user_id, week_start, went_well, didnt_go_well, learned, next_focus)
  values (uid, date_trunc('week', today - 7)::date, 'Walked 6 of 7 days.', 'Late nights on Thursday and Friday.',
          'Evening walks help me sleep.', 'Lights out by 11 three nights this week.');

  -- Steps, health readings and goals.
  update public.check_ins set steps = 3500 + floor(random() * 6000)::int
   where user_id = uid and day >= today - 30;
  insert into public.health_readings (user_id, day, systolic, diastolic, resting_hr)
  select uid, today - g * 7, 134 - g, 86 - (g / 2), 78 - (g / 2) from generate_series(0, 8) g;
  insert into public.health_readings (user_id, day, glucose_mg_dl, glucose_context)
  select uid, today - g * 14, 108 - g * 2, 'fasting' from generate_series(0, 4) g;
  insert into public.goals (user_id, title, kind, target) values
    (uid, 'Walk 30 minutes without stopping', 'longest_walk', 30),
    (uid, '150 active minutes this week', 'weekly_activity_minutes', 150);
  update public.profiles set steps_target = 7000 where user_id = uid;

  -- A dated weight goal and an example medicine (generic names, development only).
  update public.profiles set birthday = '1994-05-13', height_cm = 175, sex = 'male', activity_level = 'sedentary'
   where user_id = uid;
  insert into public.goals (user_id, title, kind, target, start_value, due_date, created_at)
  values (uid, 'Lose 10 kg by my birthday', 'weight', 64, 74, (today + 170), now() - interval '56 days');
  insert into public.medications (user_id, name, dose, schedule_times, pills_left, start_date)
  values (uid, 'Example medicine', '1 tablet', '{08:00}', 20, today - 30);
  insert into public.medication_doses (user_id, medication_id, day, scheduled_time, status)
  select uid, m.id, today - g, '08:00', case when g % 6 = 0 then 'skipped' else 'taken' end
  from public.medications m, generate_series(1, 14) g
  where m.user_id = uid and m.name = 'Example medicine';

  -- Sleep times, mood tools.
  update public.check_ins
     set bedtime = time '23:00' + (floor(random() * 90)::int * interval '1 minute'),
         wake_time = time '06:45' + (floor(random() * 45)::int * interval '1 minute')
   where user_id = uid and day >= today - 14;
  insert into public.activities (user_id, day, title, category, status, mood_before, mood_after)
  select uid, today - g, (array['10-minute walk outside', 'Message a friend', 'Cook a dish I like'])[1 + g % 3],
         (array['movement', 'connection', 'pleasure'])[1 + g % 3], 'done', 4 + g % 2, 6 + g % 2
  from generate_series(1, 9) g;
  insert into public.activities (user_id, day, title, category) values (uid, today, 'Sit outside with tea for 10 minutes', 'pleasure');
  insert into public.assessments (user_id, kind, day, answers) values
    (uid, 'phq9', today - 33, '{2,2,1,2,1,1,1,0,0}'),
    (uid, 'phq9', today - 3, '{1,1,1,2,1,1,0,0,0}'),
    (uid, 'gad7', today - 3, '{2,1,1,1,0,1,1}');
  insert into public.cravings (user_id, day, logged_at, trigger, intensity, food, waited_minutes, intensity_after, outcome)
  select uid, today - g, now() - g * interval '1 day', (array['stressed', 'bored', 'tired'])[1 + g % 3]::text, 3 + g % 2, 'something sweet', 10, 2, (array['passed', 'alternative', 'ate_some'])[1 + g % 3]::text
  from generate_series(1, 6) g;

  raise notice 'Seed data written for dev@steady.local';
end;
$$;
