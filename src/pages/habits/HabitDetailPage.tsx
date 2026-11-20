import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format, addMonths } from 'date-fns';
import { Archive, ArchiveRestore, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import {
  useArchiveHabit,
  useCompletionMap,
  useCompletions,
  useDeleteHabit,
  useHabits,
  useToggleCompletion,
} from '@/features/habits/queries';
import { canToggle, computeStreaks, consistency, monthStatuses, weekStartOf, type DayStatus } from '@/features/habits/streaks';
import { frequencyLabel, habitColor, habitIcon } from '@/features/habits/display';
import { useToday } from '@/features/profile/useToday';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { StatTile, IconButton } from '@/components/ui/Layout';
import { CardSkeleton, ErrorState } from '@/components/ui/States';
import { useConfirm, useToast } from '@/components/ui/feedbackContext';
import { addDaysISO, parseISODate } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { cn } from '@/utils/cn';

const STATUS_TEXT: Record<DayStatus, string> = {
  done: 'done',
  missed: 'not done',
  off: 'not scheduled',
  pending: 'today, not done yet',
  future: 'upcoming',
  before: 'before this habit started',
};

export function HabitDetailPage() {
  const { id } = useParams();
  const { today, weekStart } = useToday();
  const habits = useHabits();
  const completions = useCompletions();
  const byHabit = useCompletionMap(completions.data);
  const toggle = useToggleCompletion();
  const archive = useArchiveHabit();
  const del = useDeleteHabit();
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const [month, setMonth] = useState(today.slice(0, 7));

  if (habits.isPending || completions.isPending) return <CardSkeleton lines={6} />;
  if (habits.isError || completions.isError) {
    return <ErrorState error={habits.error ?? completions.error} onRetry={() => void habits.refetch()} />;
  }
  const habit = habits.data.find((h) => h.id === id);
  if (!habit) return <ErrorState error="This habit doesn't exist any more." />;

  const done = byHabit.get(habit.id) ?? new Set<string>();
  const streak = computeStreaks(habit, done, today, weekStart);
  const ws = weekStartOf(today, weekStart);
  const week = consistency(habit, done, ws, addDaysISO(ws, 6), today, weekStart);
  const month30 = consistency(habit, done, addDaysISO(today, -29), today, today, weekStart);
  const grid = monthStatuses(habit, done, month, today);
  const Icon = habitIcon(habit.icon);
  const leading = (parseISODate(`${month}-01`).getDay() - weekStart + 7) % 7;
  const unit = streak.unit === 'week' ? 'weeks' : 'days';
  const shiftMonth = (n: number) => setMonth(format(addMonths(parseISODate(`${month}-01`), n), 'yyyy-MM'));

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete “${habit.name}” for good?`,
      body: 'This removes the habit and its whole history. Archiving keeps the history instead.',
      confirmLabel: 'Delete permanently',
      danger: true,
    });
    if (!ok) return;
    del.mutate(habit.id, {
      onSuccess: () => {
        toast('Habit deleted');
        navigate('/habits');
      },
      onError: (e) => toast(errorMessage(e), 'error'),
    });
  };

  return (
    <>
      <PageHeader
        title={habit.name}
        description={`${frequencyLabel(habit)}${habit.archived_at ? ' · archived' : ''}`}
        actions={
          <Link to={`/habits/${habit.id}/edit`} className={buttonClasses('secondary', 'sm')}>
            <Pencil className="h-4 w-4" aria-hidden />
            Edit
          </Link>
        }
      />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Current streak" value={streak.current} hint={unit} />
          <StatTile label="Best streak" value={streak.best} hint={unit} />
          <StatTile label="This week" value={week.percent == null ? '–' : `${week.percent}%`} hint={`${week.done} of ${week.due}`} />
          <StatTile label="Last 30 days" value={month30.percent == null ? '–' : `${month30.percent}%`} hint={`${month30.done} of ${month30.due}`} />
        </div>

        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base">
              <Icon className="h-5 w-5" style={{ color: habitColor(habit.color) }} aria-hidden />
              {format(parseISODate(`${month}-01`), 'MMMM yyyy')}
            </h2>
            <div className="flex">
              <IconButton label="Previous month" onClick={() => shiftMonth(-1)}>
                <ChevronLeft className="h-5 w-5" />
              </IconButton>
              <IconButton label="Next month" onClick={() => shiftMonth(1)} disabled={month >= today.slice(0, 7)}>
                <ChevronRight className="h-5 w-5" />
              </IconButton>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted" aria-hidden>
            {Array.from({ length: 7 }, (_, i) => format(parseISODate(addDaysISO('2026-01-04', i + weekStart)), 'EEEEE')).map(
              (d, i) => (
                <span key={i}>{d}</span>
              ),
            )}
          </div>
          <div className="mt-1.5 grid grid-cols-7 gap-1.5">
            {Array.from({ length: leading }, (_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {grid.map(({ day, status }) => {
              const toggleable = canToggle(day, today);
              const label = `${format(parseISODate(day), 'EEE d MMM')}: ${STATUS_TEXT[status]}`;
              return (
                <button
                  key={day}
                  type="button"
                  aria-label={toggleable ? `${label}. Tap to change.` : label}
                  title={label}
                  disabled={!toggleable}
                  onClick={() =>
                    toggle.mutate(
                      { habitId: habit.id, day, done: status !== 'done' },
                      { onError: (e) => toast(errorMessage(e), 'error') },
                    )
                  }
                  className={cn(
                    'flex aspect-square items-center justify-center rounded-[6px] text-sm tabular-nums',
                    status === 'done' && 'text-ink',
                    status === 'missed' && 'border border-dashed border-border text-muted',
                    status === 'off' && 'text-muted/60',
                    status === 'pending' && 'border border-ink/40',
                    (status === 'future' || status === 'before') && 'text-muted/40',
                    toggleable && 'hover:bg-panel',
                  )}
                  style={status === 'done' ? { backgroundColor: habitColor(habit.color, 0.35) } : undefined}
                >
                  {Number(day.slice(8))}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">You can fill in or undo any of the last 14 days.</p>
        </section>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            loading={archive.isPending}
            onClick={() =>
              archive.mutate(
                { id: habit.id, archived: !habit.archived_at },
                { onSuccess: () => toast(habit.archived_at ? 'Habit restored' : 'Habit archived. Its history is kept.') },
              )
            }
          >
            {habit.archived_at ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}
            {habit.archived_at ? 'Restore habit' : 'Archive'}
          </Button>
          <Button variant="ghost" className="text-danger" onClick={() => void onDelete()}>
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete permanently
          </Button>
        </div>
      </div>
    </>
  );
}
