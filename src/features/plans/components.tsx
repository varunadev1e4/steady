import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Play } from 'lucide-react';
import type { PlanEnrollmentRow } from '@/types/database';
import { useToday } from '@/features/profile/useToday';
import { useTemplates } from '@/features/workouts/queries';
import { useStart } from '@/features/workouts/useStart';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Chip, ProgressBar } from '@/components/ui/Controls';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/Field';
import { FormMessage } from '@/components/ui/States';
import { useToast } from '@/components/ui/feedbackContext';
import { errorMessage } from '@/utils/errors';
import { formatDuration, isPlannedDay, planProgress, sessionsBetween, WEEKDAY_CHIPS } from './logic';
import type { Plan, Step } from './content';
import { usePlanLogDays, useStartPlan } from './queries';

export function StepCard({ step, index }: { step: Step; index?: number }) {
  return (
    <li className="rounded-input border border-border bg-surface px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">
          {index != null && <span className="mr-1.5 text-muted">{index + 1}.</span>}
          {step.name}
        </span>
        <span className="shrink-0 text-sm tabular-nums text-muted">{step.seconds ? formatDuration(step.seconds) : step.reps}</span>
      </div>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">
        {step.cues.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      {(step.easier || step.harder) && (
        <p className="mt-1.5 text-xs text-muted">
          {step.easier && (
            <>
              <span className="font-semibold text-accent-ink">Easier:</span> {step.easier}{' '}
            </>
          )}
          {step.harder && (
            <>
              <span className="font-semibold text-clay-ink">Harder:</span> {step.harder}
            </>
          )}
        </p>
      )}
    </li>
  );
}

/** Week, sessions this week and today's action for an active plan. */
export function PlanStatus({ plan, enrollment, compact = false }: { plan: Plan; enrollment: PlanEnrollmentRow; compact?: boolean }) {
  const { today } = useToday();
  const logs = usePlanLogDays(enrollment, plan);
  const templates = useTemplates();
  const { start, pending } = useStart();
  const p = planProgress(enrollment.start_date, today, plan.weeksTotal);
  const week = plan.weeks[p.week - 1];
  const done = sessionsBetween(logs.data ?? [], p.from, p.to);
  const doneToday = (logs.data ?? []).includes(today);
  const planned = isPlannedDay(enrollment.weekdays, today);
  const template = templates.data?.find((t) => t.id === enrollment.template_id);

  const action = doneToday ? (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink">
      <Check className="h-4 w-4" aria-hidden /> Done today
    </span>
  ) : plan.kind === 'strength' ? (
    <div className="flex flex-wrap gap-2">
      <Link to={`/plans/${plan.id}/session?week=${p.week}`} className={buttonClasses(planned ? 'secondary' : 'ghost', 'sm')}>
        Guide
      </Link>
      <Button size="sm" variant={planned ? 'primary' : 'secondary'} loading={pending} disabled={!template} onClick={() => template && start(template)}>
        <Play className="h-4 w-4" aria-hidden />
        Log sets
      </Button>
    </div>
  ) : (
    <Link to={`/plans/${plan.id}/session?week=${p.week}`} className={buttonClasses(planned ? 'primary' : 'secondary', 'sm')}>
      <Play className="h-4 w-4" aria-hidden />
      {plan.kind === 'walk' ? `${week.minutes}-min walk` : `${week.minutes}-min session`}
    </Link>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          {compact && (
            <Link to={`/plans/${plan.id}`} className="font-medium hover:text-accent-ink">
              {plan.short}
            </Link>
          )}
          <p className="text-sm text-muted">
            {p.notStarted
              ? 'Starts soon'
              : p.finished
                ? `Plan complete · keep going with week ${plan.weeksTotal}`
                : `Week ${p.week} of ${plan.weeksTotal}`}{' '}
            · {done} of {week.sessions} this week
            {!doneToday && !planned && ' · not planned today'}
          </p>
        </div>
        {action}
      </div>
      {!compact && <ProgressBar value={done} max={week.sessions} label="Sessions this week" />}
    </div>
  );
}

export function StartPlanSheet({ plan, open, onClose }: { plan: Plan; open: boolean; onClose: () => void }) {
  const { today } = useToday();
  const startPlan = useStartPlan();
  const toast = useToast();
  const [days, setDays] = useState<number[]>(plan.defaultDays);
  const [start, setStart] = useState(today);
  const target = plan.weeks[0].sessions;

  return (
    <Sheet open={open} onClose={onClose} title={`Start: ${plan.title}`} description={plan.daysHint}>
      <div className="space-y-4">
        <fieldset>
          <legend className="label">Which days?</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_CHIPS.map((d) => (
              <Chip key={d.v} active={days.includes(d.v)} onClick={() => setDays(days.includes(d.v) ? days.filter((x) => x !== d.v) : [...days, d.v])}>
                {d.l}
              </Chip>
            ))}
          </div>
          {days.length !== target && (
            <p className="mt-1.5 text-sm text-muted">
              The plan has {target} sessions a week; you picked {days.length} {days.length === 1 ? 'day' : 'days'}. That's fine: any day counts.
            </p>
          )}
        </fieldset>
        <TextField label="Start date" type="date" min={today} value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
        {plan.kind === 'strength' && (
          <p className="text-sm text-muted">This adds the plan's exercises to your library and creates a “Home strength (beginner plan)” workout template.</p>
        )}
        {startPlan.isError && <FormMessage tone="error">{errorMessage(startPlan.error)}</FormMessage>}
        <Button
          block
          loading={startPlan.isPending}
          disabled={days.length === 0}
          onClick={() =>
            startPlan.mutate(
              { plan, start, weekdays: days },
              {
                onSuccess: () => {
                  toast(`${plan.short} started. Week 1 is deliberately easy.`);
                  onClose();
                },
              },
            )
          }
        >
          Start plan
        </Button>
      </div>
    </Sheet>
  );
}
