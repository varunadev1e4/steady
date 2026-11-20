-- 0002_daily_loop.sql
-- Daily check-ins, habits and the journal.
--
-- Conventions used in every migration:
--   * Calendar days are `date` columns in the user's own time zone (the app
--     computes "today" from profiles.time_zone). Instants are timestamptz.
--   * Child tables reference their parent with a composite foreign key
--     (parent_id, user_id) so a row can never point at another user's parent,
--     even if someone guesses its id.

------------------------------------------------------------------------------
-- Check-ins: one row per user per day.
--
-- Water lives here as a count (water_glasses) rather than in a water_logs
-- table: we only ever need "glasses today", one row per day keeps it a single
-- upsert, and the +/- buttons update it optimistically. Quick capture and the
-- food page can log water before the mood check-in is done, so every check-in
-- field is nullable and "checked in" means mood is set.
------------------------------------------------------------------------------

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  stress smallint check (stress between 1 and 5),
  sleep_hours numeric(3, 1) check (sleep_hours between 0 and 24),
  sleep_quality smallint check (sleep_quality between 1 and 5),
  water_glasses smallint not null default 0 check (water_glasses between 0 and 40),
  note text check (char_length(note) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint check_ins_one_per_day unique (user_id, day)
);

select public.apply_owner_rls('check_ins');

------------------------------------------------------------------------------
-- Habits
------------------------------------------------------------------------------

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  icon text not null default 'check' check (char_length(icon) <= 40),
  color text not null default 'sage' check (color in ('sage', 'clay', 'amber', 'sky', 'plum', 'stone')),
  -- daily | weekdays (on the listed weekdays, 0 = Sunday) | weekly (N times per week)
  frequency text not null default 'daily' check (frequency in ('daily', 'weekdays', 'weekly')),
  weekdays smallint[] not null default '{}' check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  times_per_week smallint check (times_per_week between 1 and 7),
  target_time text not null default 'any' check (target_time in ('any', 'morning', 'afternoon', 'evening')),
  -- Forgive one missed day (or week) at most once every 7 days (or weeks).
  grace_enabled boolean not null default false,
  start_date date not null default current_date,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint habits_id_user unique (id, user_id),
  constraint habits_weekdays_set check (frequency <> 'weekdays' or cardinality(weekdays) >= 1),
  constraint habits_weekly_target check (frequency <> 'weekly' or times_per_week is not null)
);

create index habits_user_idx on public.habits (user_id, sort_order);

select public.apply_owner_rls('habits');

create table public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null,
  day date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint habit_completions_once_per_day unique (habit_id, day),
  constraint habit_completions_habit_fk foreign key (habit_id, user_id)
    references public.habits (id, user_id) on delete cascade
);

create index habit_completions_user_day_idx on public.habit_completions (user_id, day);

select public.apply_owner_rls('habit_completions');

------------------------------------------------------------------------------
-- Journal
------------------------------------------------------------------------------

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  entry_type text not null default 'free'
    check (entry_type in ('free', 'gratitude', 'evening', 'brain_dump', 'thought_record')),
  title text check (char_length(title) <= 200),
  -- Markdown. For structured types (evening review, thought record) the app
  -- also writes a readable Markdown version here so search and export work.
  body text not null default '' check (char_length(body) <= 100000),
  -- Structured sections, e.g. the evening review's three answers.
  fields jsonb not null default '{}'::jsonb,
  prompt text check (char_length(prompt) <= 500),
  mood smallint check (mood between 1 and 5),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  pinned boolean not null default false,
  word_count integer not null default 0 check (word_count >= 0),
  search tsvector generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A')
    || setweight(to_tsvector('english'::regconfig, body), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_entries_id_user unique (id, user_id)
);

create index journal_entries_user_day_idx on public.journal_entries (user_id, day desc, created_at desc);
create index journal_entries_search_idx on public.journal_entries using gin (search);
create index journal_entries_tags_idx on public.journal_entries using gin (tags);

select public.apply_owner_rls('journal_entries');

-- Thought records: the structured part of a "thought record" journal entry.
create table public.thought_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id uuid not null unique,
  situation text not null default '' check (char_length(situation) <= 5000),
  automatic_thought text not null default '' check (char_length(automatic_thought) <= 5000),
  belief_before smallint check (belief_before between 0 and 100),
  evidence_for text not null default '' check (char_length(evidence_for) <= 5000),
  evidence_against text not null default '' check (char_length(evidence_against) <= 5000),
  balanced_thought text not null default '' check (char_length(balanced_thought) <= 5000),
  belief_after smallint check (belief_after between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint thought_records_entry_fk foreign key (entry_id, user_id)
    references public.journal_entries (id, user_id) on delete cascade
);

select public.apply_owner_rls('thought_records');

-- The built-in prompt library ships with the app; this table holds the
-- prompts the user writes themselves.
create table public.journal_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null default 'custom'
    check (category in ('custom', 'gratitude', 'reflection', 'goals', 'relationships', 'body', 'worries', 'wins', 'tomorrow')),
  text text not null check (char_length(btrim(text)) between 3 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index journal_prompts_user_idx on public.journal_prompts (user_id);

select public.apply_owner_rls('journal_prompts');

-- Saves a journal entry (and its thought record, if any) in one transaction.
-- Runs with the caller's rights, so Row Level Security still applies.
create or replace function public.save_journal_entry(p_entry jsonb, p_thought jsonb default null)
returns public.journal_entries
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_entry ->> 'id', '')::uuid;
  v_body text := coalesce(p_entry ->> 'body', '');
  v_words integer := coalesce(
    array_length(regexp_split_to_array(nullif(btrim(v_body), ''), '\s+'), 1), 0);
  v_tags text[] := coalesce(array(
    select distinct lower(btrim(t))
    from jsonb_array_elements_text(coalesce(p_entry -> 'tags', '[]'::jsonb)) t
    where btrim(t) <> ''
  ), '{}');
  v_row public.journal_entries;
begin
  if v_id is null then
    insert into public.journal_entries (day, entry_type, title, body, fields, prompt, mood, tags, pinned, word_count)
    values (
      (p_entry ->> 'day')::date,
      coalesce(p_entry ->> 'entry_type', 'free'),
      nullif(btrim(p_entry ->> 'title'), ''),
      v_body,
      coalesce(p_entry -> 'fields', '{}'::jsonb),
      nullif(p_entry ->> 'prompt', ''),
      (p_entry ->> 'mood')::smallint,
      v_tags,
      coalesce((p_entry ->> 'pinned')::boolean, false),
      v_words
    )
    returning * into v_row;
  else
    update public.journal_entries set
      day = (p_entry ->> 'day')::date,
      entry_type = coalesce(p_entry ->> 'entry_type', entry_type),
      title = nullif(btrim(p_entry ->> 'title'), ''),
      body = v_body,
      fields = coalesce(p_entry -> 'fields', '{}'::jsonb),
      prompt = nullif(p_entry ->> 'prompt', ''),
      mood = (p_entry ->> 'mood')::smallint,
      tags = v_tags,
      pinned = coalesce((p_entry ->> 'pinned')::boolean, pinned),
      word_count = v_words
    where id = v_id
    returning * into v_row;
    if not found then
      raise exception 'Journal entry not found' using errcode = 'P0002';
    end if;
  end if;

  if p_thought is not null then
    insert into public.thought_records (
      entry_id, situation, automatic_thought, belief_before,
      evidence_for, evidence_against, balanced_thought, belief_after)
    values (
      v_row.id,
      coalesce(p_thought ->> 'situation', ''),
      coalesce(p_thought ->> 'automatic_thought', ''),
      (p_thought ->> 'belief_before')::smallint,
      coalesce(p_thought ->> 'evidence_for', ''),
      coalesce(p_thought ->> 'evidence_against', ''),
      coalesce(p_thought ->> 'balanced_thought', ''),
      (p_thought ->> 'belief_after')::smallint)
    on conflict (entry_id) do update set
      situation = excluded.situation,
      automatic_thought = excluded.automatic_thought,
      belief_before = excluded.belief_before,
      evidence_for = excluded.evidence_for,
      evidence_against = excluded.evidence_against,
      balanced_thought = excluded.balanced_thought,
      belief_after = excluded.belief_after;
  end if;

  return v_row;
end;
$$;

-- Totals for the journal home: entry count, words, and the days written on
-- (last ~13 months, for the writing streak and calendar).
create or replace function public.journal_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'total_entries', (select count(*) from public.journal_entries),
    'total_words', (select coalesce(sum(word_count), 0) from public.journal_entries),
    'days', coalesce((
      select jsonb_agg(d order by d desc)
      from (select distinct day as d from public.journal_entries where day > current_date - 400) x
    ), '[]'::jsonb)
  );
$$;
