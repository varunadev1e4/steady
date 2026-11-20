import { Check, Flame } from 'lucide-react';
import type { HabitRow } from '@/types/database';
import { cn } from '@/utils/cn';
import { haptic } from '@/utils/haptics';
import { habitColor, habitIcon } from './display';

/** The large, one-tap habit checkbox used on Today and the Habits page. */
export function HabitCheck({
  habit,
  done,
  onToggle,
  detail,
  streak,
}: {
  habit: HabitRow;
  done: boolean;
  onToggle: () => void;
  detail?: string;
  streak?: { current: number; unit: 'day' | 'week' };
}) {
  const Icon = habitIcon(habit.icon);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      onClick={() => {
        haptic(done ? 'tap' : 'success');
        onToggle();
      }}
      className={cn(
        'flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors active:scale-[0.99]',
        done ? 'bg-accent-soft' : 'bg-surface hover:bg-raised',
      )}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: habitColor(habit.color, 0.18), color: habitColor(habit.color) }}
        aria-hidden
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate font-medium', done && 'text-muted line-through decoration-muted/60')}>
          {habit.name}
        </span>
        {(detail || (streak && streak.current > 0)) && (
          <span className="flex items-center gap-2 text-xs text-muted">
            {detail}
            {streak && streak.current > 0 && (
              <span className="inline-flex items-center gap-0.5 text-clay-ink">
                <Flame className="h-3.5 w-3.5" aria-hidden />
                {streak.current} {streak.unit === 'week' ? 'wk' : 'd'}
              </span>
            )}
          </span>
        )}
      </span>
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300',
          done ? 'border-accent-strong bg-accent-strong text-accent-fg' : 'border-outline',
        )}
        aria-hidden
      >
        {done && <Check key="on" className="h-5 w-5 animate-pop" strokeWidth={3} />}
      </span>
    </button>
  );
}
