-- rls_isolation.sql
-- Proves that one user can never read, change, delete or create another user's
-- rows in any user-owned table.
--
-- Run it in the Supabase SQL editor (or with `npm run db:verify` locally).
-- Everything happens inside a transaction that is rolled back at the end,
-- so it leaves no data behind. It raises an error on the first failure and
-- finishes with the notice "RLS isolation: all checks passed".

begin;

create schema tests;
grant usage on schema tests to authenticated, anon;

-- Act as a signed-in user (the same way Supabase's API sets the JWT).
create function tests.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end;
$$;

create function tests.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end;
$$;

create function tests.as_owner() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

grant execute on all functions in schema tests to authenticated, anon;

-- Checks a table, given that user `a` already owns at least one row in it.
create function tests.check_isolation(tbl text, a uuid, b uuid) returns void language plpgsql as $$
declare
  n bigint;
  sample jsonb;
  has_id boolean;
  cols text;
begin
  perform tests.as_owner();
  execute format('select count(*) from public.%I where user_id = $1', tbl) into n using a;
  if n = 0 then
    raise exception '[%] test setup error: user A has no rows', tbl;
  end if;
  execute format('select to_jsonb(t) from public.%I t where user_id = $1 limit 1', tbl) into sample using a;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = tbl and column_name = 'id'
  ) into has_id;
  if has_id then
    sample := jsonb_set(sample, '{id}', to_jsonb(gen_random_uuid()));
  end if;

  -- Owner can see their own rows.
  perform tests.as_user(a);
  execute format('select count(*) from public.%I where user_id = $1', tbl) into n using a;
  if n = 0 then raise exception '[%] user A cannot read their own rows', tbl; end if;

  -- Another user cannot read, update or delete them.
  perform tests.as_user(b);
  execute format('select count(*) from public.%I where user_id = $1', tbl) into n using a;
  if n <> 0 then raise exception '[%] user B can read user A''s rows', tbl; end if;

  execute format('update public.%I set updated_at = now() where user_id = $1', tbl) using a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception '[%] user B can update user A''s rows', tbl; end if;

  execute format('delete from public.%I where user_id = $1', tbl) using a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception '[%] user B can delete user A''s rows', tbl; end if;

  -- Another user cannot create rows owned by A.
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = tbl and is_generated = 'NEVER';
  begin
    execute format('insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1)',
      tbl, cols)
      using sample;
    raise exception '[%] user B could insert a row owned by user A', tbl;
  exception
    when insufficient_privilege then null; -- expected: blocked by RLS
  end;

  -- Signed-out visitors see nothing.
  perform tests.as_anon();
  begin
    execute format('select count(*) from public.%I', tbl) into n;
    if n <> 0 then raise exception '[%] anonymous users can read rows', tbl; end if;
  exception
    when insufficient_privilege then null; -- also fine: no access at all
  end;

  -- A's rows are untouched.
  perform tests.as_owner();
  execute format('select count(*) from public.%I where user_id = $1', tbl) into n using a;
  if n = 0 then raise exception '[%] user A''s rows were changed by user B', tbl; end if;

  raise notice 'RLS ok: %', tbl;
end;
$$;

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  tbl text;
  missing text;
  v_habit uuid;
  v_entry uuid;
  v_template uuid;
  v_exercise uuid;
  v_workout uuid;
  v_person uuid;
  v_task uuid;
  v_note uuid;
  v_med uuid;
  j jsonb;
begin
  -- Every table in the public schema must have RLS on and a user_id column.
  select string_agg(c.relname, ', ') into missing
  from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if missing is not null then raise exception 'RLS is not enabled on: %', missing; end if;

  select string_agg(t.table_name, ', ') into missing
  from information_schema.tables t
  where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
    and not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = t.table_name
        and c.column_name = 'user_id' and c.is_nullable = 'NO'
    );
  if missing is not null then raise exception 'Tables without a not-null user_id: %', missing; end if;

  -- Two users. Their profiles and starter libraries are created by the sign-up trigger.
  insert into auth.users (id, email, raw_user_meta_data)
  values (a, 'rls-a@example.test', '{"time_zone":"Asia/Kolkata"}'),
         (b, 'rls-b@example.test', '{"time_zone":"Europe/London"}');

  -- ---- Rows owned by user A, created through the app's own paths ----
  perform tests.as_user(a);

  insert into public.check_ins (day, mood, water_glasses) values ('2026-01-01', 4, 3);
  insert into public.habits (name) values ('Walk') returning id into v_habit;
  insert into public.habit_completions (habit_id, day) values (v_habit, '2026-01-01');

  select id into v_entry from public.save_journal_entry(
    '{"day":"2026-01-01","entry_type":"thought_record","body":"hello  world","tags":["Calm"," calm "]}',
    '{"situation":"a meeting","belief_before":80,"belief_after":40}');
  insert into public.journal_prompts (text) values ('What helped today?');

  select id into v_exercise from public.exercises order by name limit 1;
  v_template := public.save_template('{"name":"Push","weekdays":[1,4]}',
    jsonb_build_array(jsonb_build_object('exercise_id', v_exercise, 'target_sets', 3, 'rep_min', 6, 'rep_max', 10)));
  if (select weekdays from public.workout_templates where id = v_template) <> '{1,4}' then
    raise exception 'save_template weekdays wrong';
  end if;
  v_workout := public.save_workout(
    jsonb_build_object('day', '2026-01-01', 'template_id', v_template, 'name', 'Push'),
    jsonb_build_array(jsonb_build_object(
      'exercise_id', v_exercise, 'set_number', 1, 'weight_kg', 50, 'reps', 8, 'completed', true)));
  insert into public.cardio_entries (day, activity, duration_min) values ('2026-01-01', 'walk', 30);
  insert into public.body_measurements (day, weight_kg) values ('2026-01-01', 70);
  insert into public.meals (day, name, protein_g, food_id)
    values ('2026-01-01', 'Dal', 9, (select id from public.foods order by name limit 1));

  insert into public.people (name, contact_every_days) values ('Asha', 14) returning id into v_person;
  insert into public.interactions (person_id, day, kind) values (v_person, '2026-01-02', 'call');
  insert into public.follow_ups (person_id, text) values (v_person, 'Ask about the new job');

  insert into public.tasks (title, due_date, repeat, tags) values ('Pay rent', '2026-01-01', 'monthly', '{home}')
    returning id into v_task;
  insert into public.notes (title, body, tags) values ('Idea', 'Plant herbs', '{garden}') returning id into v_note;
  insert into public.weekly_reviews (week_start, went_well) values ('2025-12-29', 'Slept well');
  insert into public.health_readings (day, systolic, diastolic, resting_hr) values ('2026-01-01', 128, 82, 72);
  insert into public.health_readings (day, glucose_mg_dl, glucose_context) values ('2026-01-01', 104, 'fasting');
  insert into public.goals (title, kind, target) values ('Walk 30 minutes non-stop', 'longest_walk', 30);
  update public.check_ins set steps = 6400 where day = '2026-01-01';
  insert into storage.objects (bucket_id, name, owner) values ('progress-photos', a::text || '/p1.jpg', a);
  insert into public.progress_photos (day, path) values ('2026-01-01', a::text || '/p1.jpg');
  begin
    insert into public.progress_photos (day, path) values ('2026-01-02', b::text || '/sneaky.jpg');
    raise exception 'a photo row could point into another user''s folder';
  exception when check_violation then null;
  end;
  begin
    insert into public.health_readings (day, systolic) values ('2026-01-02', 120);
    raise exception 'blood pressure without both numbers was accepted';
  exception when check_violation then null;
  end;
  insert into public.medications (name, dose, schedule_times, pills_left, pills_per_dose)
    values ('Example med', '50 mg', '{08:00,21:00}', 10, 1) returning id into v_med;
  perform public.log_dose(v_med, '2026-01-01', '08:00', 'taken');
  perform public.log_dose(v_med, '2026-01-01', '08:00', 'taken'); -- idempotent: no double count
  if (select pills_left from public.medications where id = v_med) <> 9 then
    raise exception 'pill count wrong after taking a dose';
  end if;
  perform public.log_dose(v_med, '2026-01-01', '08:00', 'skipped');
  if (select pills_left from public.medications where id = v_med) <> 10 then
    raise exception 'switching to skipped should return the pill';
  end if;
  perform public.log_dose(v_med, '2026-01-01', '21:00', 'taken');
  perform public.undo_dose((select id from public.medication_doses where scheduled_time = '21:00'));
  if (select pills_left from public.medications where id = v_med) <> 10
     or (select count(*) from public.medication_doses) <> 1 then
    raise exception 'undo_dose wrong';
  end if;
  insert into public.medication_notes (medication_id, day, text) values (v_med, '2026-01-01', 'A bit sleepy in the mornings');
  insert into public.activities (day, title, category, mood_before, mood_after, status)
    values ('2026-01-01', 'Call a friend', 'connection', 4, 6, 'done');
  insert into public.assessments (kind, day, answers) values ('phq9', '2026-01-01', '{1,2,1,1,0,1,1,0,0}');
  insert into public.assessments (kind, day, answers, difficulty) values ('gad7', '2026-01-01', '{2,2,1,1,0,1,1}', 1);
  if (select score from public.assessments where kind = 'phq9') <> 7 or (select score from public.assessments where kind = 'gad7') <> 8 then
    raise exception 'assessment scores wrong';
  end if;
  begin
    insert into public.assessments (kind, day, answers) values ('gad7', '2026-01-02', '{1,1,1}');
    raise exception 'a GAD-7 with 3 answers was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.assessments (kind, day, answers) values ('phq9', '2026-01-02', '{4,0,0,0,0,0,0,0,0}');
    raise exception 'an answer of 4 was accepted';
  exception when check_violation then null;
  end;
  insert into public.cravings (day, trigger, intensity, food, waited_minutes, intensity_after, outcome)
    values ('2026-01-01', 'stressed', 4, 'chips', 10, 2, 'passed');
  update public.check_ins set bedtime = '23:30', wake_time = '07:00' where day = '2026-01-01';
  update public.profiles set birthday = '1994-05-13', height_cm = 175, sex = 'male', activity_level = 'sedentary',
    disabled_modules = '{medications}';
  perform public.start_plan('walk-12', '2026-01-01', '{1,2,3,4,5}');
  perform public.start_plan('home-strength-8', '2026-01-01', '{2,5}',
    '{"name":"Home strength (beginner plan)","library":[{"name":"Chair sit-to-stand","muscle_group":"legs","equipment":"bodyweight"}],"exercises":[{"name":"Chair sit-to-stand","target_sets":2,"rep_min":8,"rep_max":10}]}');
  -- Restarting reuses the same template and ends the old enrollment.
  perform public.start_plan('home-strength-8', '2026-01-08', '{1,4}',
    '{"name":"Home strength (beginner plan)","library":[{"name":"Chair sit-to-stand","muscle_group":"legs","equipment":"bodyweight"}],"exercises":[{"name":"Chair sit-to-stand","target_sets":2,"rep_min":8,"rep_max":10}]}');

  -- ---- Behaviour checks (as A) ----
  if (select count(*) from public.exercises) < 40 then raise exception 'starter exercises missing'; end if;
  if (select count(*) from public.foods) < 60 then raise exception 'starter foods missing'; end if;
  if (select word_count from public.journal_entries where id = v_entry) <> 2 then
    raise exception 'journal word count wrong';
  end if;
  if (select tags from public.journal_entries where id = v_entry) <> '{calm}' then
    raise exception 'journal tags not normalised';
  end if;
  if not exists (select 1 from public.tags where name = 'calm') then raise exception 'tag library not synced'; end if;
  if (select last_contacted_on from public.people where id = v_person) <> '2026-01-02' then
    raise exception 'last_contacted_on not maintained';
  end if;
  perform public.set_task_done(v_task, true, '2026-01-05');
  if (select count(*) from public.tasks where status = 'open' and due_date = '2026-02-01') <> 1 then
    raise exception 'repeating task did not create exactly one next occurrence';
  end if;
  perform public.set_task_done(v_task, false, '2026-01-05');
  if (select count(*) from public.tasks) <> 1 then raise exception 'reopening did not remove the next occurrence'; end if;
  perform public.set_task_done(v_task, true, '2026-01-05');
  if (select count(*) from public.last_sets(array[v_exercise])) <> 1 then raise exception 'last_sets wrong'; end if;
  if (select count(*) from public.plan_enrollments where ended_at is null) <> 2 then
    raise exception 'expected two active plans';
  end if;
  if (select count(distinct template_id) from public.plan_enrollments where plan_id = 'home-strength-8') <> 1 then
    raise exception 'restarting a strength plan should reuse its template';
  end if;
  if (select count(*) from public.template_exercises te join public.plan_enrollments pe on pe.template_id = te.template_id
      where pe.plan_id = 'home-strength-8' and pe.ended_at is null) <> 1 then
    raise exception 'strength plan template exercises wrong';
  end if;
  j := public.week_summary('2025-12-29', '2026-01-04', 'Asia/Kolkata', '2026-01-05');
  if (j ->> 'steps_avg')::int <> 6400 or (j ->> 'cardio_minutes')::int <> 30 then
    raise exception 'week_summary steps/minutes wrong: %', j;
  end if;
  if (j ->> 'workouts')::int <> 1 or (j ->> 'people_contacted')::int <> 1 or (j ->> 'journal_days')::int <> 1 then
    raise exception 'week_summary wrong: %', j;
  end if;

  perform tests.as_owner();

  -- ---- Check every user-owned table ----
  for tbl in
    select t.table_name from information_schema.tables t
    where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
    order by t.table_name
  loop
    perform tests.check_isolation(tbl, a, b);
  end loop;

  -- ---- User B attacks A's rows through foreign keys and functions ----
  perform tests.as_user(b);

  begin
    insert into public.habit_completions (habit_id, day) values (v_habit, '2026-01-03');
    raise exception 'B attached a completion to A''s habit';
  exception when foreign_key_violation then null;
  end;

  begin
    perform public.set_task_done(v_task, false, '2026-01-05');
    raise exception 'B changed A''s task through set_task_done';
  exception when no_data_found then null;
  end;

  begin
    perform public.save_journal_entry(jsonb_build_object('id', v_entry, 'day', '2026-01-01', 'body', 'hacked'));
    raise exception 'B edited A''s journal entry';
  exception when no_data_found then null;
  end;

  begin
    perform public.save_workout(jsonb_build_object('id', v_workout), '[]'::jsonb);
    raise exception 'B edited A''s workout';
  exception when no_data_found then null;
  end;

  begin
    perform public.save_template(jsonb_build_object('id', v_template, 'name', 'x'), '[]'::jsonb);
    raise exception 'B edited A''s template';
  exception when no_data_found then null;
  end;

  begin
    perform public.log_dose(v_med, '2026-01-02', '08:00', 'taken');
    raise exception 'B logged a dose of A''s medication';
  exception when no_data_found then null;
  end;

  begin
    perform public.undo_dose((select id from public.medication_doses limit 1));
    raise exception 'B undid A''s dose';
  exception when no_data_found then null;
  end;

  begin
    insert into public.medication_doses (medication_id, day, scheduled_time, status) values (v_med, '2026-01-03', '08:00', 'taken');
    raise exception 'B attached a dose to A''s medication';
  exception when foreign_key_violation then null;
  end;

  if (public.journal_stats() ->> 'total_entries')::int <> 0 then raise exception 'B sees A''s journal stats'; end if;
  if (public.week_summary('2025-12-29', '2026-01-04', 'UTC', '2026-01-05') ->> 'workouts')::int <> 0 then
    raise exception 'B sees A''s weekly summary';
  end if;
  if (select count(*) from public.last_sets(array[v_exercise])) <> 0 then raise exception 'B sees A''s sets'; end if;

  -- Photo files: B can't see, add to, or delete from A's folder.
  if (select count(*) from storage.objects where bucket_id = 'progress-photos') <> 0 then
    raise exception 'B can see A''s photo files';
  end if;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('progress-photos', a::text || '/evil.jpg', b);
    raise exception 'B uploaded into A''s photo folder';
  exception when insufficient_privilege then null;
  end;
  delete from storage.objects where bucket_id = 'progress-photos';
  perform tests.as_owner();
  if (select count(*) from storage.objects where bucket_id = 'progress-photos') <> 1 then
    raise exception 'B deleted A''s photo file';
  end if;
  perform tests.as_user(b);

  -- Importing a file that contains A's ids must not touch A's rows.
  j := public.import_backup(jsonb_build_object('notes', jsonb_build_array(
    jsonb_build_object('id', v_note, 'title', 'stolen', 'body', 'x'))));
  if (j ->> 'notes')::int <> 0 then raise exception 'B imported over A''s note'; end if;

  perform public.delete_my_account();
  perform tests.as_owner();
  if (select title from public.notes where id = v_note) <> 'Idea' then raise exception 'A''s note changed'; end if;
  if not exists (select 1 from auth.users where id = a) then raise exception 'B deleted A''s account'; end if;
  if exists (select 1 from auth.users where id = b) then raise exception 'delete_my_account did not delete B'; end if;
  if exists (select 1 from public.exercises where user_id = b) then raise exception 'B''s data survived deletion'; end if;

  raise notice 'RLS isolation: all checks passed';
end;
$$;

rollback;
