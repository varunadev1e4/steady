import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { useHabits, useSaveHabit, type HabitInput } from '@/features/habits/queries';
import { HABIT_COLORS, HABIT_ICONS, habitColor } from '@/features/habits/display';
import { useToday } from '@/features/profile/useToday';
import type { HabitRow } from '@/types/database';
import { PageHeader } from '@/components/ui/PageHeader';
import { SelectField, TextField } from '@/components/ui/Field';
import { Segmented, Stepper } from '@/components/ui/Controls';
import { Button } from '@/components/ui/Button';
import { CardSkeleton, ErrorState, FormMessage } from '@/components/ui/States';
import { useToast } from '@/components/ui/feedbackContext';
import { errorMessage } from '@/utils/errors';
import { cn } from '@/utils/cn';

const schema = z
  .object({
    name: z.string().trim().min(1, 'Give the habit a name').max(60, 'Keep it under 60 characters'),
    icon: z.string(),
    color: z.enum(['sage', 'clay', 'amber', 'sky', 'plum', 'stone']),
    frequency: z.enum(['daily', 'weekdays', 'weekly']),
    weekdays: z.array(z.number().int().min(0).max(6)),
    times_per_week: z.number().int().min(1).max(7).nullable(),
    target_time: z.enum(['any', 'morning', 'afternoon', 'evening']),
    grace_enabled: z.boolean(),
  })
  .refine((v) => v.frequency !== 'weekdays' || v.weekdays.length > 0, {
    path: ['weekdays'],
    message: 'Choose at least one day',
  });

const DAYS = [
  { v: 1, l: 'Mon' },
  { v: 2, l: 'Tue' },
  { v: 3, l: 'Wed' },
  { v: 4, l: 'Thu' },
  { v: 5, l: 'Fri' },
  { v: 6, l: 'Sat' },
  { v: 0, l: 'Sun' },
];

function HabitForm({ habit }: { habit?: HabitRow }) {
  const { today } = useToday();
  const save = useSaveHabit();
  const navigate = useNavigate();
  const toast = useToast();
  const [v, setV] = useState<HabitInput>({
    name: habit?.name ?? '',
    icon: habit?.icon ?? 'check',
    color: habit?.color ?? 'sage',
    frequency: habit?.frequency ?? 'daily',
    weekdays: habit?.weekdays ?? [1, 2, 3, 4, 5],
    times_per_week: habit?.times_per_week ?? 3,
    target_time: habit?.target_time ?? 'any',
    grace_enabled: habit?.grace_enabled ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof HabitInput>(k: K, val: HabitInput[K]) => setV((s) => ({ ...s, [k]: val }));

  const submit = () => {
    const parsed = schema.safeParse(v);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    const input: HabitInput = {
      ...parsed.data,
      weekdays: parsed.data.frequency === 'weekdays' ? parsed.data.weekdays : [],
      times_per_week: parsed.data.frequency === 'weekly' ? parsed.data.times_per_week : null,
      ...(habit ? {} : { start_date: today }),
    };
    save.mutate(
      { id: habit?.id, input },
      {
        onSuccess: (row) => {
          toast(habit ? 'Habit updated' : 'Habit created');
          navigate(habit ? `/habits/${row.id}` : '/habits');
        },
      },
    );
  };

  return (
    <form
      className="card space-y-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <TextField
        label="Name"
        value={v.name}
        onChange={(e) => set('name', e.target.value)}
        maxLength={60}
        placeholder="e.g. Walk 20 minutes"
        error={errors.name}
        autoFocus={!habit}
      />

      <fieldset>
        <legend className="label">Icon</legend>
        <div className="grid grid-cols-8 gap-2">
          {Object.entries(HABIT_ICONS).map(([key, Icon]) => (
            <button
              key={key}
              type="button"
              aria-label={key.replace('-', ' ')}
              aria-pressed={v.icon === key}
              onClick={() => set('icon', key)}
              className={cn(
                'flex h-10 items-center justify-center rounded-input border transition-colors',
                v.icon === key ? 'border-accent bg-accent-soft text-accent-ink' : 'border-border bg-surface text-muted hover:text-ink',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Colour</legend>
        <div className="flex gap-3">
          {HABIT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={v.color === c}
              onClick={() => set('color', c)}
              className={cn('h-9 w-9 rounded-full ring-offset-2 ring-offset-panel', v.color === c && 'ring-2 ring-ink')}
              style={{ backgroundColor: habitColor(c) }}
            />
          ))}
        </div>
      </fieldset>

      <div>
        <p className="label">How often</p>
        <Segmented
          label="How often"
          value={v.frequency}
          onChange={(f) => set('frequency', f)}
          options={[
            { value: 'daily', label: 'Every day' },
            { value: 'weekdays', label: 'Some days' },
            { value: 'weekly', label: 'Times a week' },
          ]}
        />
        {v.frequency === 'weekdays' && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Days">
              {DAYS.map((d) => {
                const on = v.weekdays.includes(d.v);
                return (
                  <button
                    key={d.v}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set('weekdays', on ? v.weekdays.filter((x) => x !== d.v) : [...v.weekdays, d.v])
                    }
                    className={cn(
                      'h-10 min-w-12 rounded-input border px-2 text-sm font-medium',
                      on ? 'border-accent bg-accent-soft text-accent-ink' : 'border-border bg-surface text-muted',
                    )}
                  >
                    {d.l}
                  </button>
                );
              })}
            </div>
            {errors.weekdays && <p className="mt-1.5 text-sm text-danger" role="alert">{errors.weekdays}</p>}
          </div>
        )}
        {v.frequency === 'weekly' && (
          <div className="mt-3">
            <Stepper
              label="Times per week"
              value={v.times_per_week ?? 3}
              onChange={(n) => set('times_per_week', n)}
              min={1}
              max={7}
              suffix="× a week"
            />
          </div>
        )}
      </div>

      <SelectField
        label="Best time of day"
        value={v.target_time}
        onChange={(e) => set('target_time', e.target.value as HabitInput['target_time'])}
        options={[
          { value: 'any', label: 'Any time' },
          { value: 'morning', label: 'Morning' },
          { value: 'afternoon', label: 'Afternoon' },
          { value: 'evening', label: 'Evening' },
        ]}
        hint="Today lists habits in this order."
      />

      <label className="flex flex-row-reverse items-center justify-between gap-4">
        <input
          type="checkbox"
          role="switch"
          className="switch"
          checked={v.grace_enabled}
          onChange={(e) => set('grace_enabled', e.target.checked)}
        />
        <span>
          <span className="font-medium">Grace day</span>
          <span className="block text-sm text-muted">
            One missed day won't end your streak (at most once a week; once every 4 weeks for weekly habits).
          </span>
        </span>
      </label>

      {save.isError && <FormMessage tone="error">{errorMessage(save.error)}</FormMessage>}
      <div className="flex gap-2">
        <Button type="submit" loading={save.isPending}>
          {habit ? 'Save changes' : 'Create habit'}
        </Button>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function HabitFormPage() {
  const { id } = useParams();
  const habits = useHabits();
  if (!id) {
    return (
      <>
        <PageHeader title="New habit" />
        <HabitForm />
      </>
    );
  }
  const habit = habits.data?.find((h) => h.id === id);
  return (
    <>
      <PageHeader title="Edit habit" />
      {habits.isPending ? (
        <CardSkeleton lines={6} />
      ) : habits.isError ? (
        <ErrorState error={habits.error} onRetry={() => void habits.refetch()} />
      ) : !habit ? (
        <ErrorState error="This habit doesn't exist any more." />
      ) : (
        <HabitForm habit={habit} />
      )}
    </>
  );
}
