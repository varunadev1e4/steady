import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Archive, Lightbulb, ListChecks, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useCompletionMap, useCompletions, useHabits, useToggleCompletion } from '@/features/habits/queries';
import {
  backfillWindow,
  computeStreaks,
  consistency,
  isDueToday,
  weekProgress,
  weekStartOf,
} from '@/features/habits/streaks';
import { HabitCheck } from '@/features/habits/HabitCheck';
import { HabitIdeasSheet } from '@/features/habits/HabitIdeas';
import { Button } from '@/components/ui/Button';
import { frequencyLabel, habitColor, TARGET_TIME_ORDER } from '@/features/habits/display';
import { useToday } from '@/features/profile/useToday';
import { PageHeader } from '@/components/ui/PageHeader';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/feedbackContext';
import { addDaysISO, parseISODate } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { cn } from '@/utils/cn';

export function HabitsPage() {
  const { today, weekStart } = useToday();
  const habits = useHabits();
  const completions = useCompletions();
  const byHabit = useCompletionMap(completions.data);
  const toggle = useToggleCompletion();
  const toast = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const [params, setParams] = useSearchParams();
  const ideasOpen = params.get('ideas') === '1';
  const setIdeasOpen = (open: boolean) => setParams(open ? { ideas: '1' } : {}, { replace: true });

  const active = useMemo(
    () =>
      (habits.data ?? [])
        .filter((h) => !h.archived_at)
        .sort((a, b) => TARGET_TIME_ORDER[a.target_time] - TARGET_TIME_ORDER[b.target_time] || a.sort_order - b.sort_order),
    [habits.data],
  );
  const archived = (habits.data ?? []).filter((h) => h.archived_at);
  const window14 = backfillWindow(today);

  const onToggle = (habitId: string, day: string, done: boolean) =>
    toggle.mutate({ habitId, day, done }, { onError: (e) => toast(errorMessage(e), 'error') });

  const pending = habits.isPending || completions.isPending;
  const error = habits.error ?? completions.error;

  return (
    <>
      <PageHeader
        title="Habits"
        description="Small things, done often."
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => setIdeasOpen(true)}>
              <Lightbulb className="h-4 w-4" aria-hidden />
              Ideas
            </Button>
            <Link to="/habits/new" className={buttonClasses('primary', 'sm')}>
              <Plus className="h-4 w-4" aria-hidden />
              New
            </Link>
          </>
        }
      />
      <HabitIdeasSheet open={ideasOpen} onClose={() => setIdeasOpen(false)} />
      {pending ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            void habits.refetch();
            void completions.refetch();
          }}
        />
      ) : active.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No habits yet"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setIdeasOpen(true)}>
                <Lightbulb className="h-4 w-4" aria-hidden />
                Choose from habit ideas
              </Button>
              <Link to="/habits/new" className={buttonClasses('secondary')}>
                Create your own
              </Link>
            </div>
          }
        >
          Start with one or two small things you'd like to do most days. The ideas list has a ready-made starter set.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {active.map((h) => {
            const done = byHabit.get(h.id) ?? new Set<string>();
            const streak = computeStreaks(h, done, today, weekStart);
            const ws = weekStartOf(today, weekStart);
            const week = consistency(h, done, ws, addDaysISO(ws, 6), today, weekStart);
            const dueToday = isDueToday(h, done, today, weekStart);
            const detail =
              h.frequency === 'weekly'
                ? `${weekProgress(done, today, weekStart)} of ${h.times_per_week} this week`
                : frequencyLabel(h);
            return (
              <section key={h.id} className="card space-y-3" aria-label={h.name}>
                <HabitCheck
                  habit={h}
                  done={done.has(today)}
                  onToggle={() => onToggle(h.id, today, !done.has(today))}
                  detail={dueToday ? detail : `${detail} · not due today`}
                  streak={streak}
                />
                <div>
                  <p className="mb-1.5 text-xs text-muted">Last 14 days (tap to fill in a missed day)</p>
                  <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-14">
                    {window14.map((d) => {
                      const isDone = done.has(d);
                      const label = `${format(parseISODate(d), 'EEE d MMM')}: ${isDone ? 'done' : 'not done'}`;
                      return (
                        <button
                          key={d}
                          type="button"
                          role="checkbox"
                          aria-checked={isDone}
                          aria-label={label}
                          title={label}
                          onClick={() => onToggle(h.id, d, !isDone)}
                          className={cn(
                            'flex h-9 flex-col items-center justify-center rounded-[6px] border text-[0.6875rem] leading-tight transition-colors',
                            isDone ? 'text-ink' : 'border-border bg-surface text-muted hover:bg-panel',
                            d === today && 'ring-1 ring-ink/40',
                          )}
                          style={isDone ? { backgroundColor: habitColor(h.color, 0.3), borderColor: habitColor(h.color) } : undefined}
                        >
                          <span>{format(parseISODate(d), 'EEEEE')}</span>
                          <span className="font-medium">{format(parseISODate(d), 'd')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-muted">
                  <span>
                    This week {week.percent == null ? '–' : `${week.percent}%`} · Best {streak.best}{' '}
                    {streak.unit === 'week' ? 'weeks' : 'days'}
                  </span>
                  <Link to={`/habits/${h.id}`} className="link">
                    Details
                  </Link>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-6">
          <button type="button" className="link inline-flex items-center gap-1.5 text-sm" onClick={() => setShowArchived((s) => !s)}>
            <Archive className="h-4 w-4" aria-hidden />
            {showArchived ? 'Hide' : 'Show'} archived habits ({archived.length})
          </button>
          {showArchived && (
            <ul className="card mt-3 divide-y divide-border py-1">
              {archived.map((h) => (
                <li key={h.id}>
                  <Link to={`/habits/${h.id}`} className="flex min-h-12 items-center justify-between hover:text-accent-ink">
                    {h.name}
                    <span className="text-sm text-muted">Archived</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
