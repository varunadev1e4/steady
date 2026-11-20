import { Check, Plus, Sparkles } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/States';
import { useToast } from '@/components/ui/feedbackContext';
import { useToday } from '@/features/profile/useToday';
import { errorMessage } from '@/utils/errors';
import { frequencyLabel, habitColor, habitIcon } from './display';
import { useAddHabits, useHabits, type HabitInput } from './queries';
import { HABIT_IDEAS, IDEA_GROUPS, STARTER_SET, ideaByKey, sameHabitName, type HabitIdea } from './suggestions';

const toInput = (i: HabitIdea, start: string): HabitInput => ({
  name: i.name,
  icon: i.icon,
  color: i.color,
  frequency: i.frequency,
  weekdays: [],
  times_per_week: i.frequency === 'weekly' ? (i.times_per_week ?? 1) : null,
  target_time: i.target_time,
  grace_enabled: i.grace_enabled,
  start_date: start,
});

export function HabitIdeasSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Habit ideas" description="Small, specific habits with good evidence behind them. Add only what you want.">
      <Ideas />
    </Sheet>
  );
}

function Ideas() {
  const { today } = useToday();
  const habits = useHabits();
  const add = useAddHabits();
  const toast = useToast();
  const existing = (habits.data ?? []).filter((h) => !h.archived_at);
  const has = (i: HabitIdea) => existing.some((h) => sameHabitName(h.name, i.name));
  const starterMissing = STARTER_SET.map((k) => ideaByKey(k)!).filter((i) => !has(i));

  const addIdeas = (ideas: HabitIdea[]) =>
    add.mutate(ideas.map((i) => toInput(i, today)), {
      onSuccess: (rows) => toast(rows.length === 1 ? `Added “${rows[0].name}”` : `Added ${rows.length} habits`),
      onError: (e) => toast(errorMessage(e), 'error'),
    });

  return (
    <div className="space-y-5">
      <section className="rounded-card border border-accent/40 bg-accent-soft/60 p-3">
        <p className="flex items-center gap-1.5 font-medium">
          <Sparkles className="h-4 w-4 text-accent-ink" aria-hidden />
          Starter set
        </p>
        <p className="mt-0.5 text-sm text-muted">
          One habit each for moving, eating, sleep and reflection:{' '}
          {STARTER_SET.map((k) => ideaByKey(k)!.name.toLowerCase()).join('; ')}.
        </p>
        <p className="mt-1 text-xs text-muted">
          New habits take weeks to feel automatic, so it's fine to start with two and add more later. Each one has a grace day turned on.
        </p>
        <Button
          size="sm"
          className="mt-2"
          loading={add.isPending}
          disabled={starterMissing.length === 0 || habits.isPending}
          onClick={() => addIdeas(starterMissing)}
        >
          {starterMissing.length === 0 ? 'Starter set added' : starterMissing.length === STARTER_SET.length ? 'Add all 5' : `Add the other ${starterMissing.length}`}
        </Button>
      </section>

      {IDEA_GROUPS.map((g) => (
        <section key={g.key} aria-labelledby={`ideas-${g.key}`}>
          <h3 id={`ideas-${g.key}`} className="mb-1.5 text-sm font-semibold text-muted">
            {g.label}
          </h3>
          <ul className="space-y-2">
            {HABIT_IDEAS.filter((i) => i.group === g.key).map((i) => {
              const Icon = habitIcon(i.icon);
              const added = has(i);
              return (
                <li key={i.key} className="flex items-start gap-3 rounded-input border border-border bg-surface p-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: habitColor(i.color, 0.18), color: habitColor(i.color) }}
                    aria-hidden
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{i.name}</p>
                    <p className="text-xs text-muted">{frequencyLabel({ frequency: i.frequency, weekdays: [], times_per_week: i.times_per_week ?? null })}</p>
                    <p className="mt-1 text-sm text-muted">{i.why}</p>
                  </div>
                  {added ? (
                    <span className="inline-flex shrink-0 items-center gap-1 pt-1 text-sm text-accent-ink">
                      <Check className="h-4 w-4" aria-hidden /> Added
                    </span>
                  ) : (
                    <Button size="sm" variant="secondary" disabled={add.isPending || habits.isPending} onClick={() => addIdeas([i])} aria-label={`Add ${i.name}`}>
                      <Plus className="h-4 w-4" aria-hidden />
                      Add
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {add.isError && <FormMessage tone="error">{errorMessage(add.error)}</FormMessage>}
      <p className="text-xs text-muted">You can edit, archive or delete any habit afterwards.</p>
    </div>
  );
}
