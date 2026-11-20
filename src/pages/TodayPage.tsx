import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Apple, BookOpen, ClipboardCheck, Footprints, ListChecks, ListTodo, PenLine, Plus, Search, Users } from 'lucide-react';
import { openPalette } from '@/lib/appEvents';
import { GlanceTiles } from '@/features/today/GlanceTiles';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useDoses, useMedications } from '@/features/medications/queries';
import { dosesOn, doseKey } from '@/features/medications/logic';
import { useLoadedProfile } from '@/features/profile/queries';
import { useModuleEnabled, useToday } from '@/features/profile/useToday';
import { useCheckIn } from '@/features/checkin/queries';
import { useCompletionMap, useCompletions, useHabits, useToggleCompletion } from '@/features/habits/queries';
import { computeStreaks, isDueToday, weekProgress, weekdayOf } from '@/features/habits/streaks';
import { frequencyLabel, TARGET_TIME_ORDER } from '@/features/habits/display';
import { HabitCheck } from '@/features/habits/HabitCheck';
import { useRecentWorkouts, useTemplates } from '@/features/workouts/queries';
import { plannedTemplate } from '@/features/workouts/logic';
import { useMealsForDay } from '@/features/food/queries';
import { dayTotals } from '@/features/food/logic';
import { QuickAddMeal } from '@/features/food/QuickAddMeal';
import { useTasks } from '@/features/tasks/queries';
import { tasksForView } from '@/features/tasks/logic';
import { TaskRow } from '@/features/tasks/TaskRow';
import { useEntriesOnDays } from '@/features/journal/queries';
import { entryTypeLabel, preview } from '@/features/journal/logic';
import { promptForDay } from '@/features/journal/prompts';
import { usePeople } from '@/features/people/queries';
import { reachOutList } from '@/features/people/logic';
import { ReachOutRow } from '@/features/people/ReachOutRow';
import { LogInteractionSheet } from '@/features/people/LogInteraction';
import { gentleSummary, isBirthdayToday } from '@/features/today/summary';
import { GentleSupportCard, MedsTodayCard, WeightGoalCard } from '@/features/today/ExtraCards';
import { ActivitiesTodayCard } from '@/features/mind/components';
import { TodayWorkoutCard } from '@/pages/body/BodyPage';
import { useEnrollments } from '@/features/plans/queries';
import { planById } from '@/features/plans/content';
import { PlanStatus } from '@/features/plans/components';
import type { PersonRow } from '@/types/database';
import { Card } from '@/components/ui/Layout';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { ProgressBar } from '@/components/ui/Controls';
import { MOODS, moodLabel } from '@/components/ui/scales';
import { CardSkeleton, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/feedbackContext';
import { greetingFor, longDayLabel } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';

function CheckInCard() {
  const { today } = useToday();
  const q = useCheckIn(today);
  if (q.isPending) return <CardSkeleton lines={1} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const c = q.data;
  if (!c?.mood) {
    return (
      <Link to="/checkin" className="card flex items-center gap-4 bg-accent-soft transition-colors hover:bg-raised">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-strong text-accent-fg">
          <ClipboardCheck className="h-5 w-5" aria-hidden />
        </span>
        <span>
          <span className="font-semibold text-ink">Check in</span>
          <span className="block text-sm text-muted">Mood, energy, sleep and water. About 30 seconds.</span>
        </span>
      </Link>
    );
  }
  const Mood = MOODS.find((m) => m.value === c.mood)?.icon;
  return (
    <Card
      title="Check-in"
      icon={ClipboardCheck}
      tone="green"
      action={
        <Link to="/checkin" className="link text-sm">
          Edit
        </Link>
      }
    >
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1 font-medium">
          {Mood && <Mood className="h-5 w-5 text-accent-ink" aria-hidden />}
          {moodLabel(c.mood)}
        </span>
        {c.energy != null && <span className="text-muted">energy {c.energy}/5</span>}
        {c.stress != null && <span className="text-muted">stress {c.stress}/5</span>}
        {c.sleep_hours != null && <span className="text-muted">slept {Number(c.sleep_hours)}h</span>}
        <span className="text-muted">{c.water_glasses} water</span>
      </p>
    </Card>
  );
}

function HabitsCard() {
  const { today, weekStart } = useToday();
  const habits = useHabits();
  const completions = useCompletions();
  const byHabit = useCompletionMap(completions.data);
  const toggle = useToggleCompletion();
  const toast = useToast();
  if (habits.isPending || completions.isPending) return <CardSkeleton lines={3} />;
  if (habits.isError || completions.isError) {
    return <ErrorState error={habits.error ?? completions.error} onRetry={() => void habits.refetch()} />;
  }
  const due = habits.data
    .filter((h) => !h.archived_at && isDueToday(h, byHabit.get(h.id) ?? new Set(), today, weekStart))
    .sort((a, b) => TARGET_TIME_ORDER[a.target_time] - TARGET_TIME_ORDER[b.target_time] || a.sort_order - b.sort_order);
  const done = due.filter((h) => byHabit.get(h.id)?.has(today)).length;

  return (
    <Card
      title="Habits"
      icon={ListChecks}
      tone="green"
      action={
        <Link to="/habits" className="link text-sm">
          {due.length ? `${done} of ${due.length}` : 'All habits'}
        </Link>
      }
    >
      {habits.data.filter((h) => !h.archived_at).length === 0 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">No habits yet.</p>
          <Link to="/habits?ideas=1" className={buttonClasses('secondary', 'sm')}>
            Pick some habits
          </Link>
        </div>
      ) : due.length === 0 ? (
        <p className="text-sm text-muted">Nothing due today. Enjoy it.</p>
      ) : (
        <div className="space-y-2">
          {due.map((h) => {
            const set = byHabit.get(h.id) ?? new Set<string>();
            const isDone = set.has(today);
            return (
              <HabitCheck
                key={h.id}
                habit={h}
                done={isDone}
                streak={computeStreaks(h, set, today, weekStart)}
                detail={h.frequency === 'weekly' ? `${weekProgress(set, today, weekStart)} of ${h.times_per_week} this week` : frequencyLabel(h)}
                onToggle={() => toggle.mutate({ habitId: h.id, day: today, done: !isDone }, { onError: (e) => toast(errorMessage(e), 'error') })}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ProteinCard() {
  const { today } = useToday();
  const profile = useLoadedProfile();
  const meals = useMealsForDay(today);
  const [adding, setAdding] = useState(false);
  const target = profile.protein_target_g;
  if (target == null) return null;
  const total = dayTotals(meals.data ?? []).protein;
  return (
    <Card
      title="Protein"
      icon={Apple}
      tone="orange"
      action={
        <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Meal
        </Button>
      }
    >
      {meals.isError ? (
        <ErrorState error={meals.error} onRetry={() => void meals.refetch()} />
      ) : (
        <>
          <p className="mb-2 text-sm">
            <span className="font-semibold tabular-nums">{total} g</span> <span className="text-muted">of {target} g</span>
          </p>
          <ProgressBar value={total} max={target} label="Protein towards your target" />
        </>
      )}
      <QuickAddMeal open={adding} onClose={() => setAdding(false)} day={today} />
    </Card>
  );
}

function TasksCard({ tasks }: { tasks: ReturnType<typeof useTasks> }) {
  const { today } = useToday();
  if (tasks.isPending) return <CardSkeleton lines={2} />;
  if (tasks.isError) return <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />;
  const due = tasksForView(tasks.data, 'today', today);
  const overdue = tasksForView(tasks.data, 'overdue', today).length;
  return (
    <Card
      title="Tasks"
      icon={ListTodo}
      tone="blue"
      action={
        <Link to="/tasks" className="link text-sm">
          All tasks
        </Link>
      }
    >
      {due.length === 0 ? (
        <p className="text-sm text-muted">Nothing due today.</p>
      ) : (
        <ul className="divide-y divide-border">
          {due.slice(0, 5).map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </ul>
      )}
      {(due.length > 5 || overdue > 0) && (
        <p className="mt-2 text-sm text-muted">
          {due.length > 5 && <Link to="/tasks" className="link">{due.length - 5} more today</Link>}
          {due.length > 5 && overdue > 0 && ' · '}
          {overdue > 0 && (
            <Link to="/tasks?view=overdue" className="link">
              {overdue} waiting from before
            </Link>
          )}
        </p>
      )}
    </Card>
  );
}

function JournalCard() {
  const { today } = useToday();
  const entries = useEntriesOnDays(useMemo(() => [today], [today]));
  const prompt = promptForDay(today);
  return (
    <Card title="Journal" icon={BookOpen} tone="violet">
      <>
        {entries.isPending ? (
          <CardSkeleton lines={1} />
        ) : entries.isError ? (
          <ErrorState error={entries.error} onRetry={() => void entries.refetch()} />
        ) : entries.data.length > 0 ? (
          <div className="space-y-2">
            {entries.data.slice(0, 2).map((e) => (
              <Link key={e.id} to={`/journal/write/${e.id}`} className="block rounded-input bg-surface px-3 py-2 hover:bg-bg">
                <span className="text-xs text-muted">{entryTypeLabel(e.entry_type)}</span>
                <span className="block font-medium">{e.title || preview(e.body, 50) || 'Untitled'}</span>
                {e.title && <span className="line-clamp-2 block font-serif text-sm text-muted">{preview(e.body, 140)}</span>}
              </Link>
            ))}
            <Link to="/journal/write" className="link inline-flex items-center gap-1 text-sm">
              <Plus className="h-4 w-4" aria-hidden /> Another entry
            </Link>
          </div>
        ) : (
          <div>
            <p className="font-serif italic text-muted">{prompt.text}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to={`/journal/write?prompt=${encodeURIComponent(prompt.text)}`} className={buttonClasses('primary', 'sm')}>
                <PenLine className="h-4 w-4" aria-hidden />
                Write today's entry
              </Link>
              <Link to="/journal/write?type=evening" className={buttonClasses('ghost', 'sm')}>
                Evening review
              </Link>
            </div>
          </div>
        )}
      </>
    </Card>
  );
}

function PeopleCard() {
  const { today } = useToday();
  const people = usePeople();
  const [logging, setLogging] = useState<PersonRow | null>(null);
  if (people.isPending || people.isError) return null;
  const list = reachOutList(people.data, today).slice(0, 3);
  if (list.length === 0) return null;
  return (
    <Card
      title="Reach out"
      icon={Users}
      tone="rose"
      action={
        <Link to="/people" className="link text-sm">
          People
        </Link>
      }
    >
      <ul className="divide-y divide-border">
        {list.map((p) => (
          <ReachOutRow key={p.id} person={p} overdue={p.overdue} onLog={() => setLogging(p)} />
        ))}
      </ul>
      <LogInteractionSheet person={logging} onClose={() => setLogging(null)} />
    </Card>
  );
}

function PlansCard() {
  const enrollments = useEnrollments();
  const active = (enrollments.data ?? []).filter((e) => planById(e.plan_id));
  if (active.length === 0) return null;
  return (
    <Card
      title="Your plans"
      icon={Footprints}
      tone="orange"
      action={
        <Link to="/plans" className="link text-sm">
          Plans
        </Link>
      }
    >
      <div className="divide-y divide-border">
        {active.map((e) => (
          <div key={e.id} className="py-2 first:pt-0 last:pb-0">
            <PlanStatus plan={planById(e.plan_id)!} enrollment={e} compact />
          </div>
        ))}
      </div>
    </Card>
  );
}

function useSummary(tasks: ReturnType<typeof useTasks>) {
  const { today, weekStart } = useToday();
  const on = {
    checkin: useModuleEnabled('checkin'),
    habits: useModuleEnabled('habits'),
    workouts: useModuleEnabled('workouts'),
    tasks: useModuleEnabled('tasks'),
  };
  const checkIn = useCheckIn(today);
  const habits = useHabits();
  const completions = useCompletions();
  const byHabit = useCompletionMap(completions.data);
  const templates = useTemplates();
  const recent = useRecentWorkouts();
  const medsOn = useModuleEnabled('medications');
  const meds = useMedications();
  const doses = useDoses(today, today);

  const loading = checkIn.isPending || habits.isPending || completions.isPending || templates.isPending || recent.isPending || tasks.isPending;
  if (loading) return null;

  const due = (habits.data ?? []).filter((h) => !h.archived_at && isDueToday(h, byHabit.get(h.id) ?? new Set(), today, weekStart));
  const workoutDone = (recent.data ?? []).some((w) => w.day === today);
  const planned = plannedTemplate(templates.data ?? [], weekdayOf(today));

  const habitsDone = due.filter((h) => byHabit.get(h.id)?.has(today)).length;
  const tasksToday = on.tasks ? tasksForView(tasks.data ?? [], 'today', today).length : 0;
  const tasksDoneToday = on.tasks ? (tasks.data ?? []).filter((t) => t.status === 'done' && t.due_date === today).length : 0;
  const dueDoses = medsOn ? dosesOn((meds.data ?? []).filter((m) => !m.archived_at), today) : [];
  const takenKeys = new Set((doses.data ?? []).filter((d) => d.status === 'taken').map((d) => doseKey(d.medication_id, d.day, d.scheduled_time)));
  const dosesTaken = dueDoses.filter((d) => takenKeys.has(doseKey(d.medicationId, today, d.time))).length;

  // The day's to-dos: the check-in, habits due, medication doses, a planned workout and tasks due.
  const total = (on.checkin ? 1 : 0) + (on.habits ? due.length : 0) + dueDoses.length + (on.workouts && (planned || workoutDone) ? 1 : 0) + tasksToday + tasksDoneToday;
  const done = (on.checkin && checkIn.data?.mood ? 1 : 0) + (on.habits ? habitsDone : 0) + dosesTaken + (on.workouts && workoutDone ? 1 : 0) + tasksDoneToday;

  return {
    text: gentleSummary({
      checkedIn: on.checkin ? Boolean(checkIn.data?.mood) : null,
      habits: on.habits ? { due: due.length, done: habitsDone } : null,
      workout: on.workouts ? (workoutDone ? 'done' : planned ? 'planned' : 'rest') : null,
      tasksDue: on.tasks ? tasksToday : null,
    }),
    done,
    total,
  };
}

export function TodayPage() {
  const profile = useLoadedProfile();
  const { today, tz, now } = useToday();
  const tasks = useTasks();
  const summary = useSummary(tasks);
  const on = {
    checkin: useModuleEnabled('checkin'),
    habits: useModuleEnabled('habits'),
    workouts: useModuleEnabled('workouts'),
    food: useModuleEnabled('food'),
    tasks: useModuleEnabled('tasks'),
    journal: useModuleEnabled('journal'),
    people: useModuleEnabled('people'),
    medications: useModuleEnabled('medications'),
  };
  const name = profile.display_name?.trim();
  const birthday = isBirthdayToday(profile.birthday, today);

  const complete = Boolean(summary && summary.total > 0 && summary.done >= summary.total);
  const initial = (name || 'S').charAt(0).toUpperCase();

  const hero = (
    <section
      className="relative flex items-center gap-5 overflow-hidden rounded-card bg-accent-container p-5 text-accent-on-container"
      aria-live="polite"
      aria-label="Today so far"
    >
      <svg viewBox="0 0 200 200" className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 opacity-[0.12] sm:-right-10 sm:-top-12 sm:h-48 sm:w-48 sm:opacity-20 lg:opacity-[0.1] xl:opacity-20" aria-hidden>
        <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="18" />
        <circle cx="100" cy="100" r="40" fill="currentColor" opacity="0.4" />
      </svg>
      {summary && summary.total > 0 ? (
        <ProgressRing
          done={summary.done}
          total={summary.total}
          size={84}
          label={complete ? 'Everything done today' : `${summary.done} of ${summary.total} things done today`}
        />
      ) : (
        <span className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full bg-accent-strong/15 text-3xl" aria-hidden>
          🌿
        </span>
      )}
      <div className="relative min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider opacity-80">Today so far</p>
        {summary && summary.total > 0 && (
          <p className="display-num mt-1 text-2xl leading-tight">
            {complete ? 'All done. Nice work.' : `${summary.done} of ${summary.total} done`}
          </p>
        )}
        <p className="mt-1 text-[0.9375rem] font-medium leading-snug opacity-90">{summary?.text ?? 'Getting your day ready…'}</p>
      </div>
    </section>
  );

  return (
    <div className="space-y-4 lg:space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted">{longDayLabel(today)}</p>
          <h1 className="mt-1 text-[1.875rem] leading-tight lg:text-[2.25rem]">
            {birthday ? 'Happy birthday' : greetingFor(tz, now)}
            {name ? `, ${name}` : ''}
            {birthday ? ' 🎂' : ''}
          </h1>
        </div>
        {/* Phone top bar actions; the rail has these on computers. */}
        <div className="flex shrink-0 items-center gap-1 md:hidden">
          <button
            type="button"
            onClick={openPalette}
            aria-label="Search pages and actions"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink"
          >
            <Search className="h-5 w-5" aria-hidden />
          </button>
          <Link
            to="/settings"
            aria-label="Settings"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-strong text-sm font-bold text-accent-fg"
          >
            {initial}
          </Link>
        </div>
      </header>


      {/* Laptops: your day on the left, stats and reflection in a narrower column on the right. Phones: one column. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-4 lg:space-y-5">
          {hero}
          <GentleSupportCard />
          <div className="lg:hidden">
            <GlanceTiles />
          </div>
          {on.checkin && <CheckInCard />}
          {on.medications && <MedsTodayCard />}
          {on.habits && <HabitsCard />}
          {on.workouts && <TodayWorkoutCard />}
          {on.workouts && <PlansCard />}
          {on.tasks && <TasksCard tasks={tasks} />}
          <ActivitiesTodayCard />
        </div>
        <aside className="min-w-0 space-y-4 lg:space-y-5" aria-label="At a glance">
          <div className="hidden lg:block">
            <GlanceTiles />
          </div>
          <WeightGoalCard />
          {on.food && <ProteinCard />}
          {on.journal && <JournalCard />}
          {on.people && <PeopleCard />}
        </aside>
      </div>
    </div>
  );
}
