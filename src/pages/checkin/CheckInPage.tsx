import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { History } from 'lucide-react';
import { useCheckIn, useSaveCheckIn, type CheckInValues } from '@/features/checkin/queries';
import { useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { RatingPicker, Stepper } from '@/components/ui/Controls';
import { TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { CardSkeleton, ErrorState, FormMessage } from '@/components/ui/States';
import { useToast } from '@/components/ui/feedbackContext';
import { errorMessage } from '@/utils/errors';
import { formatISODate, longDayLabel } from '@/utils/dates';
import { hoursBetween } from '@/features/sleep/logic';

const schema = z.object({
  mood: z.number().int().min(1).max(5, 'Pick a mood').nullable(),
  energy: z.number().int().min(1).max(5).nullable(),
  stress: z.number().int().min(1).max(5).nullable(),
  sleep_hours: z.number().min(0).max(24, 'Sleep must be 24 hours or less').nullable(),
  sleep_quality: z.number().int().min(1).max(5).nullable(),
  water_glasses: z.number().int().min(0).max(40),
  note: z.string().max(280, 'Keep the note under 280 characters').nullable(),
  bedtime: z.string().nullable().optional(),
  wake_time: z.string().nullable().optional(),
});

const EMPTY: CheckInValues = {
  mood: null,
  energy: null,
  stress: null,
  sleep_hours: null,
  sleep_quality: null,
  water_glasses: 0,
  note: null,
  bedtime: null,
  wake_time: null,
};

export function CheckInPage() {
  const { today } = useToday();
  const profile = useLoadedProfile();
  const [params] = useSearchParams();
  const requested = params.get('day');
  const day = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today ? requested : today;
  const isToday = day === today;

  const existing = useCheckIn(day);
  const save = useSaveCheckIn();
  const navigate = useNavigate();
  const toast = useToast();
  const [values, setValues] = useState<CheckInValues>(EMPTY);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (existing.data !== undefined) {
      const d = existing.data;
      setValues(
        d
          ? {
              mood: d.mood,
              energy: d.energy,
              stress: d.stress,
              sleep_hours: d.sleep_hours == null ? null : Number(d.sleep_hours),
              sleep_quality: d.sleep_quality,
              water_glasses: d.water_glasses,
              note: d.note,
              bedtime: d.bedtime ? d.bedtime.slice(0, 5) : null,
              wake_time: d.wake_time ? d.wake_time.slice(0, 5) : null,
            }
          : EMPTY,
      );
    }
  }, [existing.data]);

  const set = <K extends keyof CheckInValues>(k: K, v: CheckInValues[K]) => setValues((s) => ({ ...s, [k]: v }));

  const submit = () => {
    const parsed = schema.safeParse({ ...values, note: values.note?.trim() || null });
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => i.message));
      return;
    }
    if (parsed.data.mood == null) {
      setErrors(['Pick a mood to finish your check-in.']);
      return;
    }
    setErrors([]);
    save.mutate(
      { day, values: parsed.data },
      {
        onSuccess: () => {
          toast(isToday ? 'Check-in saved' : `Check-in for ${formatISODate(day, profile.date_format)} saved`);
          navigate(isToday ? '/' : '/checkin/history');
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        title={isToday ? 'Daily check-in' : 'Edit check-in'}
        description={longDayLabel(day)}
        actions={
          <Link to="/checkin/history" className={buttonClasses('ghost', 'sm')}>
            <History className="h-4 w-4" aria-hidden />
            History
          </Link>
        }
      />
      {existing.isPending ? (
        <CardSkeleton lines={6} />
      ) : existing.isError ? (
        <ErrorState error={existing.error} onRetry={() => void existing.refetch()} />
      ) : (
        <form
          className="card space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          noValidate
        >
          <RatingPicker label="Mood" kind="mood" value={values.mood} onChange={(v) => set('mood', v)} />
          <RatingPicker
            label="Energy"
            value={values.energy}
            onChange={(v) => set('energy', v)}
            lowLabel="Drained"
            highLabel="Full of energy"
          />
          <RatingPicker
            label="Stress"
            value={values.stress}
            onChange={(v) => set('stress', v)}
            lowLabel="Calm"
            highLabel="Very stressed"
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="label">Hours slept</p>
              <Stepper
                label="Hours slept"
                value={values.sleep_hours ?? 7}
                onChange={(v) => set('sleep_hours', v)}
                min={0}
                max={16}
                step={0.5}
                suffix="h"
              />
              {values.sleep_hours == null && <p className="mt-1 text-xs text-muted">Not set yet. Tap + or − to log it.</p>}
            </div>
            <div>
              <p className="label">Water</p>
              <Stepper
                label="Glasses of water"
                value={values.water_glasses}
                onChange={(v) => set('water_glasses', v)}
                max={40}
                suffix={values.water_glasses === 1 ? 'glass' : 'glasses'}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Went to bed (optional)"
              type="time"
              value={values.bedtime ?? ''}
              onChange={(e) => {
                const bedtime = e.target.value || null;
                setValues((s) => ({ ...s, bedtime, sleep_hours: bedtime && s.wake_time ? hoursBetween(bedtime, s.wake_time) : s.sleep_hours }));
              }}
            />
            <TextField
              label="Woke up (optional)"
              type="time"
              value={values.wake_time ?? ''}
              onChange={(e) => {
                const wake = e.target.value || null;
                setValues((s) => ({ ...s, wake_time: wake, sleep_hours: wake && s.bedtime ? hoursBetween(s.bedtime, wake) : s.sleep_hours }));
              }}
            />
          </div>
          <RatingPicker
            label="Sleep quality"
            value={values.sleep_quality}
            onChange={(v) => set('sleep_quality', v)}
            lowLabel="Restless"
            highLabel="Deep"
          />
          <TextField
            label="A line about today (optional)"
            maxLength={280}
            value={values.note ?? ''}
            onChange={(e) => set('note', e.target.value)}
          />
          {errors.length > 0 && <FormMessage tone="error">{errors[0]}</FormMessage>}
          {save.isError && <FormMessage tone="error">{errorMessage(save.error)}</FormMessage>}
          <Button type="submit" block size="lg" loading={save.isPending}>
            {existing.data?.mood ? 'Update check-in' : 'Save check-in'}
          </Button>
          <p className="text-center text-xs text-muted">
            This is for your own reflection. It is not a medical or diagnostic tool.
          </p>
        </form>
      )}
    </>
  );
}
