import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ArrowLeft, ClipboardList, Cookie, PenLine, Sparkles, Timer, Trash2, Wind } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  useActivities,
  useAddAssessment,
  useAssessments,
  useCravings,
  useDeleteActivity,
  useDeleteAssessment,
  useDeleteCraving,
  useSaveActivity,
  useSaveCraving,
} from '@/features/mind/queries';
import { ACTIVITY_IDEAS, CATEGORIES, categoryLabel, liftByCategory, topActivities, type ActivityCategory } from '@/features/mind/activities';
import {
  ANSWER_OPTIONS,
  ASSESSMENTS,
  ATTRIBUTION,
  CHECK_INTERVAL_DAYS,
  DIFFICULTY_OPTIONS,
  DIFFICULTY_QUESTION,
  needsSafetySupport,
  severity,
  STEM,
  type AssessmentKind,
} from '@/features/mind/assessments';
import { OUTCOMES, TRIGGERS, WAIT_IDEAS, outcomeLabel, summarise, triggerLabel, type CravingOutcome, type CravingTrigger } from '@/features/mind/cravings';
import { MoodSlider } from '@/features/mind/components';
import { SupportCard } from '@/features/medications/components';
import { daysBetween } from '@/features/habits/streaks';
import { formatDuration } from '@/features/plans/logic';
import { useWakeLock } from '@/lib/wakeLock';
import { useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import type { ActivityRow, AssessmentRow, CravingRow } from '@/types/database';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Chip, RatingPicker } from '@/components/ui/Controls';
import { SelectField, TextField } from '@/components/ui/Field';
import { IconButton, IconChip, type Tone } from '@/components/ui/Layout';
import { Sheet } from '@/components/ui/Sheet';
import { CardSkeleton, EmptyState, ErrorState, FormMessage } from '@/components/ui/States';
import { useConfirm, useToast } from '@/components/ui/feedbackContext';
import { ChartCard, LineSeries } from '@/components/charts/Charts';
import { addDaysISO, formatISODate, parseISODate } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { cn } from '@/utils/cn';

function Back() {
  return (
    <Link to="/mind" className="mb-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Mind
    </Link>
  );
}

/* ------------------------------------------------------------------ hub -- */

function HubCard({ to, icon, title, text, tone = 'violet' }: { to: string; icon: LucideIcon; title: string; text: string; tone?: Tone }) {
  return (
    <Link to={to} className="card card-link flex items-center gap-4">
      <IconChip icon={icon} tone={tone} size="lg" />
      <span>
        <span className="font-semibold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
    </Link>
  );
}

function MindHome() {
  const { today } = useToday();
  const assessments = useAssessments();
  const activities = useActivities(today, today);
  const last = (k: AssessmentKind) => assessments.data?.find((a) => a.kind === k);
  const checkText = (() => {
    const p = last('phq9');
    const g = last('gad7');
    if (!p && !g) return 'Two short standard questionnaires, about 3 minutes, once a month';
    const latest = [p, g].filter(Boolean).sort((a, b) => b!.day.localeCompare(a!.day))[0]!;
    const since = daysBetween(latest.day, today);
    return since >= CHECK_INTERVAL_DAYS ? `Due: last done ${since} days ago` : `Last done ${formatISODate(latest.day, 'd MMM')} · next in ${CHECK_INTERVAL_DAYS - since} days`;
  })();
  const planned = (activities.data ?? []).filter((a) => a.status === 'planned').length;
  return (
    <>
      <PageHeader title="Mind" description="Small, practical tools for low mood and anxiety. They support, not replace, care from your prescriber or therapist." />
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        <HubCard to="/mind/activities" icon={Sparkles} tone="yellow" title="Mood-lifting activities" text={planned ? `${planned} planned for today` : 'Plan one small thing and notice how it affects your mood'} />
        <HubCard to="/mind/check" icon={ClipboardList} tone="blue" title="Monthly check (PHQ-9 and GAD-7)" text={checkText} />
        <HubCard to="/mind/cravings" icon={Cookie} tone="orange" title="Cravings" text="Notice what's behind them, and wait 10 minutes before deciding" />
        <HubCard to="/breathe" icon={Wind} tone="green" title="Breathe" text="A few minutes of slow breathing" />
        <HubCard to="/journal/write?type=thought_record" icon={PenLine} tone="violet" title="Thought record" text="Look at a difficult thought step by step" />
        <div className="lg:col-span-2">
          <SupportCard />
        </div>
      </div>
    </>
  );
}

export function MindPage() {
  return (
    <>
      <MindHome />
    </>
  );
}

/* ----------------------------------------------------------- activities -- */

function PlanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { today } = useToday();
  const save = useSaveActivity();
  const toast = useToast();
  const [cat, setCat] = useState<ActivityCategory>('pleasure');
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(today);
  const [time, setTime] = useState('');
  const [before, setBefore] = useState<number | null>(null);
  return (
    <Sheet open={open} onClose={onClose} title="Plan something small" description="Small and specific works best: “10-minute walk after lunch”, not “exercise more”.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          save.mutate(
            { input: { title: title.trim(), category: cat, day, planned_time: time || null, mood_before: before } },
            {
              onSuccess: () => {
                toast('Planned');
                setTitle('');
                setBefore(null);
                onClose();
              },
            },
          );
        }}
      >
        <SelectField label="Kind" value={cat} onChange={(e) => setCat(e.target.value as ActivityCategory)} options={CATEGORIES} />
        {cat !== 'other' && (
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_IDEAS[cat].map((idea) => (
              <Chip key={idea} active={title === idea} onClick={() => setTitle(idea)}>
                {idea}
              </Chip>
            ))}
          </div>
        )}
        <TextField label="Activity" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Or write your own" />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Day" type="date" min={today} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
          <TextField label="Time (optional)" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <MoodSlider label="Mood right now (optional)" value={before} onChange={setBefore} />
        {save.isError && <FormMessage tone="error">{errorMessage(save.error)}</FormMessage>}
        <Button type="submit" loading={save.isPending} disabled={!title.trim()}>
          Plan it
        </Button>
      </form>
    </Sheet>
  );
}

function DoneSheet({ activity, onClose }: { activity: ActivityRow | null; onClose: () => void }) {
  const save = useSaveActivity();
  const toast = useToast();
  const [before, setBefore] = useState<number | null>(activity?.mood_before ?? null);
  const [after, setAfter] = useState<number | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => {
    setBefore(activity?.mood_before ?? null);
    setAfter(null);
    setNote('');
  }, [activity]);
  return (
    <Sheet open={activity != null} onClose={onClose} title={activity ? `Done: ${activity.title}` : ''} description="How was it? Rough numbers are fine.">
      {activity && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              { id: activity.id, input: { status: 'done', mood_before: before, mood_after: after, note: note.trim() || null, completed_at: new Date().toISOString() } },
              {
                onSuccess: () => {
                  toast(after != null && before != null && after > before ? 'Nice. That helped.' : 'Done. Well done for doing it.');
                  onClose();
                },
              },
            );
          }}
        >
          <MoodSlider label="Mood before" value={before} onChange={setBefore} />
          <MoodSlider label="Mood after" value={after} onChange={setAfter} />
          <TextField label="Note (optional)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          {save.isError && <FormMessage tone="error">{errorMessage(save.error)}</FormMessage>}
          <Button type="submit" loading={save.isPending}>
            Save
          </Button>
        </form>
      )}
    </Sheet>
  );
}

function ActivitiesHome() {
  const { today } = useToday();
  const profile = useLoadedProfile();
  const range = useActivities(addDaysISO(today, -60), addDaysISO(today, 7));
  const save = useSaveActivity();
  const del = useDeleteActivity();
  const [planning, setPlanning] = useState(false);
  const [doing, setDoing] = useState<ActivityRow | null>(null);
  const all = range.data ?? [];
  const todays = all.filter((a) => a.day === today);
  const upcoming = all.filter((a) => a.day > today && a.status === 'planned');
  const missed = all.filter((a) => a.day < today && a.status === 'planned' && a.day >= addDaysISO(today, -3));
  const done = all.filter((a) => a.status === 'done').reverse();
  const byCat = liftByCategory(all);
  const top = topActivities(all);

  const row = (a: ActivityRow) => (
    <li key={a.id} className="flex items-center gap-2 py-2">
      <span className="min-w-0 flex-1">
        <span className={cn('block font-medium', a.status !== 'planned' && 'text-muted', a.status === 'done' && 'line-through')}>{a.title}</span>
        <span className="text-xs text-muted">
          {a.day !== today && `${formatISODate(a.day, 'EEE d MMM')} · `}
          {a.planned_time ? `${a.planned_time.slice(0, 5)} · ` : ''}
          {categoryLabel(a.category)}
          {a.status === 'done' && a.mood_before != null && a.mood_after != null && ` · mood ${a.mood_before} → ${a.mood_after}`}
          {a.status === 'skipped' && ' · skipped'}
        </span>
      </span>
      {a.status === 'planned' && (
        <>
          <Button size="sm" variant="ghost" onClick={() => save.mutate({ id: a.id, input: { status: 'skipped' } })}>
            Skip
          </Button>
          <Button size="sm" onClick={() => setDoing(a)}>
            Done
          </Button>
        </>
      )}
      <IconButton label={`Delete ${a.title}`} onClick={() => del.mutate(a.id)}>
        <Trash2 className="h-4 w-4" />
      </IconButton>
    </li>
  );

  return (
    <>
      <Back />
      <PageHeader title="Mood-lifting activities" description="When mood is low, doing comes before feeling better. Plan small things, then notice what helps." actions={<Button size="sm" onClick={() => setPlanning(true)}>Plan</Button>} />
      <PlanSheet open={planning} onClose={() => setPlanning(false)} />
      <DoneSheet activity={doing} onClose={() => setDoing(null)} />
      {range.isPending ? (
        <CardSkeleton />
      ) : range.isError ? (
        <ErrorState error={range.error} onRetry={() => void range.refetch()} />
      ) : (
        <div className="space-y-4">
          <section className="card">
            <h2 className="text-base">Today</h2>
            {todays.length ? <ul className="divide-y divide-border">{todays.map(row)}</ul> : <p className="mt-1 text-sm text-muted">Nothing planned yet. One small thing is plenty.</p>}
          </section>
          {missed.length > 0 && (
            <section className="card">
              <h2 className="text-base">From the last few days</h2>
              <p className="text-sm text-muted">Did any of these happen after all? No problem if not.</p>
              <ul className="divide-y divide-border">{missed.map(row)}</ul>
            </section>
          )}
          {upcoming.length > 0 && (
            <section className="card">
              <h2 className="text-base">Coming up</h2>
              <ul className="divide-y divide-border">{upcoming.map(row)}</ul>
            </section>
          )}
          <section className="card space-y-2">
            <h2 className="text-base">What seems to help</h2>
            <p className="text-xs text-muted">Average change in mood (after minus before), from the last 60 days. A pattern in your data, not proof of cause.</p>
            {byCat.length === 0 ? (
              <p className="text-sm text-muted">Rate your mood before and after a few activities to see patterns here.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {byCat.map((c) => (
                  <li key={c.key} className="flex justify-between">
                    <span>{c.label}</span>
                    <span className="tabular-nums text-muted">{c.lift == null ? `${c.n} rated (need 3)` : `${c.lift > 0 ? '+' : ''}${c.lift} · ${c.n} times`}</span>
                  </li>
                ))}
              </ul>
            )}
            {top.length > 0 && <p className="text-sm">Your best so far: {top.map((t) => `${t.label} (+${t.lift})`).join(', ')}.</p>}
          </section>
          {done.length > 0 && (
            <details className="card">
              <summary className="cursor-pointer font-medium">Done recently ({done.length})</summary>
              <ul className="mt-2 divide-y divide-border">{done.slice(0, 20).map(row)}</ul>
            </details>
          )}
          <p className="text-center text-xs text-muted">Based on behavioural activation, a well-studied approach for depression. {profile.display_name ? `${profile.display_name}, ` : ''}be kind to yourself on the hard days.</p>
        </div>
      )}
    </>
  );
}

export function ActivitiesPage() {
  return (
    <>
      <ActivitiesHome />
    </>
  );
}

/* --------------------------------------------------------- monthly check -- */

function Questionnaire({ kind, onDone }: { kind: AssessmentKind; onDone: (row: AssessmentRow) => void }) {
  const { today } = useToday();
  const add = useAddAssessment();
  const def = ASSESSMENTS[kind];
  const [answers, setAnswers] = useState<Array<number | null>>(() => def.items.map(() => null));
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const complete = answers.every((a) => a != null);
  const anyProblems = answers.some((a) => (a ?? 0) > 0);
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!complete) return;
        add.mutate({ kind, day: today, answers: answers as number[], difficulty: anyProblems ? difficulty : null }, { onSuccess: onDone });
      }}
    >
      <div>
        <h2 className="text-lg">{def.name}</h2>
        <p className="text-sm text-muted">{STEM}</p>
      </div>
      {def.items.map((item, i) => (
        <fieldset key={item} className="space-y-2">
          <legend className="font-medium">
            {i + 1}. {item}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {ANSWER_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={answers[i] === o.value}
                onClick={() => setAnswers(answers.map((a, j) => (j === i ? o.value : a)))}
                className={cn(
                  'min-h-11 rounded-input border px-3 text-left text-sm transition-colors',
                  answers[i] === o.value ? 'border-accent bg-accent-soft text-accent-ink' : 'border-border bg-surface hover:bg-panel',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          {kind === 'phq9' && i === 8 && needsSafetySupport(kind, answers) && (
            <div className="space-y-2" role="alert">
              <p className="text-sm font-medium">Thank you for answering honestly. You deserve support with this, today if you can.</p>
              <SupportCard compact />
            </div>
          )}
        </fieldset>
      ))}
      {anyProblems && (
        <fieldset className="space-y-2">
          <legend className="font-medium">{DIFFICULTY_QUESTION}</legend>
          <div className="grid grid-cols-2 gap-2">
            {DIFFICULTY_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={difficulty === o.value}
                onClick={() => setDifficulty(o.value)}
                className={cn('min-h-11 rounded-input border px-3 text-left text-sm', difficulty === o.value ? 'border-accent bg-accent-soft text-accent-ink' : 'border-border bg-surface hover:bg-panel')}
              >
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {add.isError && <FormMessage tone="error">{errorMessage(add.error)}</FormMessage>}
      <Button type="submit" size="lg" disabled={!complete} loading={add.isPending}>
        {complete ? 'See my score' : `Answer all ${def.items.length} questions`}
      </Button>
    </form>
  );
}

function Result({ row, onNext, hasNext }: { row: AssessmentRow; onNext: () => void; hasNext: boolean }) {
  const def = ASSESSMENTS[row.kind];
  const sev = severity(row.kind, row.score);
  const safety = needsSafetySupport(row.kind, row.answers);
  return (
    <div className="space-y-4">
      <section className="card text-center">
        <p className="text-sm text-muted">{def.name}</p>
        <p className="mt-1 text-4xl font-semibold tabular-nums">
          {row.score}
          <span className="text-lg font-normal text-muted"> / {def.max}</span>
        </p>
        <p className="mt-1 font-medium">{sev} range</p>
        <p className="mt-2 text-sm text-muted">
          This describes the last two weeks. It isn't a diagnosis. It's most useful as a trend to share with your prescriber or therapist.
          {['Moderate', 'Moderately severe', 'Severe'].includes(sev) && ' At this level it’s worth talking to them soon, if you haven’t recently.'}
        </p>
      </section>
      {safety && <SupportCard />}
      <Button size="lg" block onClick={onNext}>
        {hasNext ? 'Continue to the next questionnaire' : 'Done'}
      </Button>
    </div>
  );
}

function CheckHome() {
  const { today } = useToday();
  const profile = useLoadedProfile();
  const assessments = useAssessments();
  const del = useDeleteAssessment();
  const confirm = useConfirm();
  const [queue, setQueue] = useState<AssessmentKind[]>([]);
  const [result, setResult] = useState<AssessmentRow | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const start = (kinds: AssessmentKind[]) => {
    setResult(null);
    setQueue(kinds);
    top.current?.scrollIntoView();
  };

  if (queue.length > 0) {
    return (
      <div ref={top}>
        <Back />
        {result ? (
          <Result
            row={result}
            hasNext={queue.length > 1}
            onNext={() => {
              setResult(null);
              setQueue(queue.slice(1));
              window.scrollTo(0, 0);
            }}
          />
        ) : (
          <Questionnaire
            key={queue[0]}
            kind={queue[0]}
            onDone={(row) => {
              setResult(row);
              window.scrollTo(0, 0);
            }}
          />
        )}
        <p className="mt-6 text-xs text-muted">{ATTRIBUTION}</p>
      </div>
    );
  }

  const rows = assessments.data ?? [];
  return (
    <div ref={top}>
      <Back />
      <PageHeader title="Monthly check" description="The PHQ-9 (mood) and GAD-7 (anxiety) are short questionnaires doctors use. Once a month shows your trend." />
      {assessments.isPending ? (
        <CardSkeleton />
      ) : assessments.isError ? (
        <ErrorState error={assessments.error} onRetry={() => void assessments.refetch()} />
      ) : (
        <div className="space-y-4">
          <section className="card space-y-3">
            {(['phq9', 'gad7'] as AssessmentKind[]).map((k) => {
              const last = rows.find((r) => r.kind === k);
              const since = last ? daysBetween(last.day, today) : null;
              return (
                <div key={k} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{ASSESSMENTS[k].name}</p>
                    <p className="text-sm text-muted">
                      {last ? `${last.score} (${severity(k, last.score).toLowerCase()}) on ${formatISODate(last.day, profile.date_format)}` : 'Not done yet'}
                      {since != null && since >= CHECK_INTERVAL_DAYS && ' · due'}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => start([k])}>
                    Start
                  </Button>
                </div>
              );
            })}
            <Button block onClick={() => start(['phq9', 'gad7'])}>
              Do both (about 3 minutes)
            </Button>
          </section>
          {(['phq9', 'gad7'] as AssessmentKind[]).map((k) => {
            const series = rows
              .filter((r) => r.kind === k)
              .slice()
              .reverse()
              .map((r) => ({ x: format(parseISODate(r.day), 'd MMM yy'), y: r.score }));
            return (
              <ChartCard key={k} title={`${ASSESSMENTS[k].name} over time`} caption={`Lower is better · 0–${ASSESSMENTS[k].max}`} empty={series.length < 2} emptyText="Two or more checks will show a trend.">
                <LineSeries data={series} label={`${ASSESSMENTS[k].name} scores over time`} domain={[0, ASSESSMENTS[k].max]} />
              </ChartCard>
            );
          })}
          {rows.length > 0 && (
            <ul className="card divide-y divide-border py-1">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="text-sm">
                    <span className="font-medium">{ASSESSMENTS[r.kind].name}</span>{' '}
                    <span className="text-muted">
                      {formatISODate(r.day, profile.date_format)} · {r.score} ({severity(r.kind, r.score).toLowerCase()})
                    </span>
                  </span>
                  <IconButton
                    label="Delete this result"
                    onClick={async () => {
                      if (await confirm({ title: 'Delete this result?', confirmLabel: 'Delete', danger: true })) del.mutate(r.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          <SupportCard />
          <p className="text-xs text-muted">{ATTRIBUTION}</p>
        </div>
      )}
    </div>
  );
}

export function CheckPage() {
  return (
    <>
      <CheckHome />
    </>
  );
}

/* --------------------------------------------------------------- cravings -- */

const WAIT_SECONDS = 600;

function CravingFlow() {
  const { today } = useToday();
  const save = useSaveCraving();
  const toast = useToast();
  const [trigger, setTrigger] = useState<CravingTrigger | null>(null);
  const [intensity, setIntensity] = useState<number | null>(null);
  const [food, setFood] = useState('');
  const [stage, setStage] = useState<'start' | 'waiting' | 'outcome'>('start');
  const [row, setRow] = useState<CravingRow | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [after, setAfter] = useState<number | null>(null);
  useWakeLock(stage === 'waiting');

  useEffect(() => {
    if (stage !== 'waiting') return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [stage]);
  const elapsed = startedAt ? Math.floor((now - startedAt) / 1000) : 0;
  const left = Math.max(0, WAIT_SECONDS - elapsed);
  useEffect(() => {
    if (stage === 'waiting' && left === 0) {
      navigator.vibrate?.(300);
      setStage('outcome');
    }
  }, [stage, left]);

  const reset = () => {
    setTrigger(null);
    setIntensity(null);
    setFood('');
    setStage('start');
    setRow(null);
    setStartedAt(null);
    setAfter(null);
  };

  const create = (thenWait: boolean) => {
    if (!trigger || !intensity) return;
    save.mutate(
      { input: { day: today, trigger, intensity, food: food.trim() || null } },
      {
        onSuccess: (r) => {
          setRow(r);
          if (thenWait) {
            setStartedAt(Date.now());
            setNow(Date.now());
            setStage('waiting');
          } else setStage('outcome');
        },
      },
    );
  };

  const finish = (outcome: CravingOutcome) => {
    if (!row) return;
    save.mutate(
      { id: row.id, input: { outcome, intensity_after: after, waited_minutes: startedAt ? Math.round(elapsed / 60) : null } },
      {
        onSuccess: () => {
          toast(outcome === 'ate_more' ? 'Logged. Noticing is the first step; no judgement.' : 'Logged. Nice work noticing.');
          reset();
        },
      },
    );
  };

  if (stage === 'waiting' && trigger) {
    return (
      <section className="card space-y-4 text-center" aria-live="polite">
        <Timer className="mx-auto h-6 w-6 text-accent-ink" aria-hidden />
        <p className="text-5xl font-semibold tabular-nums">{formatDuration(left)}</p>
        <p className="text-sm">{WAIT_IDEAS[trigger]}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link to="/breathe" className={buttonClasses('secondary', 'sm')}>
            Breathe while you wait
          </Link>
          <Button size="sm" variant="ghost" onClick={() => setStage('outcome')}>
            I'm ready to decide
          </Button>
        </div>
      </section>
    );
  }

  if (stage === 'outcome') {
    return (
      <section className="card space-y-4">
        <h2 className="text-base">How did it go?</h2>
        <RatingPicker label="How strong is the craving now? (optional)" value={after} onChange={setAfter} lowLabel="Gone" highLabel="Very strong" />
        <div className="grid gap-2">
          {OUTCOMES.map((o) => (
            <Button key={o.value} variant="secondary" disabled={save.isPending} onClick={() => finish(o.value)}>
              {o.label}
            </Button>
          ))}
        </div>
        {save.isError && <FormMessage tone="error">{errorMessage(save.error)}</FormMessage>}
      </section>
    );
  }

  return (
    <section className="card space-y-4">
      <h2 className="text-base">Having a craving?</h2>
      <div>
        <p className="label">What's behind it?</p>
        <div className="flex flex-wrap gap-2">
          {TRIGGERS.map((t) => (
            <Chip key={t.value} active={trigger === t.value} onClick={() => setTrigger(t.value)}>
              {t.label}
            </Chip>
          ))}
        </div>
      </div>
      <RatingPicker label="How strong?" value={intensity} onChange={setIntensity} lowLabel="Mild" highLabel="Very strong" allowClear={false} />
      <TextField label="What do you want to eat? (optional)" maxLength={120} value={food} onChange={(e) => setFood(e.target.value)} />
      {save.isError && <FormMessage tone="error">{errorMessage(save.error)}</FormMessage>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={!trigger || !intensity} loading={save.isPending} onClick={() => create(true)}>
          <Timer className="h-4 w-4" aria-hidden />
          Wait 10 minutes first
        </Button>
        <Button variant="ghost" disabled={!trigger || !intensity || save.isPending} onClick={() => create(false)}>
          Just log it
        </Button>
      </div>
      <p className="text-xs text-muted">Cravings usually rise and fall like a wave within 10–20 minutes. Waiting isn't a test; it gives you room to choose.</p>
    </section>
  );
}

function CravingsHome() {
  const { today, tz } = useToday();
  const profile = useLoadedProfile();
  const cravings = useCravings(addDaysISO(today, -29));
  const save = useSaveCraving();
  const del = useDeleteCraving();
  const items = useMemo(() => cravings.data ?? [], [cravings.data]);
  const s = useMemo(() => summarise(items, (iso) => Number(formatInTimeZone(new Date(iso), tz, 'H'))), [items, tz]);
  const pending = items.filter((c) => !c.outcome);

  return (
    <>
      <Back />
      <PageHeader title="Cravings" description="No rules, no guilt. Just noticing what's behind a craving, and giving yourself a moment to choose." />
      <div className="space-y-4">
        <CravingFlow />
        {pending.length > 0 && (
          <section className="card">
            <h2 className="text-base">How did these end?</h2>
            <ul className="mt-2 space-y-3">
              {pending.map((c) => (
                <li key={c.id}>
                  <p className="text-sm">
                    {formatInTimeZone(new Date(c.logged_at), tz, 'EEE h:mm a')} · {triggerLabel(c.trigger)}
                    {c.food && ` · ${c.food}`}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {OUTCOMES.map((o) => (
                      <Chip key={o.value} active={false} onClick={() => save.mutate({ id: c.id, input: { outcome: o.value } })}>
                        {o.label}
                      </Chip>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {cravings.isError ? (
          <ErrorState error={cravings.error} onRetry={() => void cravings.refetch()} />
        ) : items.length === 0 ? (
          !cravings.isPending && (
            <EmptyState icon={Cookie} title="Nothing logged yet">
              Next time a craving shows up, log it here. Patterns appear after a week or two.
            </EmptyState>
          )
        ) : (
          <>
            <section className="card space-y-2">
              <h2 className="text-base">Last 30 days</h2>
              <p className="text-sm">
                {s.total} craving{s.total === 1 ? '' : 's'} logged.
                {s.byTrigger[0] && ` Most often: ${triggerLabel(s.byTrigger[0][0]).toLowerCase()} (${s.byTrigger[0][1]}).`}
                {s.byTime[0] && ` Usually in the ${s.byTime[0][0]}.`}
                {s.managedPercent != null && ` Handled the way you wanted ${s.managedPercent}% of the time.`}
              </p>
              <ul className="flex flex-wrap gap-2 text-xs">
                {s.byTrigger.map(([t, n]) => (
                  <li key={t} className="rounded-full bg-surface px-2.5 py-1 text-muted">
                    {triggerLabel(t)}: {n}
                  </li>
                ))}
              </ul>
              {s.byTrigger[0] && ['stressed', 'sad', 'bored', 'tired'].includes(s.byTrigger[0][0]) && (
                <p className="text-sm text-muted">Tip: {WAIT_IDEAS[s.byTrigger[0][0] as CravingTrigger]}</p>
              )}
            </section>
            <details className="card">
              <summary className="cursor-pointer font-medium">All entries</summary>
              <ul className="mt-2 divide-y divide-border">
                {items.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-2 py-2 text-sm">
                    <span>
                      <span className="text-xs text-muted">{formatISODate(c.day, profile.date_format)} · {formatInTimeZone(new Date(c.logged_at), tz, 'h:mm a')}</span>
                      <span className="block">
                        {triggerLabel(c.trigger)} · strength {c.intensity}
                        {c.intensity_after != null && ` → ${c.intensity_after}`}
                        {c.food && ` · ${c.food}`}
                        {c.outcome && ` · ${outcomeLabel(c.outcome)}`}
                        {c.waited_minutes ? ` · waited ${c.waited_minutes} min` : ''}
                      </span>
                    </span>
                    <IconButton label="Delete entry" onClick={() => del.mutate(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </div>
    </>
  );
}

export function CravingsPage() {
  return (
    <>
      <CravingsHome />
    </>
  );
}

