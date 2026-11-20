# Steady

A private, single-user web app for health, fitness, eating, mental wellbeing, social life and habits. Built with React, TypeScript, Vite, Tailwind CSS and Supabase.

**What's in it:** a Today screen with a gentle summary; a 30-second daily check-in with history charts and a mood calendar; habits with streaks, grace days, backfill and monthly grids; a full journal (Markdown editor with autosave, five entry types including evening review and thought record, 48 built-in prompts plus your own, full-text search, filters, calendar, on-this-day); workouts (templates, a fast logger with previous numbers prefilled, rule-based overload suggestions, rest timer, PRs, weekly volume); body measurements; food and water against your own optional targets with a library of 66 common Indian foods; guided **beginner plans** for people starting from zero (12-week walking, 8-week no-equipment home strength, 8-week chair-supported yoga) with a step-by-step session player; steps, health readings (blood pressure, blood sugar, resting heart rate) with a printable doctor summary, private progress photos, goals with automatic progress and quiet milestones, a dated weight goal (countdown, safe-pace check, chart against the goal path, weekly weigh-ins, a game plan and an optional calorie estimate), a private medication tracker (doses, refills, notes, calendar reminders and an appointment summary), mood tools (a mood-lifting activities planner, monthly PHQ-9 and GAD-7 self-checks, a cravings log with a 10-minute wait), sleep timing and regularity, a printable body-and-mind report, home-screen shortcuts, guided breathing, calendar files for plan reminders; people and gentle reach-out reminders; simple tasks and notes with quick capture from anywhere; weekly, monthly and yearly reviews; plain-arithmetic insights; full export and import. It installs to your phone's home screen as a PWA.

## Contents

1. [What you need](#1-what-you-need)
2. [Create a Supabase project](#2-create-a-supabase-project)
3. [Run the database migrations](#3-run-the-database-migrations)
4. [Configure sign-in (email + 6-digit PIN)](#4-configure-sign-in-email--6-digit-pin)
5. [Set environment variables](#5-set-environment-variables)
6. [Run locally](#6-run-locally)
7. [Run the checks and tests](#7-run-the-checks-and-tests)
8. [Deploy to Vercel](#8-deploy-to-vercel)
9. [Seed data (development only)](#9-seed-data-development-only)
10. [Install on your phone](#10-install-on-your-phone)
11. [Project structure](#11-project-structure)
12. [How it works](#12-how-it-works)
13. [Privacy and security](#13-privacy-and-security)

## 1. What you need

- Node.js 20 or newer and npm
- A free [Supabase](https://supabase.com) account
- A free [Vercel](https://vercel.com) account (for deployment)

```bash
npm install
```

## 2. Create a Supabase project

1. In the Supabase dashboard choose **New project**.
2. Pick a name (e.g. `steady`), a strong database password, and the region closest to you.
3. Wait for the project to finish provisioning.

## 3. Run the database migrations

The schema lives in [supabase/migrations/](supabase/migrations/). Files are numbered and **must run in order**:

| File | What it creates |
| --- | --- |
| `0001_foundation.sql` | Helpers (`set_updated_at`, `apply_owner_rls`), `profiles`, profile creation on sign-up |
| `0002_daily_loop.sql` | `check_ins`, `habits`, `habit_completions`, `journal_entries`, `thought_records`, `journal_prompts`, journal functions |
| `0003_body.sql` | `exercises`, `workout_templates`, `template_exercises`, `workouts`, `workout_sets`, `cardio_entries`, `body_measurements`, `foods`, `meals`, workout and template functions, the starter library |
| `0004_social_organisation.sql` | `people`, `interactions`, `follow_ups`, `tasks`, `notes`, `tags`, their triggers and `set_task_done` |
| `0005_review_and_data.sql` | `weekly_reviews`, `week_summary`, `import_backup`, `delete_my_account` |
| `0006_beginner_plans.sql` | `plan_enrollments`, `start_plan`, and `import_backup` updated to include plans |
| `0009_mind_and_sleep.sql` | `activities`, `assessments` (score computed by the database), `cravings`, bedtime and wake time on `check_ins` |
| `0008_weight_goal_and_medications.sql` | Optional profile details (birthday, height, sex, activity level), `medications`, `medication_doses`, `medication_notes`, `log_dose` / `undo_dose` (dose + pill count in one transaction), medications as a module |
| `0007_health_goals_photos.sql` | `health_readings`, `goals`, `progress_photos`, steps on `check_ins`, glucose unit and steps target on `profiles`, the private `progress-photos` Storage bucket with per-user folder policies, and an extended `week_summary` (steps, active minutes) |

**Option A: SQL editor (no tools needed)**

1. Open **SQL Editor** in your Supabase project.
2. For each file in `supabase/migrations/`, in number order, paste its contents and click **Run**.

**Option B: Supabase CLI**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

**Prove that users can't see each other's data:** paste [supabase/tests/rls_isolation.sql](supabase/tests/rls_isolation.sql) into the SQL editor and run it. It creates two throwaway users inside a transaction, checks every table, then rolls everything back. Success ends with the notice `RLS isolation: all checks passed`; any leak stops with an error naming the table.

## 4. Configure sign-in (email + 6-digit PIN)

Steady is single-user and signs in with your email (as a username) plus a 6-digit PIN. It never sends email: there is no confirmation email and no reset email. Under the hood the PIN is your Supabase account password, so Supabase's rate limiting and Row Level Security still apply.

In Supabase:

1. **Authentication → Sign In / Providers → Email:** turn **Confirm email** off. Leave **Secure password change** off as well (Steady asks for your current PIN before changing it).
2. **Authentication → Policies** (or **Providers → Email**, depending on dashboard version):
   - **Minimum password length:** 6 (the default). Anything above 6 rejects a 6-digit PIN.
   - **Password requirements:** "No required characters" (the default).
   - **Leaked password protection** (paid plans only): leave off, or avoid common PINs like `123456`, which it rejects.
3. **Authentication → URL Configuration → Site URL:** your app URL (`http://localhost:5173` until you deploy, then your Vercel URL). No redirect URLs are needed.
4. Open the app, go to **Set up Steady**, and create your account.
5. **Then lock the door:** turn **Allow new users to sign up** off in **Authentication → Sign In / Providers**. The anon key and URL are public by design, so otherwise anyone who finds your site could create their own account on your database. They could never see your data (RLS), but there's no reason to let them in.

Each device asks for the email once, then just the PIN. The 6th digit signs you in.

**Forgot your PIN?** In Supabase open **SQL Editor** and run (with your email and a new PIN):

```sql
update auth.users
   set encrypted_password = extensions.crypt('482916', extensions.gen_salt('bf'))
 where email = 'you@example.com';
```

**About PIN strength:** a 6-digit PIN has a million combinations. Supabase limits sign-in attempts per IP address (Authentication → Rate Limits), which makes guessing slow, but a PIN is weaker than a long password. Avoid obvious PINs (birthdays, `123456`, repeated digits).

## 5. Set environment variables

```bash
cp .env.example .env.local
```

Fill in the two values from Supabase → **Project settings → API**:

| Variable                 | Where to find it                       |
| ------------------------ | -------------------------------------- |
| `VITE_SUPABASE_URL`      | Project URL                            |
| `VITE_SUPABASE_ANON_KEY` | Project API keys → `anon` `public` key |

Never put the `service_role` key in this file or anywhere in the frontend. Steady only needs the public anon key; Row Level Security in the database keeps data private.

## 6. Run locally

```bash
npm run dev
```

Open http://localhost:5173, choose **Set up Steady**, and create your account with your email and a 6-digit PIN.

If the env variables are missing, the app shows a "connect Supabase" screen instead of crashing.

## 7. Run the checks and tests

| Command             | What it does                                                                  |
| ------------------- | ----------------------------------------------------------------------------- |
| `npm run typecheck` | TypeScript, strict mode                                                       |
| `npm run lint`      | ESLint                                                                        |
| `npm test`          | Vitest unit tests for the pure logic (151 tests, listed below)                |
| `npm run db:verify` | Applies every migration, the RLS tests and the seed to an in-memory Postgres (PGlite) |
| `npm run build`     | Production build                                                              |
| `npm run check`     | All of the above, in order                                                    |

Unit tests cover: dates and time zones (including midnight and daylight-saving boundaries); habit streaks (grace days, weekly targets, specific weekdays, backfilled completions, time-zone boundaries, week start); consistency and month grids; overload suggestions, Epley 1RM and PRs, unit conversion; insights (the 7-day minimum, sleep buckets); people (overdue, birthdays including 29 February); food maths and the clean-eating share; task views; the Today summary; journal helpers and Markdown export; Markdown formatting; CSV escaping; import validation; beginner plan content and progress; calendar file generation (event dates, times past midnight, escaping, 75-octet line folding); blood pressure and glucose reference ranges and unit conversion; goal progress and milestones; breathing pattern timing; photo resizing; weight-goal pace, goal path, smoothing and status, Mifflin–St Jeor calorie estimates with safe floors, birthday dates; medication schedules, adherence and refill timing; repeating calendar events; PHQ-9 / GAD-7 item counts, severity bands and the self-harm item; activity mood-lift stats; craving summaries; sleep duration across midnight and regularity.

The SQL test (`supabase/tests/rls_isolation.sql`) also checks behaviour: the repeating-task rule, `last_contacted_on`, word counts, tag syncing, the weekly summary, and that a second user can't reach the first user's rows through foreign keys, functions, import or account deletion.

`db:verify` uses a small stand-in for Supabase's `auth` schema ([scripts/db/supabase-shim.sql](scripts/db/supabase-shim.sql)). It catches SQL errors and RLS leaks quickly, but you should still run the migrations and the RLS test on your real project (section 3).

## 8. Deploy to Vercel

1. Push this project to a GitHub repository.
2. In Vercel choose **Add New → Project** and import the repository. Vercel detects Vite automatically; [vercel.json](vercel.json) sets the build command and an SPA rewrite so deep links like `/settings` work on refresh.
3. Under **Environment Variables** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as `.env.local`).
4. Click **Deploy**.
5. Copy the production URL into Supabase's **Site URL** (section 4).

Every later push to your main branch redeploys automatically.

## 9. Seed data (development only)

[supabase/seed.sql](supabase/seed.sql) fills a **development** project with sample data so screens aren't empty while testing. It is never run automatically.

1. Set up an account in the app as `dev@steady.local` (any PIN).
2. Paste `supabase/seed.sql` into the SQL editor and run it.

All seed rows belong to that one user. **To remove them**, delete the `dev@steady.local` user in **Authentication → Users**; every row they own is deleted with them. Don't run the seed file on the project you use for real. (Use a separate Supabase project for development, with sign-ups left on.)

## 10. Install on your phone

Open your deployed Steady URL on your phone, sign in, then:

- **iPhone (Safari):** Share → **Add to Home Screen**.
- **Android (Chrome):** menu ⋮ → **Install app** (or **Add to Home screen**).

It opens full-screen like an app. The service worker only caches the app shell so it opens fast and can show the offline banner; your data always comes live from Supabase. There are no push notifications or background reminders: reminders are in-app only (Today's summary, the reach-out list, due tasks).

## 11. Project structure

```
src/
  components/        Shared UI (ui/) and the app shell (layout/)
  features/<module>/ Queries, pure logic (+ tests) and module components:
                     auth, profile, checkin, habits, journal, workouts, food,
                     people, tasks, notes, review, insights, today, data
  pages/             Route screens (lazy-loaded)
  lib/supabase/      Supabase client (anon key only)
  lib/               Query client, navigation, online/offline helpers
  styles/theme.css   All colours as CSS variables (light and dark)
  types/             Database types
  utils/             Pure helpers (dates, errors) with unit tests
supabase/
  migrations/        Numbered SQL migrations, run in order
  tests/             SQL tests (RLS isolation)
  seed.sql           Development-only data
scripts/             Local tooling: db:verify, make-icons
public/              PWA manifest, icons, service worker
```

**Changing the look:** every colour is a CSS variable in [src/styles/theme.css](src/styles/theme.css), mapped to Tailwind names in [tailwind.config.ts](tailwind.config.ts). Edit the variables to restyle the whole app.

## 12. How it works

Decisions worth knowing about:

- **Days and time zones.** Calendar days are `date` columns computed in your time zone (Settings). A check-in at 00:30 belongs to the new day where you are, not in UTC.
- **Water** is a count on the day's check-in row rather than a separate log: you only ever need "glasses today", it's a single optimistic update, and quick capture can log water before the mood check-in is done.
- **Tags** are stored on journal entries, notes and tasks as indexed text arrays (one fast query to filter), and a trigger keeps the `tags` table up to date as your tag library for suggestions.
- **Starter library.** Each account gets its own editable copy of 41 exercises and 66 foods (values approximate per serving), installed when you sign up.
- **Ownership is enforced twice.** Besides RLS, child rows reference parents with composite foreign keys `(parent_id, user_id)`, so a row can't point at someone else's habit, workout or person even with a guessed id.
- **Multi-row changes are transactions** in database functions: saving a journal entry with its thought record, a workout with its sets, a template with its exercises, completing a repeating task, importing a backup. Logging an interaction updates `last_contacted_on` by trigger in the same transaction.
- **Streaks.** Today (or the current week) never breaks a streak until it's over. The optional grace day forgives one missed due day at most once every 7 days (weekly habits: one missed week every 4 weeks), and forgiven days don't add to the count. You can tick or untick any of the last 14 days.
- **Overload suggestions** are rules, not AI: if every working set last time reached the top of the template's rep range, add your increment (default 2.5, in Settings); otherwise repeat the weight.
- **Beginner plans** (Body → Beginner plans) are written for adults who have never exercised, including people living with obesity. They follow the WHO 2020 and US 2018 activity guidelines, ACSM guidance on weight management, resistance-training progression and pre-exercise screening, and use the talk test and a 0–10 effort scale; the full source list is in the app and in `src/features/plans/content.ts`. Walking reaches 150 min/week by week 8 and about 225 by week 12; strength is 2 days a week, progressing every two weeks; yoga starts seated and grows from 15 to 25 minutes. The content lives in code; only your enrollment (start date and days) is stored. Walks and yoga are logged as cardio entries; the strength plan creates a workout template for the normal logger. "Repeat this week" moves the plan back a week. Unit tests check the content itself (minutes add up, 150 min/week reached by week 8, no week jumps more than 30%).
- **Calendar reminders.** A plan page can download an `.ics` file with one event per planned session (time and reminder of your choice, a link back to the guided session). Your phone's calendar does the reminding; Steady never sends notifications. Re-downloading updates the same events in calendars that support it.
- **Health readings** store blood sugar in mg/dL and show it in your chosen unit. Reference notes use the 2017 ACC/AHA blood pressure categories and ADA glucose thresholds, with neutral wording; only a very high blood pressure reading (above 180/120) is highlighted. The summary page prints cleanly (or saves as PDF) for appointments.
- **Steps** are one number per day on the check-in row (like water), typed in from your phone. Steady doesn't connect to wearables.
- **Goals** compute progress from what you already log (active minutes, longest walk, workouts, steps, latest weight); only "something else" goals are updated by hand. **Milestones** (first 150-minute week, first 30-minute walk, 10 workouts…) are dated from your history and shown quietly, with no points or badges.
- **Progress photos** are resized on the device before upload, which also strips EXIF data such as location. Files live in a private bucket under a folder named with your user id; Storage policies allow only you to read, add or delete them, and the app views them through links that expire after an hour. Photos are not included in the JSON export (they're binary files); download any you want to keep first. Deleting your account removes the files, then the data.
- **Monthly and yearly reviews** reuse the weekly summary function over any date range, with charts and a comparison to the previous period.
- **Breathing** offers calm (in 4, out 6) and box (4-4-4-4) patterns, keeps the screen on, and can tick a breathing habit when you finish.
- **Weight goal with a date** (Goals → weight goal). You set how much to lose and by when (your birthday by default, if it's in Settings → About you). Steady shows the weekly pace needed and flags anything faster than about 1 kg a week as unsafe (NHS/CDC guidance). Progress uses the average of your last two weeks of weigh-ins, compared with a straight-line path, with ±0.5 kg tolerance, because daily weight swings are mostly water. The game plan links the walking and strength plans, a protein target (~1.2 g per kg of goal weight), key habits and a weekly weigh-in reminder. The optional calorie estimate uses the Mifflin–St Jeor equation, keeps the daily deficit between 300 and 750 kcal, and never suggests less than 1,500 kcal (men) or 1,200 kcal (women). Nothing is applied unless you tap to use it.
- **Medication tracker** (More → Medications). Doses are marked taken or skipped against each medicine's schedule; the pill count updates in the same database transaction and is restored on undo. "Taken on schedule" only counts doses whose time has passed. Refill warnings appear at your chosen count or about a week before running out. Reminders are a calendar file of repeating events. Steady never advises on dosing: it reminds you to talk to your prescriber before changing or stopping anything, and shows India's Tele-MANAS helpline (14416, free, 24/7) and 112. A gentle support card appears on Today only after three low-mood check-ins in a row, and can be dismissed for the day.
- **Mind tools** (More → Mind). *Mood-lifting activities* is a behavioural-activation planner: plan small things, rate mood 1–10 before and after, and see the average change per kind of activity (only with 3+ ratings; labelled as a pattern, not proof). *Monthly check* uses the standard PHQ-9 and GAD-7 wording and severity bands (free to reproduce, attributed in the app); the database computes the score from the answers. If the PHQ-9 self-harm question is answered above "not at all", support details (Tele-MANAS 14416, 112) appear immediately, before submitting. Results are described as symptom levels for the last two weeks, never a diagnosis. *Cravings* records trigger, strength, an optional 10-minute wait (screen kept on) and the outcome, then shows triggers, time of day and how often cravings were handled as you wanted.
- **Sleep** (More → Sleep). Bedtime and wake time can be logged on the check-in or the Sleep page; hours fill in automatically across midnight. Regularity is the spread (standard deviation) of bedtimes and wake times over 14 days, measured on a noon-to-noon clock so 23:30 and 00:30 are an hour apart.
- **Body and mind report** (Review → Report) gathers weight, mood, PHQ-9/GAD-7, sleep, activity, medication, health readings, food, cravings and activities for 30 or 90 days on one printable page.
- **Home-screen shortcuts.** On Android (and other browsers that support manifest shortcuts), long-press the installed icon for Check in, Weigh in, Log water and Medications. iPhone doesn't support web app shortcuts.
- **Insights** are plain averages, shown only when each group has at least 7 days, and always labelled "a pattern in your data, not proof of cause".
- **Calories** are hidden unless you turn them on, and Steady never shows shortfalls or "over budget" messages.
- **Autosave.** The journal and notes save a couple of seconds after you stop typing, when you leave a field or the app, and when you come back online. Until the server confirms, the journal keeps a copy on the device and offers to restore it.
- **Offline.** A banner appears and writes are refused with a clear message instead of being queued.
- **Export and import.** The JSON export contains everything. Import validates the file, shows what's in it, then writes it in one transaction (rows that already exist are skipped; nothing is deleted).
- **Design.** Steady follows Material Design 3: a tonal green colour scheme with matching dark theme (every text/background pair checked for WCAG AA contrast), Plus Jakarta Sans, large rounded cards, pill buttons, switches for on/off settings, a bottom navigation bar with an active indicator, and a floating Capture button. Settings → Appearance lets you swap the main colour (green, blue, purple, orange, yellow or pink); each option has its own contrast-checked light and dark palette and is remembered per device. Each area has its own colour-coded icon, so Today, More, Body and Mind are quick to scan. Today is a dashboard: a progress ring counting what's done (check-in, habits due, medication doses, a planned workout and tasks due, with a small celebration when everything is done), then glance tiles with 7-day mini charts for mood, sleep, steps and water (with a one-tap +1 glass) and your weight trend, then your cards. On laptops and bigger screens your day (progress, check-in, medication, habits, workout, tasks) sits on the left and the stats, weight goal, protein, journal and people sit in a narrower column on the right, so the things to do are visible without scrolling. On computers a slim navigation rail (with the Capture button) replaces the side menu and pages sit on a rounded canvas; hubs use the full width. Ctrl/⌘+K or `/` opens a search over every page and common action (also from the search icon on Today and the bar on More), and `C` opens quick capture. Checking things off animates and, on Android, gives a short vibration; swipe a task to the right to complete it. Loading placeholders shimmer, and empty pages have a small illustration. A remembered email signs in with a PIN pad.
- **Ready for AI later, without it now.** All data access goes through `src/features/*/queries.ts` and pure functions in `logic.ts`, so a future summary feature could reuse them. No AI is implemented.

## 13. Privacy and security

- Every user-owned table has `user_id uuid not null default auth.uid()` and Row Level Security that allows select, insert, update and delete only where `auth.uid() = user_id`. The policies are created by one helper (`public.apply_owner_rls`) so they are identical on every table.
- `npm run db:verify` and `supabase/tests/rls_isolation.sql` fail if any table in `public` lacks RLS or a `user_id`, or if one user can read, change, delete or create another user's rows.
- Only the public anon key is used in the browser.
- Writes are blocked while offline (with a banner) rather than queued, so nothing is lost silently.
- All user text is rendered as text. Markdown goes through react-markdown with raw HTML disabled and unsafe links stripped; there is no `dangerouslySetInnerHTML`.
- Optional app lock (Settings → Privacy lock): after 10 minutes without a tap or key press, or when you reopen Steady after a break, the whole app is replaced by a PIN pad. Nothing private is rendered behind it, and one PIN unlocks everything. You can also lock it any time from More or the side menu. The setting is stored in the existing `journal_lock_enabled` column, so no migration is needed.
- Settings → Delete account removes your progress photo files, then your account and every row you own (typed confirmation).
- `npm run db:verify` includes a stand-in for Supabase Storage, and the RLS test checks that another user can't list, upload into or delete from your photo folder.
- Sign-in is email + 6-digit PIN with no emails sent; turn off new sign-ups after creating your account (section 4).
- No push notifications, email reminders, tracking or AI features.
