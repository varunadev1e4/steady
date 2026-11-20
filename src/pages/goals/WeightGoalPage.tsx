import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ArrowLeft, CalendarPlus, Cake, Check, Circle, Scale } from 'lucide-react';
import { useGoals, useSaveGoal } from '@/features/goals/queries';
import {
  ACTIVITY_LABEL,
  ageOn,
  defaultDueDate,
  estimateCalories,
  pathWeight,
  smoothedWeight,
  suggestedProtein,
  trackStatus,
  weightPlan,
} from '@/features/goals/weight';
import { useMeasurements, useSaveMeasurement } from '@/features/workouts/queries';
import { formatWeight, toKg } from '@/features/workouts/logic';
import { useEnrollments } from '@/features/plans/queries';
import { useHabits } from '@/features/habits/queries';
import { buildRecurringIcs } from '@/features/plans/ics';
import { WEEKDAY_CHIPS } from '@/features/plans/logic';
import { download } from '@/features/data/exportImport';
import { useLoadedProfile, useUpdateProfile } from '@/features/profile/queries';
import { useToday } from '@/features/profile/useToday';
import type { GoalRow } from '@/types/database';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { ProgressBar } from '@/components/ui/Controls';
import { SelectField, TextField } from '@/components/ui/Field';
import { StatTile } from '@/components/ui/Layout';
import { Sheet } from '@/components/ui/Sheet';
import { CardSkeleton, ErrorState, FormMessage } from '@/components/ui/States';
import { useToast } from '@/components/ui/feedbackContext';
import { ChartCard, TwoLineSeries } from '@/components/charts/Charts';
import { addDaysISO, formatISODate, parseISODate } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { cn } from '@/utils/cn';

const PACE_TEXT = {
  gentle: 'A gentle pace. Very achievable.',
  steady: 'A steady, sustainable pace, within the 0.5–1 kg a week usually advised as a safe maximum.',
  ambitious: 'Ambitious but within safe limits. Consistency matters more than perfection.',
  too_fast: 'Faster than the roughly 1 kg a week usually advised as a safe maximum. A later date would be kinder to your body.',
  done: 'Already there.',
  past_due: 'The date has passed.',
} as const;

function Setup({ latestKg }: { latestKg: number | null }) {
  const { today } = useToday();
  const profile = useLoadedProfile();
  const units = profile.units;
  const save = useSaveGoal();
  const saveM = useSaveMeasurement();
  const toast = useToast();
  const birthdayDue = defaultDueDate(profile.birthday, today);
  const [current, setCurrent] = useState(latestKg != null ? formatWeight(latestKg, units) : '');
  const [lose, setLose] = useState(units === 'kg' ? '10' : '22');
  const [due, setDue] = useState(birthdayDue ?? addDaysISO(today, 180));
  const [err, setErr] = useState<string | null>(null);

  const startKg = current ? toKg(Number(current), units) : null;
  const loseKg = lose ? toKg(Number(lose), units) : null;
  const plan =
    startKg && loseKg && due > today
      ? weightPlan({ startKg, targetKg: startKg - loseKg, startDay: today, dueDay: due, currentKg: startKg, today })
      : null;
  const isBirthday = birthdayDue != null && due === birthdayDue;
  const saferDue = plan?.pace === 'too_fast' && loseKg ? addDaysISO(today, Math.ceil((loseKg / 0.75) * 7)) : null;

  return (
    <form
      className="card space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!startKg || startKg < 30 || startKg > 400) return setErr('Enter your current weight.');
        if (!loseKg || loseKg <= 0 || loseKg > startKg / 2) return setErr('Enter how much you’d like to lose.');
        if (due <= today) return setErr('Choose a date in the future.');
        setErr(null);
        try {
          if (latestKg == null || Math.abs(latestKg - startKg) > 0.05) {
            await saveM.mutateAsync({ day: today, weight_kg: Math.round(startKg * 100) / 100 } as Parameters<typeof saveM.mutateAsync>[0]);
          }
          await save.mutateAsync({
            input: {
              title: `Lose ${lose} ${units} by ${isBirthday ? 'my birthday' : formatISODate(due, 'd MMM yyyy')}`,
              kind: 'weight',
              target: Math.round((startKg - loseKg) * 100) / 100,
              start_value: Math.round(startKg * 100) / 100,
              due_date: due,
            },
          });
          toast('Goal set. One week at a time.');
        } catch (e2) {
          setErr(errorMessage(e2));
        }
      }}
    >
      <h2 className="flex items-center gap-2 text-base">
        <Scale className="h-5 w-5 text-accent-ink" aria-hidden />
        Set a weight goal with a date
      </h2>
      <div className="grid grid-cols-3 gap-3">
        <TextField label={`Weight now (${units})`} inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value.replace(/[^\d.]/g, ''))} />
        <TextField label={`Lose (${units})`} inputMode="decimal" value={lose} onChange={(e) => setLose(e.target.value.replace(/[^\d.]/g, ''))} />
        <TextField label="By" type="date" min={addDaysISO(today, 1)} value={due} onChange={(e) => e.target.value && setDue(e.target.value)} />
      </div>
      {birthdayDue ? (
        !isBirthday && (
          <button type="button" className="link text-sm" onClick={() => setDue(birthdayDue)}>
            Use my birthday ({formatISODate(birthdayDue, 'd MMM yyyy')})
          </button>
        )
      ) : (
        <p className="text-sm text-muted">
          Tip: add your birthday in <Link to="/settings" className="link">Settings → About you</Link> to count down to it.
        </p>
      )}
      {plan && plan.neededPerWeek != null && (
        <div className={cn('rounded-input px-3 py-2 text-sm', plan.pace === 'too_fast' ? 'bg-amber-soft' : 'bg-accent-soft')}>
          <p>
            About <span className="font-semibold">{formatWeight(plan.neededPerWeek, units)} {units} a week</span> for {Math.round(plan.weeksLeft)} weeks.{' '}
            {PACE_TEXT[plan.pace]}
          </p>
          {saferDue && (
            <button type="button" className="link mt-1" onClick={() => setDue(saferDue)}>
              Use {formatISODate(saferDue, 'd MMM yyyy')} instead (0.75 kg a week)
            </button>
          )}
        </div>
      )}
      {err && <FormMessage tone="error">{err}</FormMessage>}
      <Button type="submit" loading={save.isPending || saveM.isPending}>
        Start my goal
      </Button>
    </form>
  );
}

function WeighInSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { today } = useToday();
  const units = useLoadedProfile().units;
  const save = useSaveMeasurement();
  const toast = useToast();
  const [v, setV] = useState('');
  return (
    <Sheet open={open} onClose={onClose} title="Weigh in" description="Best: same day each week, in the morning, after the toilet and before breakfast.">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const kg = toKg(Number(v), units);
          if (!v || kg < 30 || kg > 400) return;
          save.mutate({ day: today, weight_kg: Math.round(kg * 100) / 100 } as Parameters<typeof save.mutate>[0], {
            onSuccess: () => {
              toast('Weigh-in saved');
              setV('');
              onClose();
            },
          });
        }}
      >
        <TextField label={`Weight (${units})`} inputMode="decimal" autoFocus value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ''))} />
        {save.isError && <FormMessage tone="error">{errorMessage(save.error)}</FormMessage>}
        <Button type="submit" loading={save.isPending}>
          Save
        </Button>
      </form>
    </Sheet>
  );
}

function WeighInReminder({ due, open, onClose }: { due: string; open: boolean; onClose: () => void }) {
  const { today } = useToday();
  const toast = useToast();
  const [day, setDay] = useState('1');
  const [time, setTime] = useState('07:30');
  return (
    <Sheet open={open} onClose={onClose} title="Weekly weigh-in reminder">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Day" value={day} onChange={(e) => setDay(e.target.value)} options={WEEKDAY_CHIPS.map((d) => ({ value: String(d.v), label: d.l }))} />
          <TextField label="Time" type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} />
        </div>
        <Button
          block
          onClick={() => {
            const ics = buildRecurringIcs('Steady: weigh-in', [
              { uid: 'steady-weigh-in', title: 'Weekly weigh-in', description: 'Morning, after the toilet, before breakfast. Log it in Steady.', startDay: today, time, durationMin: 5, weekdays: [Number(day)], until: due, alarmMinutes: 0 },
            ]);
            download(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), 'steady-weigh-in.ics');
            toast('Calendar file downloaded. Open it to add the reminder.');
            onClose();
          }}
        >
          <CalendarPlus className="h-4 w-4" aria-hidden />
          Download calendar file
        </Button>
      </div>
    </Sheet>
  );
}

function Dashboard({ goal, weights }: { goal: GoalRow; weights: Array<{ day: string; kg: number }> }) {
  const { today, tz } = useToday();
  const profile = useLoadedProfile();
  const units = profile.units;
  const updateProfile = useUpdateProfile();
  const enrollments = useEnrollments();
  const habits = useHabits();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [weighIn, setWeighInState] = useState(params.get('weighin') === '1');
  const setWeighIn = (open: boolean) => {
    setWeighInState(open);
    if (!open && params.get('weighin')) setParams({}, { replace: true });
  };
  const [reminder, setReminder] = useState(false);

  const startKg = Number(goal.start_value);
  const targetKg = Number(goal.target);
  const due = goal.due_date!;
  const startDay = formatInTimeZone(new Date(goal.created_at), tz, 'yyyy-MM-dd');
  const since = weights.filter((w) => w.day >= startDay);
  const smoothed = smoothedWeight(since.length ? since : weights, today);
  const plan = weightPlan({ startKg, targetKg, startDay, dueDay: due, currentKg: smoothed, today });
  const pathNow = pathWeight(startKg, targetKg, startDay, due, today);
  const status = trackStatus(smoothed, pathNow);
  const lost = smoothed != null ? Math.max(0, startKg - smoothed) : 0;
  const toGo = smoothed != null ? Math.max(0, smoothed - targetKg) : startKg - targetKg;
  const lastWeighIn = weights.length ? weights.reduce((a, b) => (a.day > b.day ? a : b)).day : null;
  const weighInDue = !lastWeighIn || lastWeighIn < addDaysISO(today, -6);
  const isBirthdayGoal = /birthday/i.test(goal.title);

  // A weekly grid from the start date to the goal date, so the x axis is proportional to time.
  const chart = useMemo(() => {
    const points: Array<{ x: string; weight: number | null; path: number }> = [];
    for (let d = startDay; ; d = addDaysISO(d, 7)) {
      const last = d >= due;
      const day = last ? due : d;
      const end = addDaysISO(day, 6);
      const inWeek = since.filter((w) => w.day >= day && w.day <= end);
      const avg = inWeek.length ? inWeek.reduce((s, w) => s + w.kg, 0) / inWeek.length : d === startDay ? startKg : null;
      points.push({
        x: format(parseISODate(day), 'd MMM'),
        weight: avg == null || day > today ? null : Number(formatWeight(avg, units)),
        path: Number(formatWeight(pathWeight(startKg, targetKg, startDay, due, day), units)),
      });
      if (last) break;
    }
    return points;
  }, [since, startDay, due, startKg, targetKg, units, today]);

  const step = units === 'kg' ? 2.5 : toKg(5, 'lb');
  const milestones: Array<{ kg: number; reachedOn: string | null }> = [];
  for (let k = step; k < startKg - targetKg + 0.01; k += step) {
    const hit = since.filter((w) => w.kg <= startKg - k).sort((a, b) => a.day.localeCompare(b.day))[0];
    milestones.push({ kg: k, reachedOn: hit?.day ?? null });
  }

  const protein = suggestedProtein(targetKg);
  const walkActive = enrollments.data?.some((e) => e.plan_id === 'walk-12');
  const strengthActive = enrollments.data?.some((e) => e.plan_id === 'home-strength-8');
  const keyHabits = (habits.data ?? []).filter((h) => !h.archived_at && /veg|sugary|kitchen|bed|protein|walk/i.test(h.name)).length;
  const canEstimate = profile.sex && profile.height_cm && profile.birthday && profile.activity_level && smoothed != null;
  const estimate = canEstimate
    ? estimateCalories({
        sex: profile.sex!,
        age: ageOn(profile.birthday!, today),
        heightCm: Number(profile.height_cm),
        weightKg: smoothed!,
        activity: profile.activity_level!,
        neededPerWeek: plan.neededPerWeek,
      })
    : null;

  const steps: Array<{ done: boolean; title: string; detail: string; action?: React.ReactNode }> = [
    {
      done: !weighInDue,
      title: 'Weigh in once a week',
      detail: lastWeighIn ? `Last weigh-in ${formatISODate(lastWeighIn, 'd MMM')}. Weekly is enough; daily numbers bounce around.` : 'No weigh-ins yet.',
      action: (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={weighInDue ? 'primary' : 'secondary'} onClick={() => setWeighIn(true)}>
            Weigh in now
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setReminder(true)}>
            <CalendarPlus className="h-4 w-4" aria-hidden />
            Weekly reminder
          </Button>
        </div>
      ),
    },
    {
      done: Boolean(walkActive),
      title: 'Walk most days',
      detail: 'The 12-week walking plan builds from 10 to 45 minutes. Regular movement also helps mood: walking, yoga and strength training all reduced depression symptoms in a large 2024 BMJ review.',
      action: !walkActive && <Link to="/plans/walk-12" className={buttonClasses('secondary', 'sm')}>Start the walking plan</Link>,
    },
    {
      done: Boolean(strengthActive),
      title: 'Strength twice a week',
      detail: 'Keeps the weight you lose coming from fat rather than muscle.',
      action: !strengthActive && <Link to="/plans/home-strength-8" className={buttonClasses('secondary', 'sm')}>Start home strength</Link>,
    },
    {
      done: profile.protein_target_g != null,
      title: `Protein around ${protein} g a day`,
      detail: 'About 1.2 g per kg of your goal weight helps you feel full and protects muscle.',
      action:
        profile.protein_target_g == null && (
          <Button size="sm" variant="secondary" loading={updateProfile.isPending} onClick={() => updateProfile.mutate({ protein_target_g: protein }, { onSuccess: () => toast(`Protein target set to ${protein} g`) })}>
            Set {protein} g as my target
          </Button>
        ),
    },
    {
      done: keyHabits >= 2,
      title: 'A few food and sleep habits',
      detail: 'Vegetables with meals, no sugary drinks, kitchen closed after dinner, a regular bedtime.',
      action: keyHabits < 2 && <Link to="/habits?ideas=1" className={buttonClasses('secondary', 'sm')}>Pick habits</Link>,
    },
  ];

  return (
    <div className="space-y-4">
      <WeighInSheet open={weighIn} onClose={() => setWeighIn(false)} />
      <WeighInReminder due={due} open={reminder} onClose={() => setReminder(false)} />

      <section className="card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg">
              {isBirthdayGoal && <Cake className="h-5 w-5 text-clay-ink" aria-hidden />}
              {goal.title}
            </h2>
            <p className="text-sm text-muted">
              {formatISODate(due, 'EEEE d MMMM yyyy')} · {plan.daysLeft > 0 ? `${plan.daysLeft} days to go` : plan.pace === 'done' ? 'reached' : 'date passed'}
            </p>
          </div>
        </div>
        <ProgressBar value={lost} max={Math.max(0.1, startKg - targetKg)} label="Weight goal progress" tone="clay" />
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Lost so far" value={`${formatWeight(lost, units)} ${units}`} />
          <StatTile label="To go" value={`${formatWeight(toGo, units)} ${units}`} />
          <StatTile label="Pace needed" value={plan.neededPerWeek != null ? `${formatWeight(plan.neededPerWeek, units)}/wk` : '–'} />
        </div>
        <p className="text-sm">
          {status === 'no_data'
            ? 'Weigh in to see how you’re tracking.'
            : plan.pace === 'done'
              ? 'You’ve reached your goal. That’s a real achievement.'
              : status === 'ahead'
                ? 'Ahead of the plan. Lovely work. No need to speed up.'
                : status === 'on_track'
                  ? 'On track. Keep doing what you’re doing.'
                  : 'A little behind the plan line. That’s normal; weight rarely falls in a straight line. Focus on this week’s basics.'}
          {plan.pace === 'too_fast' && ' The pace now needed is above 1 kg a week. Consider moving the date rather than cutting harder.'}
        </p>
      </section>

      <ChartCard title={`Weight vs goal path (${units})`} caption="Weekly average of your weigh-ins, and the straight line to your goal" empty={since.length < 1}>
        <TwoLineSeries
          data={chart}
          label="Weight compared with the goal path"
          series={[
            { key: 'weight', label: 'Your weight' },
            { key: 'path', label: 'Goal path' },
          ]}
          format={(v) => `${v} ${units}`}
        />
      </ChartCard>

      <section className="card" aria-labelledby="gp">
        <h2 id="gp" className="text-base">
          Your game plan
        </h2>
        <ul className="mt-3 space-y-4">
          {steps.map((s) => (
            <li key={s.title} className="flex gap-3">
              {s.done ? (
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg" aria-label="Done">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
              ) : (
                <Circle className="mt-0.5 h-6 w-6 shrink-0 text-border" aria-label="Not yet" />
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="font-medium">{s.title}</p>
                <p className="text-sm text-muted">{s.detail}</p>
                {s.action}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-2" aria-labelledby="cal">
        <h2 id="cal" className="text-base">
          Calories (optional)
        </h2>
        {estimate ? (
          <>
            <p className="text-sm">
              Estimated maintenance: about <span className="font-semibold">{estimate.maintenance.toLocaleString()} kcal</span> a day. For your pace, a target of about{' '}
              <span className="font-semibold">{estimate.target.toLocaleString()} kcal</span> would mean roughly {formatWeight(estimate.perWeek, units)} {units} a week.
              {estimate.floored && ' (Kept at the safe minimum, so expect a slower pace.)'}
            </p>
            <p className="text-xs text-muted">
              Estimated with the Mifflin–St Jeor equation ({ACTIVITY_LABEL[profile.activity_level!].toLowerCase()}). Estimates can be off by 10% or more: watch your
              weekly trend and adjust gently. Steady never shows “over budget” warnings.
            </p>
            {profile.calorie_target === estimate.target && profile.calories_enabled ? (
              <p className="text-sm text-accent-ink">This is your calorie target.</p>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                loading={updateProfile.isPending}
                onClick={() => updateProfile.mutate({ calories_enabled: true, calorie_target: estimate.target }, { onSuccess: () => toast('Calorie target set. Change it any time in Settings.') })}
              >
                Use {estimate.target.toLocaleString()} kcal as my target
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">
            Add your birthday, height, sex and activity level in <Link to="/settings" className="link">Settings → About you</Link> for an estimate. It's entirely optional;
            the plan above works without counting calories.
          </p>
        )}
      </section>

      {milestones.length > 0 && (
        <section className="card" aria-labelledby="wm">
          <h2 id="wm" className="text-base">
            Milestones
          </h2>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {milestones.map((m) => (
              <li key={m.kg} className={cn('rounded-input border px-3 py-2 text-sm', m.reachedOn ? 'border-accent bg-accent-soft' : 'border-border')}>
                <span className="font-semibold">−{formatWeight(m.kg, units)} {units}</span>
                <span className="block text-xs text-muted">{m.reachedOn ? `Reached ${formatISODate(m.reachedOn, 'd MMM')}` : 'Not yet'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-card bg-panel px-4 py-3 text-sm text-muted">
        <p className="font-medium text-ink">Worth knowing</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Weight can swing 1–2 kg from day to day with water and food. Steady compares your average over the last two weeks with the plan.</li>
          <li>Some medicines for depression and anxiety can affect appetite or weight. If you notice that, talk to your prescriber; please don't change or stop them yourself.</li>
          <li>Sleep and stress affect hunger. Your check-ins and journal are part of this plan too.</li>
        </ul>
      </section>
      <p className="text-center text-sm">
        <Link to="/goals" className="link">
          Edit or archive this goal in Goals
        </Link>
      </p>
    </div>
  );
}

export function WeightGoalPage() {
  const goals = useGoals();
  const measurements = useMeasurements();
  if (goals.isPending || measurements.isPending) return <CardSkeleton lines={6} />;
  if (goals.isError || measurements.isError) return <ErrorState error={goals.error ?? measurements.error} onRetry={() => void goals.refetch()} />;
  const weights = measurements.data.filter((m) => m.weight_kg != null).map((m) => ({ day: m.day, kg: Number(m.weight_kg) }));
  const goal = goals.data
    .filter((g) => g.kind === 'weight' && !g.archived_at && g.due_date && g.start_value != null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return (
    <>
      <Link to="/goals" className="mb-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Goals
      </Link>
      <PageHeader title="Weight goal" description="A clear target, a safe pace, and the few things that make the biggest difference." />
      {goal ? <Dashboard goal={goal} weights={weights} /> : <Setup latestKg={weights[0]?.kg ?? null} />}
    </>
  );
}
