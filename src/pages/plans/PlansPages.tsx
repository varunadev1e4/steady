import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BookMarked, CalendarPlus, ChevronLeft, ChevronRight, Footprints, HeartPulse, Pause, Play, SkipForward, Sparkles, Dumbbell } from 'lucide-react';
import {
  BEFORE_YOU_START,
  PLANS,
  SOURCES,
  SUGGESTED_WEEK,
  STRENGTH_PHASES,
  phaseForWeek,
  planById,
  type Plan,
  type PlanKind,
} from '@/features/plans/content';
import { enrollmentFor, useEnrollments, useUpdateEnrollment } from '@/features/plans/queries';
import { formatDuration, planProgress, timedMinutes, WEEKDAY_CHIPS } from '@/features/plans/logic';
import { PlanStatus, StartPlanSheet, StepCard } from '@/features/plans/components';
import { useAddCardio, useExercises, useSaveTemplate, useTemplateExercises, useTemplates } from '@/features/workouts/queries';
import { useStart } from '@/features/workouts/useStart';
import { useToday } from '@/features/profile/useToday';
import { useWakeLock } from '@/lib/wakeLock';
import { buildPlanIcs } from '@/features/plans/ics';
import { download } from '@/features/data/exportImport';
import { SelectField } from '@/components/ui/Field';
import type { PlanEnrollmentRow } from '@/types/database';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Chip } from '@/components/ui/Controls';
import { TextField } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/Layout';
import { Sheet } from '@/components/ui/Sheet';
import { CardSkeleton, ErrorState, FormMessage } from '@/components/ui/States';
import { useConfirm, useToast } from '@/components/ui/feedbackContext';
import { addDaysISO } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { cn } from '@/utils/cn';

const KIND_ICON: Record<PlanKind, LucideIcon> = { walk: Footprints, strength: Dumbbell, yoga: Sparkles };

function BeforeYouStart({ open = false }: { open?: boolean }) {
  return (
    <details className="card" open={open}>
      <summary className="flex cursor-pointer items-center gap-2 font-semibold">
        <HeartPulse className="h-5 w-5 text-clay-ink" aria-hidden />
        Before you start
      </summary>
      <div className="mt-3 space-y-3 text-sm">
        <div>
          <p className="font-medium">Check with a doctor first if you have:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
            {BEFORE_YOU_START.checkFirst.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-input bg-amber-soft px-3 py-2">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-ink" aria-hidden /> Stop and get help if you feel:
          </p>
          <p className="mt-0.5 text-muted">{BEFORE_YOU_START.stopSigns.join('; ')}.</p>
        </div>
        <ul className="space-y-1 text-muted">
          {BEFORE_YOU_START.reassurance.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p className="text-xs text-muted">General guidance for adults, not personal medical advice.</p>
      </div>
    </details>
  );
}

function Sources() {
  return (
    <details className="card" id="sources">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold">
        <BookMarked className="h-5 w-5 text-muted" aria-hidden />
        Where these plans come from
      </summary>
      <p className="mt-2 text-sm text-muted">
        The amounts, progressions and intensity cues follow these guidelines and studies. The plans themselves are general programmes,
        not tailored prescriptions.
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
        {SOURCES.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </details>
  );
}

function PlanNotFound() {
  return (
    <>
      <PageHeader title="Plan not found" />
      <ErrorState error="That plan doesn't exist." title="Nothing here" />
      <Link to="/plans" className={buttonClasses('secondary', 'sm')}>
        See all plans
      </Link>
    </>
  );
}

/* -------------------------------------------------------------- list -- */

export function PlansPage() {
  const enrollments = useEnrollments();
  return (
    <>
      <PageHeader title="Beginner plans" description="For starting from zero. Gentle on joints, built up slowly, done at home or outdoors." />
      <div className="space-y-4">
        <BeforeYouStart open={!enrollments.data?.length} />

        {enrollments.isError && <ErrorState error={enrollments.error} onRetry={() => void enrollments.refetch()} />}

        {PLANS.map((plan) => {
          const Icon = KIND_ICON[plan.kind];
          const enrollment = enrollmentFor(enrollments.data, plan.id);
          return (
            <section key={plan.id} className="card space-y-3" aria-labelledby={`plan-${plan.id}`}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 id={`plan-${plan.id}`} className="text-base">
                    <Link to={`/plans/${plan.id}`} className="hover:text-accent-ink">
                      {plan.title}
                    </Link>
                  </h2>
                  <p className="mt-0.5 text-sm text-muted">{plan.summary}</p>
                </div>
              </div>
              {enrollment ? (
                <PlanStatus plan={plan} enrollment={enrollment} />
              ) : (
                <Link to={`/plans/${plan.id}`} className={buttonClasses('secondary', 'sm')}>
                  See the plan
                </Link>
              )}
            </section>
          );
        })}

        <section className="card" aria-labelledby="combine">
          <h2 id="combine" className="text-base">
            Doing more than one?
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Start with walking alone for two weeks if everything is new. Then add strength twice a week and yoga on easy days. A week can look like:
          </p>
          <ul className="mt-2 grid grid-cols-7 gap-1 text-center text-xs">
            {SUGGESTED_WEEK.map((d) => (
              <li key={d.day} className="rounded-input border border-border bg-surface px-1 py-2">
                <span className="block font-semibold">{d.day}</span>
                <span className="text-muted">{d.plan}</span>
              </li>
            ))}
          </ul>
        </section>

        <Sources />
      </div>
    </>
  );
}

/* ------------------------------------------------------------ detail -- */

function StrengthTargets({ week, templateId }: { week: number; templateId: string | null }) {
  const templates = useTemplates();
  const te = useTemplateExercises();
  const exercises = useExercises();
  const save = useSaveTemplate();
  const toast = useToast();
  const phase = phaseForWeek(week);
  const template = templates.data?.find((t) => t.id === templateId);
  if (!template || !te.data || !exercises.data) return null;

  const current = te.data
    .filter((x) => x.template_id === template.id)
    .map((x) => `${exercises.data.find((e) => e.id === x.exercise_id)?.name}|${x.target_sets}|${x.rep_min}|${x.rep_max}`)
    .join(',');
  const wanted = phase.targets.map((t) => `${t.name}|${t.target_sets}|${t.rep_min}|${t.rep_max}`).join(',');
  if (current === wanted) return <p className="text-sm text-muted">Your “{template.name}” template matches this phase.</p>;

  const apply = () => {
    const rows = phase.targets.map((t) => {
      const ex = exercises.data.find((e) => e.name.toLowerCase() === t.name.toLowerCase());
      return ex ? { exercise_id: ex.id, target_sets: t.target_sets, rep_min: t.rep_min, rep_max: t.rep_max } : null;
    });
    if (rows.some((r) => r == null)) {
      toast('Some plan exercises are missing from your library. Restart the plan to add them.', 'error');
      return;
    }
    save.mutate(
      { id: template.id, name: template.name, notes: template.notes, weekdays: template.weekdays, exercises: rows as NonNullable<(typeof rows)[number]>[] },
      { onSuccess: () => toast('Template updated for this phase'), onError: (e) => toast(errorMessage(e), 'error') },
    );
  };

  return (
    <div className="rounded-input bg-clay-soft/70 px-3 py-2 text-sm">
      <p>New targets for weeks {phase.weeks.join('–')}: {phase.focus}</p>
      <Button size="sm" className="mt-2" loading={save.isPending} onClick={apply}>
        Use these targets
      </Button>
    </div>
  );
}

export function PlanDetailPage() {
  const { planId = '' } = useParams();
  const plan = planById(planId);
  const { today } = useToday();
  const enrollments = useEnrollments();
  const update = useUpdateEnrollment();
  const confirm = useConfirm();
  const toast = useToast();
  const [starting, setStarting] = useState(false);
  const [editingDays, setEditingDays] = useState(false);
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  if (!plan) return <PlanNotFound />;
  if (enrollments.isPending) return <CardSkeleton lines={6} />;
  if (enrollments.isError) return <ErrorState error={enrollments.error} onRetry={() => void enrollments.refetch()} />;

  const enrollment = enrollmentFor(enrollments.data, plan.id);
  const progress = enrollment ? planProgress(enrollment.start_date, today, plan.weeksTotal) : null;
  const currentWeek = progress?.week ?? 1;
  const shownWeek = openWeek ?? currentWeek;
  const week = plan.weeks[shownWeek - 1];

  return (
    <>
      <Link to="/plans" className="mb-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Beginner plans
      </Link>
      <PageHeader title={plan.title} description={plan.summary} />
      <StartPlanSheet plan={plan} open={starting} onClose={() => setStarting(false)} />
      <div className="space-y-4">
        {enrollment ? (
          <section className="card space-y-3" aria-label="Your progress">
            <PlanStatus plan={plan} enrollment={enrollment} />
            {plan.kind === 'strength' && <StrengthTargets week={currentWeek} templateId={enrollment.template_id} />}
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  update.mutate(
                    { id: enrollment.id, patch: { start_date: addDaysISO(enrollment.start_date, 7) } },
                    { onSuccess: () => toast(`Repeating week ${currentWeek}. No rush.`) },
                  )
                }
                disabled={!progress || progress.notStarted}
              >
                Felt hard? Repeat this week
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingDays(true)}>
                Change days
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCalendarOpen(true)}>
                <CalendarPlus className="h-4 w-4" aria-hidden />
                Add to calendar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-danger"
                onClick={async () => {
                  const ok = await confirm({
                    title: `Stop the ${plan.short.toLowerCase()}?`,
                    body: 'Your logged walks and workouts stay. You can start the plan again any time.',
                    confirmLabel: 'Stop plan',
                    danger: true,
                  });
                  if (ok) update.mutate({ id: enrollment.id, patch: { ended_at: new Date().toISOString() } });
                }}
              >
                Stop plan
              </Button>
            </div>
            <CalendarSheet plan={plan} enrollment={enrollment} open={calendarOpen} onClose={() => setCalendarOpen(false)} />
            <Sheet open={editingDays} onClose={() => setEditingDays(false)} title="Plan days">
              <DaysEditor
                initial={enrollment.weekdays}
                onSave={(days) =>
                  update.mutate({ id: enrollment.id, patch: { weekdays: days } }, { onSuccess: () => setEditingDays(false) })
                }
                saving={update.isPending}
              />
            </Sheet>
          </section>
        ) : (
          <Button block size="lg" onClick={() => setStarting(true)}>
            Start this plan
          </Button>
        )}

        <BeforeYouStart open={!enrollment} />

        <section className="card space-y-3" aria-labelledby="week-h">
          <div className="flex items-center justify-between">
            <h2 id="week-h" className="text-base">
              Week {shownWeek}
              {enrollment && shownWeek === currentWeek && <span className="ml-2 text-sm font-normal text-accent-ink">this week</span>}
            </h2>
            <div className="flex">
              <IconButton label="Previous week" disabled={shownWeek <= 1} onClick={() => setOpenWeek(shownWeek - 1)}>
                <ChevronLeft className="h-5 w-5" />
              </IconButton>
              <IconButton label="Next week" disabled={shownWeek >= plan.weeksTotal} onClick={() => setOpenWeek(shownWeek + 1)}>
                <ChevronRight className="h-5 w-5" />
              </IconButton>
            </div>
          </div>
          <p className="text-sm">
            {week.focus}{' '}
            <span className="text-muted">
              {week.sessions} sessions · about {week.minutes} min each
            </span>
          </p>
          <ol className="space-y-2">
            {week.steps.map((step, i) => (
              <StepCard key={`${step.name}-${i}`} step={step} index={i} />
            ))}
          </ol>
          <Link to={`/plans/${plan.id}/session?week=${shownWeek}`} className={buttonClasses('secondary')}>
            <Play className="h-4 w-4" aria-hidden />
            Start guided session
          </Link>
        </section>

        <section className="card" aria-labelledby="all-weeks">
          <h2 id="all-weeks" className="text-base">
            All {plan.weeksTotal} weeks
          </h2>
          <ul className="mt-2 divide-y divide-border">
            {plan.weeks.map((w) => (
              <li key={w.week}>
                <button
                  type="button"
                  onClick={() => setOpenWeek(w.week)}
                  className={cn('flex w-full items-start gap-3 py-2 text-left hover:text-accent-ink', w.week === shownWeek && 'text-accent-ink')}
                >
                  <span className="w-14 shrink-0 text-sm font-semibold">Week {w.week}</span>
                  <span className="flex-1 text-sm">
                    {w.focus}
                    <span className="block text-xs text-muted">
                      {w.sessions} × {w.minutes} min = {w.sessions * w.minutes} min
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card space-y-3">
          <div>
            <h2 className="text-base">How hard should it feel?</h2>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
              {plan.howHard.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-base">Why this works</h2>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
              {plan.whyItWorks.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-base">Tips</h2>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
              {plan.tips.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          {plan.kind === 'strength' && (
            <p className="text-xs text-muted">
              Phases: {STRENGTH_PHASES.map((p) => `weeks ${p.weeks.join('–')}`).join(', ')}. Targets change every two weeks.
            </p>
          )}
        </section>

        <Sources />
      </div>
    </>
  );
}

function CalendarSheet({ plan, enrollment, open, onClose }: { plan: Plan; enrollment: PlanEnrollmentRow; open: boolean; onClose: () => void }) {
  const { today } = useToday();
  const toast = useToast();
  const [time, setTime] = useState(plan.kind === 'walk' ? '07:00' : '18:30');
  const [alarm, setAlarm] = useState('10');
  const preview = buildPlanIcs({ plan, enrollment, time, alarmMinutes: alarm === 'none' ? null : Number(alarm), from: today, origin: window.location.origin });
  return (
    <Sheet open={open} onClose={onClose} title="Add sessions to your calendar" description="Your phone's own calendar reminds you. Steady itself never sends notifications.">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Time" type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} />
          <SelectField
            label="Reminder"
            value={alarm}
            onChange={(e) => setAlarm(e.target.value)}
            options={[
              { value: 'none', label: 'No reminder' },
              { value: '0', label: 'At start time' },
              { value: '10', label: '10 minutes before' },
              { value: '30', label: '30 minutes before' },
              { value: '60', label: '1 hour before' },
            ]}
          />
        </div>
        <p className="text-sm text-muted">
          {preview.events} sessions from today to the end of the plan, on your plan days, each with its length and a link back to the guided
          session.
        </p>
        <Button
          block
          disabled={preview.events === 0}
          onClick={() => {
            download(new Blob([preview.ics], { type: 'text/calendar;charset=utf-8' }), `steady-${plan.id}.ics`);
            toast('Calendar file downloaded. Open it to add the sessions.');
            onClose();
          }}
        >
          <CalendarPlus className="h-4 w-4" aria-hidden />
          Download calendar file
        </Button>
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
          <li>iPhone: open the downloaded file and tap “Add all”.</li>
          <li>Android: open the file with your calendar app. If nothing happens, import it at calendar.google.com → Settings → Import.</li>
          <li>Changed your days or repeated a week? Download again; most calendars update the same events.</li>
        </ul>
      </div>
    </Sheet>
  );
}

function DaysEditor({ initial, onSave, saving }: { initial: number[]; onSave: (days: number[]) => void; saving: boolean }) {
  const [days, setDays] = useState(initial);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {WEEKDAY_CHIPS.map((d) => (
          <Chip key={d.v} active={days.includes(d.v)} onClick={() => setDays(days.includes(d.v) ? days.filter((x) => x !== d.v) : [...days, d.v])}>
            {d.l}
          </Chip>
        ))}
      </div>
      <Button loading={saving} disabled={days.length === 0} onClick={() => onSave(days)}>
        Save days
      </Button>
    </div>
  );
}

/* ----------------------------------------------------- guided session -- */

function LogSession({ plan, minutes }: { plan: Plan; minutes: number }) {
  const { today } = useToday();
  const add = useAddCardio();
  const toast = useToast();
  const navigate = useNavigate();
  const templates = useTemplates();
  const enrollments = useEnrollments();
  const { start, pending } = useStart();
  const [mins, setMins] = useState(String(minutes));

  if (plan.kind === 'strength') {
    const e = enrollmentFor(enrollments.data, plan.id);
    const template = templates.data?.find((t) => t.id === e?.template_id);
    return (
      <div className="space-y-3">
        <p>Nicely done. Now record your sets so next time starts from these numbers.</p>
        {template ? (
          <Button size="lg" loading={pending} onClick={() => start(template)}>
            Log your sets
          </Button>
        ) : (
          <p className="text-sm text-muted">Start the plan to get a workout template for logging sets.</p>
        )}
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(mins);
        if (!Number.isInteger(n) || n < 1 || n > 600) return;
        add.mutate(
          { day: today, activity: plan.logActivity!, duration_min: n, distance_km: null, notes: `${plan.short} session` },
          {
            onSuccess: () => {
              toast(plan.kind === 'walk' ? 'Walk logged. Well done.' : 'Yoga logged. Well done.');
              navigate(`/plans/${plan.id}`);
            },
          },
        );
      }}
    >
      <p>Well done. How many minutes did you do?</p>
      <TextField label="Minutes" inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value.replace(/\D/g, ''))} />
      {add.isError && <FormMessage tone="error">{errorMessage(add.error)}</FormMessage>}
      <Button type="submit" size="lg" loading={add.isPending}>
        Log {plan.kind === 'walk' ? 'walk' : 'session'}
      </Button>
    </form>
  );
}

export function PlanSessionPage() {
  const { planId = '' } = useParams();
  const [params] = useSearchParams();
  const plan = planById(planId);
  const weekNo = Math.min(Math.max(Number(params.get('week')) || 1, 1), plan?.weeksTotal ?? 1);
  const steps = useMemo(() => plan?.weeks[weekNo - 1].steps ?? [], [plan, weekNo]);

  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(steps[0]?.seconds ?? 0);
  const endsAt = useRef<number | null>(null);
  const finished = index >= steps.length;
  const step = steps[index];
  useWakeLock(running || (!finished && index > 0));

  const goTo = useCallback(
    (i: number, keepRunning: boolean) => {
      setIndex(i);
      const next = steps[i];
      const secs = next?.seconds ?? 0;
      setLeft(secs);
      const run = keepRunning && Boolean(next?.seconds);
      endsAt.current = run ? Date.now() + secs * 1000 : null;
      setRunning(run);
    },
    [steps],
  );

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (endsAt.current == null) return;
      const remaining = Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        navigator.vibrate?.([200, 100, 200]);
        goTo(index + 1, true);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [running, index, goTo]);

  if (!plan) return <PlanNotFound />;

  const toggle = () => {
    if (!step?.seconds) return;
    if (running) {
      endsAt.current = null;
      setRunning(false);
    } else {
      endsAt.current = Date.now() + left * 1000;
      setRunning(true);
    }
  };

  const remainingTotal = left + steps.slice(index + 1).reduce((s, x) => s + (x.seconds ?? 0), 0);

  return (
    <div className="space-y-4">
      <Link to={`/plans/${plan.id}`} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {plan.short}
      </Link>
      <header>
        <h1 className="text-2xl">
          {plan.short} · week {weekNo}
        </h1>
        <p className="text-sm text-muted">
          {finished ? 'Session complete' : `Step ${index + 1} of ${steps.length} · about ${formatDuration(remainingTotal)} of timed steps left`}
        </p>
      </header>

      {finished ? (
        <section className="card">
          <LogSession plan={plan} minutes={plan.weeks[weekNo - 1].minutes || timedMinutes(steps)} />
        </section>
      ) : (
        <section className="card space-y-4" aria-live="polite">
          <div className="text-center">
            <h2 className="text-xl">{step.name}</h2>
            <p className="mt-2 text-5xl font-semibold tabular-nums" role="timer" aria-label={step.seconds ? 'Time left' : 'Target'}>
              {step.seconds ? formatDuration(left) : step.reps}
            </p>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {step.cues.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {(step.easier || step.harder) && (
            <p className="text-xs text-muted">
              {step.easier && <>Easier: {step.easier} </>}
              {step.harder && <>Harder: {step.harder}</>}
            </p>
          )}
          <div className="flex items-center justify-center gap-3">
            <IconButton label="Previous step" disabled={index === 0} onClick={() => goTo(index - 1, false)}>
              <ChevronLeft className="h-6 w-6" />
            </IconButton>
            {step.seconds ? (
              <Button size="lg" onClick={toggle} className="min-w-36">
                {running ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5" aria-hidden />}
                {running ? 'Pause' : left === step.seconds ? 'Start' : 'Resume'}
              </Button>
            ) : (
              <Button size="lg" onClick={() => goTo(index + 1, true)} className="min-w-36">
                Done, next
              </Button>
            )}
            <IconButton label="Skip to next step" onClick={() => goTo(index + 1, running)}>
              <SkipForward className="h-6 w-6" />
            </IconButton>
          </div>
          {steps[index + 1] && <p className="text-center text-sm text-muted">Next: {steps[index + 1].name}</p>}
        </section>
      )}
      <p className="text-center text-xs text-muted">
        Timers run while Steady is open; the screen stays on and your phone vibrates between steps where supported.
      </p>
    </div>
  );
}
