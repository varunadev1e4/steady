-- 0004_social_organisation.sql
-- People and interactions, tasks, notes and the shared tag library.

------------------------------------------------------------------------------
-- People
------------------------------------------------------------------------------

create table public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  relationship text check (char_length(relationship) <= 40),
  -- Birthday as month/day with an optional year, since the year is often unknown.
  birthday_month smallint check (birthday_month between 1 and 12),
  birthday_day smallint check (birthday_day between 1 and 31),
  birth_year smallint check (birth_year between 1900 and 2100),
  notes text check (char_length(notes) <= 5000),
  contact_every_days smallint check (contact_every_days between 1 and 730),
  -- Maintained by a trigger on interactions; never written by the app.
  last_contacted_on date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint people_id_user unique (id, user_id),
  constraint people_birthday_pair check ((birthday_month is null) = (birthday_day is null))
);

create index people_user_idx on public.people (user_id);

select public.apply_owner_rls('people');

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  person_id uuid not null,
  day date not null,
  kind text not null check (kind in ('call', 'message', 'in_person', 'other')),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interactions_person_fk foreign key (person_id, user_id)
    references public.people (id, user_id) on delete cascade
);

create index interactions_user_day_idx on public.interactions (user_id, day desc);
create index interactions_person_idx on public.interactions (person_id, day desc);

select public.apply_owner_rls('interactions');

-- Keeps people.last_contacted_on equal to their latest interaction, in the
-- same transaction as the insert, edit or delete.
create or replace function public.sync_last_contacted()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.people p
       set last_contacted_on = (select max(i.day) from public.interactions i where i.person_id = old.person_id)
     where p.id = old.person_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.people p
       set last_contacted_on = (select max(i.day) from public.interactions i where i.person_id = new.person_id)
     where p.id = new.person_id;
  end if;
  return null;
end;
$$;

create trigger interactions_sync_last_contacted
  after insert or update or delete on public.interactions
  for each row execute function public.sync_last_contacted();

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  person_id uuid not null,
  text text not null check (char_length(btrim(text)) between 1 and 300),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint follow_ups_person_fk foreign key (person_id, user_id)
    references public.people (id, user_id) on delete cascade
);

create index follow_ups_person_idx on public.follow_ups (person_id);

select public.apply_owner_rls('follow_ups');

------------------------------------------------------------------------------
-- Tasks (deliberately simple: no projects, subtasks or recurrence rules)
------------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  notes text check (char_length(notes) <= 5000),
  due_date date,
  due_time time,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'done')),
  done_at timestamptz,
  repeat text not null default 'none' check (repeat in ('none', 'daily', 'weekly', 'monthly')),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  -- The next occurrence created when this repeating task was completed.
  spawned_task_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_id_user unique (id, user_id),
  constraint tasks_time_needs_date check (due_time is null or due_date is not null),
  constraint tasks_spawned_fk foreign key (spawned_task_id, user_id)
    references public.tasks (id, user_id) on delete set null (spawned_task_id)
);

create index tasks_user_status_due_idx on public.tasks (user_id, status, due_date);
create index tasks_tags_idx on public.tasks using gin (tags);

select public.apply_owner_rls('tasks');

-- Completes or reopens a task. Completing a repeating task creates only the
-- next occurrence (never marks future ones done). Reopening removes that next
-- occurrence again if it hasn't been completed.
create or replace function public.set_task_done(p_task uuid, p_done boolean, p_today date)
returns public.tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  t public.tasks;
  v_next date;
  v_new uuid;
begin
  select * into t from public.tasks where id = p_task for update;
  if not found then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;

  if p_done then
    if t.status = 'done' then return t; end if;
    update public.tasks set status = 'done', done_at = now() where id = p_task returning * into t;

    if t.repeat <> 'none' then
      v_next := coalesce(t.due_date, p_today);
      loop
        v_next := case t.repeat
          when 'daily' then v_next + 1
          when 'weekly' then v_next + 7
          else (v_next + interval '1 month')::date
        end;
        -- An overdue repeating task continues from today, not in the past.
        exit when v_next >= p_today;
      end loop;

      insert into public.tasks (title, notes, due_date, due_time, priority, repeat, tags)
      values (t.title, t.notes, v_next, t.due_time, t.priority, t.repeat, t.tags)
      returning id into v_new;

      update public.tasks set spawned_task_id = v_new where id = p_task returning * into t;
    end if;
  else
    if t.status = 'open' then return t; end if;
    if t.spawned_task_id is not null then
      delete from public.tasks where id = t.spawned_task_id and status = 'open';
    end if;
    update public.tasks set status = 'open', done_at = null, spawned_task_id = null
     where id = p_task returning * into t;
  end if;

  return t;
end;
$$;

------------------------------------------------------------------------------
-- Notes
------------------------------------------------------------------------------

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 100000),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  pinned boolean not null default false,
  archived boolean not null default false,
  search tsvector generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A')
    || setweight(to_tsvector('english'::regconfig, body), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_user_updated_idx on public.notes (user_id, updated_at desc);
create index notes_search_idx on public.notes using gin (search);
create index notes_tags_idx on public.notes using gin (tags);

select public.apply_owner_rls('notes');

------------------------------------------------------------------------------
-- Tags
--
-- Journal entries, notes and tasks keep their tags as a text[] column (GIN
-- indexed), which makes "filter by tag" a single indexed query and avoids
-- three join tables. This table is the user's tag library (for suggestions),
-- kept up to date by trigger whenever tagged rows are saved.
------------------------------------------------------------------------------

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_unique_name unique (user_id, name)
);

select public.apply_owner_rls('tags');

create or replace function public.sync_tags()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if cardinality(new.tags) > 0 then
    insert into public.tags (user_id, name)
    select new.user_id, t from unnest(new.tags) t where char_length(t) between 1 and 40
    on conflict (user_id, name) do nothing;
  end if;
  return null;
end;
$$;

create trigger journal_entries_sync_tags after insert or update of tags on public.journal_entries
  for each row execute function public.sync_tags();
create trigger notes_sync_tags after insert or update of tags on public.notes
  for each row execute function public.sync_tags();
create trigger tasks_sync_tags after insert or update of tags on public.tasks
  for each row execute function public.sync_tags();
