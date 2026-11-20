import { Check, Repeat, RotateCcw } from 'lucide-react';
import { SwipeRow } from '@/components/ui/SwipeRow';
import { haptic } from '@/utils/haptics';
import type { TaskRow as Task } from '@/types/database';
import { useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import { useToast } from '@/components/ui/feedbackContext';
import { addDaysISO, formatISODate } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { cn } from '@/utils/cn';
import { useSetTaskDone } from './queries';

export function TaskRow({ task, onOpen }: { task: Task; onOpen?: () => void }) {
  const { today } = useToday();
  const profile = useLoadedProfile();
  const setDone = useSetTaskDone();
  const toast = useToast();
  const done = task.status === 'done';
  const due =
    task.due_date == null
      ? null
      : task.due_date === today
        ? 'Today'
        : task.due_date === addDaysISO(today, 1)
          ? 'Tomorrow'
          : formatISODate(task.due_date, profile.date_format);
  const overdue = !done && task.due_date != null && task.due_date < today;

  const toggle = () =>
    setDone.mutate(
      { id: task.id, done: !done, today },
      {
        onSuccess: () => !done && task.repeat !== 'none' && toast('Done. The next one is scheduled.'),
        onError: (e) => toast(errorMessage(e), 'error'),
      },
    );

  return (
    <li>
      <SwipeRow onSwipe={toggle} label={done ? 'Reopen' : 'Done'} icon={done ? RotateCcw : Check} disabled={setDone.isPending}>
        <div className="flex min-h-14 items-center gap-3 py-1.5">
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={`${done ? 'Reopen' : 'Complete'} “${task.title}”`}
            onClick={() => {
              haptic(done ? 'tap' : 'success');
              toggle();
            }}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
              done ? 'border-accent bg-accent text-accent-fg' : task.priority === 'high' ? 'border-clay' : 'border-border',
            )}
          >
            {done && <Check key="on" className="h-4 w-4 animate-pop" strokeWidth={3} aria-hidden />}
          </button>
          <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen} disabled={!onOpen}>
            <span className={cn('block truncate', done && 'text-muted line-through')}>{task.title}</span>
            {(due || task.priority !== 'medium' || task.repeat !== 'none' || task.tags.length > 0) && (
              <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                {due && (
                  <span className={cn(overdue && 'text-amber-ink')}>
                    {due}
                    {task.due_time ? ` ${task.due_time.slice(0, 5)}` : ''}
                  </span>
                )}
                {task.priority === 'high' && <span className="text-clay-ink">High priority</span>}
                {task.priority === 'low' && <span>Low priority</span>}
                {task.repeat !== 'none' && (
                  <span className="inline-flex items-center gap-0.5">
                    <Repeat className="h-3 w-3" aria-hidden />
                    {task.repeat}
                  </span>
                )}
                {task.tags.map((t) => (
                  <span key={t}>#{t}</span>
                ))}
              </span>
            )}
          </button>
        </div>
      </SwipeRow>
    </li>
  );
}
