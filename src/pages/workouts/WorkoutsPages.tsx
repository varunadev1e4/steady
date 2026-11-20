import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Dumbbell, Footprints, Play, Plus, Trash2, X } from 'lucide-react';
import {
  useAddCardio,
  useArchiveExercise,
  useCardio,
  useDeleteCardio,
  useDeleteExercise,
  useDeleteTemplate,
  useExerciseHistory,
  useExercises,
  useRecentWorkouts,
  useSaveExercise,
  useSaveTemplate,
  useSetsForWorkouts,
  useTemplateExercises,
  useTemplates,
  useWorkoutsInRange,
} from '@/features/workouts/queries';
import { formatWeight, MUSCLE_LABELS, personalRecords, plannedTemplate, setsPerMuscle, epley1RM } from '@/features/workouts/logic';
import { ExercisePicker } from '@/features/workouts/ExercisePicker';
import { useStart } from '@/features/workouts/useStart';
import { weekStartOf, weekdayOf } from '@/features/habits/streaks';
import { useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import type { Equipment, MuscleGroup, WorkoutTemplateRow } from '@/types/database';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { LinkTabs, IconButton, StatTile } from '@/components/ui/Layout';
import { Sheet } from '@/components/ui/Sheet';
import { SelectField, TextField } from '@/components/ui/Field';
import { CardSkeleton, EmptyState, ErrorState, FormMessage } from '@/components/ui/States';
import { useConfirm, useToast } from '@/components/ui/feedbackContext';
import { BarSeries, ChartCard, LineSeries } from '@/components/charts/Charts';
import { addDaysISO, formatISODate, parseISODate } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { cn } from '@/utils/cn';

const WEEKDAYS = [
  { v: 1, l: 'Mon' },
  { v: 2, l: 'Tue' },
  { v: 3, l: 'Wed' },
  { v: 4, l: 'Thu' },
  { v: 5, l: 'Fri' },
  { v: 6, l: 'Sat' },
  { v: 0, l: 'Sun' },
];
const dayNames = (days: number[]) =>
  days.length ? WEEKDAYS.filter((d) => days.includes(d.v)).map((d) => d.l).join(', ') : 'Not scheduled';

function WorkoutTabs() {
  return (
    <LinkTabs
      label="Workout sections"
      items={[
        { to: '/workouts', label: 'Log', end: true },
        { to: '/workouts/templates', label: 'Templates' },
        { to: '/workouts/exercises', label: 'Exercises' },
        { to: '/workouts/progress', label: 'Progress' },
      ]}
    />
  );
}

/* ------------------------------------------------------------- history -- */

const ACTIVITIES = ['Walk', 'Run', 'Cycle', 'Swim', 'Row', 'Hike', 'Yoga', 'Sport', 'Other'];

function CardioSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { today } = useToday();
  const add = useAddCardio();
  const toast = useToast();
  const [v, setV] = useState({ activity: 'Walk', duration: '30', distance: '', day: today });
  const [err, setErr] = useState<string | null>(null);
  return (
    <Sheet open={open} onClose={onClose} title="Log cardio">
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const duration = Number(v.duration);
          const distance = v.distance ? Number(v.distance) : null;
          if (!Number.isInteger(duration) || duration < 1 || duration > 1440) return setErr('Duration must be 1–1440 minutes.');
          if (distance != null && (Number.isNaN(distance) || distance < 0 || distance > 1000)) return setErr('Distance must be 0–1000 km.');
          setErr(null);
          add.mutate(
            { day: v.day, activity: v.activity, duration_min: duration, distance_km: distance, notes: null },
            {
              onSuccess: () => {
                toast('Cardio logged');
                onClose();
              },
            },
          );
        }}
      >
        <SelectField label="Activity" value={v.activity} onChange={(e) => setV({ ...v, activity: e.target.value })} options={ACTIVITIES.map((a) => ({ value: a, label: a }))} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Minutes" inputMode="numeric" value={v.duration} onChange={(e) => setV({ ...v, duration: e.target.value.replace(/\D/g, '') })} />
          <TextField label="Distance, km (optional)" inputMode="decimal" value={v.distance} onChange={(e) => setV({ ...v, distance: e.target.value.replace(/[^\d.]/g, '') })} />
        </div>
        <TextField label="Date" type="date" max={today} value={v.day} onChange={(e) => e.target.value && setV({ ...v, day: e.target.value })} />
        {(err || add.isError) && <FormMessage tone="error">{err ?? errorMessage(add.error)}</FormMessage>}
        <Button type="submit" loading={add.isPending}>
          Save
        </Button>
      </form>
    </Sheet>
  );
}

export function WorkoutsHistoryPage() {
  const { today, weekStart } = useToday();
  const profile = useLoadedProfile();
  const templates = useTemplates();
  const recent = useRecentWorkouts();
  const cardio = useCardio(addDaysISO(today, -30), today);
  const delCardio = useDeleteCardio();
  const { start, pending } = useStart();
  const [cardioOpen, setCardioOpen] = useState(false);

  const active = (templates.data ?? []).filter((t) => !t.archived_at);
  const planned = plannedTemplate(active, weekdayOf(today));
  const ws = weekStartOf(today, weekStart);
  const thisWeek = (recent.data ?? []).filter((w) => w.day >= ws).length;

  return (
    <>
      <PageHeader title="Workouts" />
      <WorkoutTabs />
      <div className="space-y-4">
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base">Start a workout</h2>
            <span className="text-sm text-muted">
              {thisWeek} this week{profile.weekly_workout_target ? ` · target ${profile.weekly_workout_target}` : ''}
            </span>
          </div>
          {planned && (
            <Button size="lg" block loading={pending} onClick={() => start(planned)}>
              <Play className="h-5 w-5" aria-hidden />
              Start {planned.name} (planned today)
            </Button>
          )}
          <div className="flex flex-wrap gap-2">
            {active
              .filter((t) => t.id !== planned?.id)
              .map((t) => (
                <Button key={t.id} variant="secondary" size="sm" disabled={pending} onClick={() => start(t)}>
                  {t.name}
                </Button>
              ))}
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(null)}>
              Empty workout
            </Button>
          </div>
          {active.length === 0 && (
            <p className="text-sm text-muted">
              New to exercise? Try a <Link to="/plans" className="link">beginner plan</Link>. Or{' '}
              <Link to="/workouts/templates/new" className="link">make a template</Link> (e.g. Push, Pull, Legs) to get previous
              numbers and suggestions prefilled.
            </p>
          )}
        </section>

        <section aria-labelledby="recent-w">
          <h2 id="recent-w" className="mb-2 text-base">
            Recent workouts
          </h2>
          {recent.isPending ? (
            <CardSkeleton />
          ) : recent.isError ? (
            <ErrorState error={recent.error} onRetry={() => void recent.refetch()} />
          ) : recent.data.length === 0 ? (
            <EmptyState icon={Dumbbell} title="No workouts logged yet">
              Start one above. Every set you tick is saved straight away.
            </EmptyState>
          ) : (
            <ul className="card divide-y divide-border py-1">
              {recent.data.map((w) => {
                const mins = w.ended_at ? Math.round((Date.parse(w.ended_at) - Date.parse(w.started_at)) / 60000) : null;
                return (
                  <li key={w.id}>
                    <Link to={`/workouts/log/${w.id}`} className="flex min-h-12 items-center justify-between gap-3 py-2 hover:text-accent-ink">
                      <span className="font-medium">{w.name}</span>
                      <span className="text-sm text-muted">
                        {formatISODate(w.day, profile.date_format)}
                        {mins != null && mins > 0 && mins < 600 ? ` · ${mins} min` : !w.ended_at ? ' · in progress' : ''}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="cardio-h" className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 id="cardio-h" className="text-base">
              Cardio (last 30 days)
            </h2>
            <Button size="sm" variant="secondary" onClick={() => setCardioOpen(true)}>
              <Footprints className="h-4 w-4" aria-hidden />
              Log cardio
            </Button>
          </div>
          <CardioSheet open={cardioOpen} onClose={() => setCardioOpen(false)} />
          {cardio.isError ? (
            <ErrorState error={cardio.error} onRetry={() => void cardio.refetch()} />
          ) : cardio.data && cardio.data.length > 0 ? (
            <ul className="card divide-y divide-border py-1">
              {cardio.data.map((c) => (
                <li key={c.id} className="flex min-h-12 items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{c.activity}</span>{' '}
                    <span className="text-sm text-muted">
                      {c.duration_min} min{c.distance_km != null ? ` · ${Number(c.distance_km)} km` : ''} ·{' '}
                      {formatISODate(c.day, profile.date_format)}
                    </span>
                  </span>
                  <IconButton label="Delete cardio entry" onClick={() => delCardio.mutate(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </li>
              ))}
            </ul>
          ) : (
            !cardio.isPending && <p className="text-sm text-muted">No cardio logged in the last 30 days.</p>
          )}
        </section>
      </div>
    </>
  );
}

/* ----------------------------------------------------------- templates -- */

export function TemplatesPage() {
  const templates = useTemplates();
  const te = useTemplateExercises();
  return (
    <>
      <PageHeader
        title="Workouts"
        actions={
          <Link to="/workouts/templates/new" className={buttonClasses('primary', 'sm')}>
            <Plus className="h-4 w-4" aria-hidden />
            New template
          </Link>
        }
      />
      <WorkoutTabs />
      {templates.isPending ? (
        <CardSkeleton />
      ) : templates.isError ? (
        <ErrorState error={templates.error} onRetry={() => void templates.refetch()} />
      ) : templates.data.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="No templates yet"
          action={
            <Link to="/workouts/templates/new" className={buttonClasses('primary')}>
              Create a template
            </Link>
          }
        >
          A template is a list of exercises with target sets and reps, like Push, Pull or Legs.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {templates.data.map((t) => (
            <li key={t.id}>
              <Link to={`/workouts/templates/${t.id}`} className="card block hover:bg-surface">
                <span className="font-medium">{t.name}</span>
                <span className="block text-sm text-muted">
                  {(te.data ?? []).filter((x) => x.template_id === t.id).length} exercises · {dayNames(t.weekdays)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

interface TplExercise {
  exercise_id: string;
  target_sets: number;
  rep_min: number;
  rep_max: number;
}

function TemplateForm({ template, initial }: { template?: WorkoutTemplateRow; initial: TplExercise[] }) {
  const exercises = useExercises();
  const save = useSaveTemplate();
  const del = useDeleteTemplate();
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(template?.name ?? '');
  const [weekdays, setWeekdays] = useState<number[]>(template?.weekdays ?? []);
  const [list, setList] = useState<TplExercise[]>(initial);
  const [picker, setPicker] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setRow = (i: number, patch: Partial<TplExercise>) => setList((l) => l.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) =>
    setList((l) => {
      const n = [...l];
      const [x] = n.splice(i, 1);
      n.splice(i + d, 0, x);
      return n;
    });

  const submit = () => {
    if (!name.trim()) return setErr('Give the template a name.');
    const bad = list.find((r) => r.rep_min > r.rep_max || r.rep_min < 1 || r.target_sets < 1 || r.target_sets > 10);
    if (bad) return setErr('Check each exercise: 1–10 sets, and the minimum reps must not exceed the maximum.');
    setErr(null);
    save.mutate(
      { id: template?.id, name: name.trim(), notes: template?.notes ?? null, weekdays, exercises: list },
      {
        onSuccess: () => {
          toast('Template saved');
          navigate('/workouts/templates');
        },
      },
    );
  };

  const num = (v: string, fallback: number) => {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? fallback : Math.min(100, Math.max(0, n));
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <TextField label="Name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Push day" />
        <fieldset>
          <legend className="label">Planned days</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const on = weekdays.includes(d.v);
              return (
                <button
                  key={d.v}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setWeekdays(on ? weekdays.filter((x) => x !== d.v) : [...weekdays, d.v])}
                  className={cn('h-10 min-w-12 rounded-input border px-2 text-sm font-medium', on ? 'border-accent bg-accent-soft text-accent-ink' : 'border-border bg-surface text-muted')}
                >
                  {d.l}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-sm text-muted">Today shows this template on these days. Other days show as rest days.</p>
        </fieldset>
      </div>

      {list.map((r, i) => {
        const ex = exercises.data?.find((e) => e.id === r.exercise_id);
        return (
          <div key={`${r.exercise_id}-${i}`} className="card space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{ex?.name ?? 'Exercise'}</span>
              <div className="flex">
                <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </IconButton>
                <IconButton label="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </IconButton>
                <IconButton label="Remove" onClick={() => setList((l) => l.filter((_, j) => j !== i))}>
                  <X className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <TextField label="Sets" inputMode="numeric" value={String(r.target_sets)} onChange={(e) => setRow(i, { target_sets: num(e.target.value, 0) })} />
              <TextField label="Min reps" inputMode="numeric" value={String(r.rep_min)} onChange={(e) => setRow(i, { rep_min: num(e.target.value, 0) })} />
              <TextField label="Max reps" inputMode="numeric" value={String(r.rep_max)} onChange={(e) => setRow(i, { rep_max: num(e.target.value, 0) })} />
            </div>
          </div>
        );
      })}
      <Button variant="secondary" block onClick={() => setPicker(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        Add exercise
      </Button>
      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        exclude={list.map((r) => r.exercise_id)}
        onPick={(id) => setList((l) => [...l, { exercise_id: id, target_sets: 3, rep_min: 8, rep_max: 12 }])}
      />
      {(err || save.isError) && <FormMessage tone="error">{err ?? errorMessage(save.error)}</FormMessage>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={submit} loading={save.isPending}>
          Save template
        </Button>
        {template && (
          <Button
            variant="ghost"
            className="text-danger"
            onClick={async () => {
              const ok = await confirm({
                title: `Delete “${template.name}”?`,
                body: 'Workouts you already logged from it are kept.',
                confirmLabel: 'Delete template',
                danger: true,
              });
              if (ok) del.mutate(template.id, { onSuccess: () => navigate('/workouts/templates') });
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

export function TemplateEditPage() {
  const { id } = useParams();
  const templates = useTemplates();
  const te = useTemplateExercises();
  if (!id || id === 'new') {
    return (
      <>
        <PageHeader title="New template" />
        <TemplateForm initial={[]} />
      </>
    );
  }
  if (templates.isPending || te.isPending) return <CardSkeleton lines={6} />;
  if (templates.isError || te.isError) return <ErrorState error={templates.error ?? te.error} onRetry={() => void templates.refetch()} />;
  const template = templates.data.find((t) => t.id === id);
  if (!template) return <ErrorState error="This template doesn't exist any more." />;
  const initial = te.data
    .filter((x) => x.template_id === id)
    .map((x) => ({ exercise_id: x.exercise_id, target_sets: x.target_sets, rep_min: x.rep_min, rep_max: x.rep_max }));
  return (
    <>
      <PageHeader title="Edit template" />
      <TemplateForm key={id} template={template} initial={initial} />
    </>
  );
}

/* ----------------------------------------------------------- exercises -- */

const MUSCLES = Object.keys(MUSCLE_LABELS) as MuscleGroup[];
const EQUIPMENT: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'other'];

export function ExercisesPage() {
  const exercises = useExercises();
  const saveEx = useSaveExercise();
  const archive = useArchiveExercise();
  const del = useDeleteExercise();
  const confirm = useConfirm();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ name: string; muscle_group: MuscleGroup; equipment: Equipment }>({ name: '', muscle_group: 'chest', equipment: 'dumbbell' });
  const [showArchived, setShowArchived] = useState(false);

  const filtered = (exercises.data ?? []).filter(
    (e) => (showArchived ? e.archived_at : !e.archived_at) && (!q || e.name.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <PageHeader
        title="Workouts"
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Add exercise
          </Button>
        }
      />
      <WorkoutTabs />
      <Sheet open={adding} onClose={() => setAdding(false)} title="New exercise">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim()) return;
            saveEx.mutate(
              { ...form, name: form.name.trim() },
              {
                onSuccess: () => {
                  toast('Exercise added');
                  setForm({ ...form, name: '' });
                  setAdding(false);
                },
              },
            );
          }}
        >
          <TextField label="Name" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Muscle group" value={form.muscle_group} onChange={(e) => setForm({ ...form, muscle_group: e.target.value as MuscleGroup })} options={MUSCLES.map((m) => ({ value: m, label: MUSCLE_LABELS[m] }))} />
            <SelectField label="Equipment" value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value as Equipment })} options={EQUIPMENT.map((m) => ({ value: m, label: m[0].toUpperCase() + m.slice(1) }))} />
          </div>
          {saveEx.isError && (
            <FormMessage tone="error">
              {/duplicate|unique/i.test(errorMessage(saveEx.error)) ? 'You already have an exercise with that name.' : errorMessage(saveEx.error)}
            </FormMessage>
          )}
          <Button type="submit" loading={saveEx.isPending}>
            Save exercise
          </Button>
        </form>
      </Sheet>
      <div className="mb-3 flex gap-2">
        <input type="search" aria-label="Search exercises" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} className="input" />
        <Button variant="ghost" onClick={() => setShowArchived((s) => !s)}>
          {showArchived ? 'Active' : 'Archived'}
        </Button>
      </div>
      {exercises.isPending ? (
        <CardSkeleton />
      ) : exercises.isError ? (
        <ErrorState error={exercises.error} onRetry={() => void exercises.refetch()} />
      ) : filtered.length === 0 ? (
        <p className="card text-center text-muted">{showArchived ? 'No archived exercises.' : 'No exercises match.'}</p>
      ) : (
        <div className="space-y-4">
          {MUSCLES.map((m) => {
            const rows = filtered.filter((e) => e.muscle_group === m);
            if (!rows.length) return null;
            return (
              <section key={m} aria-label={MUSCLE_LABELS[m]}>
                <h2 className="mb-1 text-sm font-semibold text-muted">{MUSCLE_LABELS[m]}</h2>
                <ul className="card divide-y divide-border py-1">
                  {rows.map((e) => (
                    <li key={e.id} className="flex min-h-12 items-center justify-between gap-2">
                      <span>
                        {e.name}
                        <span className="ml-2 text-xs text-muted">{e.equipment}{e.is_custom ? ' · yours' : ''}</span>
                      </span>
                      <span className="flex">
                        <IconButton
                          label={e.archived_at ? 'Restore' : 'Archive'}
                          onClick={() => archive.mutate({ id: e.id, archived: !e.archived_at })}
                        >
                          {e.archived_at ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                        </IconButton>
                        <IconButton
                          label="Delete"
                          onClick={async () => {
                            const ok = await confirm({ title: `Delete “${e.name}”?`, body: 'Exercises with logged sets can only be archived.', confirmLabel: 'Delete', danger: true });
                            if (ok) del.mutate(e.id, { onError: (err) => toast(errorMessage(err), 'error') });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------ progress -- */

export function ProgressPage() {
  const { today, weekStart } = useToday();
  const profile = useLoadedProfile();
  const units = profile.units;
  const firstWeek = weekStartOf(addDaysISO(today, -7 * 7), weekStart);
  const workouts = useWorkoutsInRange(firstWeek, today);
  const exercises = useExercises();
  const ws = weekStartOf(today, weekStart);
  const thisWeekIds = useMemo(() => (workouts.data ?? []).filter((w) => w.day >= ws).map((w) => w.id), [workouts.data, ws]);
  const sets = useSetsForWorkouts(thisWeekIds);
  const [exerciseId, setExerciseId] = useState('');
  const history = useExerciseHistory(exerciseId || undefined);

  const perWeek = useMemo(() => {
    const out: Array<{ x: string; y: number }> = [];
    for (let w = firstWeek; w <= today; w = addDaysISO(w, 7)) {
      const end = addDaysISO(w, 6);
      out.push({ x: format(parseISODate(w), 'd MMM'), y: (workouts.data ?? []).filter((x) => x.day >= w && x.day <= end).length });
    }
    return out;
  }, [workouts.data, firstWeek, today]);

  const muscleData = useMemo(() => {
    const muscleOf = (id: string) => exercises.data?.find((e) => e.id === id)?.muscle_group;
    const counts = setsPerMuscle(sets.data ?? [], muscleOf);
    return (Object.keys(MUSCLE_LABELS) as MuscleGroup[])
      .filter((m) => counts[m])
      .map((m) => ({ x: MUSCLE_LABELS[m], y: counts[m] ?? 0 }));
  }, [sets.data, exercises.data]);

  const pr = history.data ? personalRecords(history.data) : null;
  const e1rmSeries = useMemo(() => {
    const best = new Map<string, number>();
    for (const s of history.data ?? []) best.set(s.day, Math.max(best.get(s.day) ?? 0, epley1RM(s.weight_kg, s.reps)));
    return [...best].map(([day, v]) => ({ x: format(parseISODate(day), 'd MMM'), y: Math.round(Number(formatWeight(v, units)) * 10) / 10 }));
  }, [history.data, units]);

  const used = (exercises.data ?? []).filter((e) => !e.archived_at);

  return (
    <>
      <PageHeader title="Workouts" />
      <WorkoutTabs />
      {workouts.isError ? (
        <ErrorState error={workouts.error} onRetry={() => void workouts.refetch()} />
      ) : (
        <div className="space-y-4">
          <ChartCard
            title="Workouts per week"
            caption={profile.weekly_workout_target ? `Last 8 weeks · your target is ${profile.weekly_workout_target} a week` : 'Last 8 weeks'}
            empty={workouts.isPending || perWeek.every((p) => p.y === 0)}
            emptyText={workouts.isPending ? 'Loading…' : 'No workouts in the last 8 weeks yet.'}
          >
            <BarSeries data={perWeek} label="Workouts per week" format={(v) => `${v} workouts`} />
          </ChartCard>
          <ChartCard
            title="Sets per muscle group this week"
            caption="Completed working sets (warm-ups not counted)"
            empty={muscleData.length === 0}
            emptyText="No completed sets this week yet."
          >
            <BarSeries data={muscleData} label="Sets per muscle group" format={(v) => `${v} sets`} tone="second" />
          </ChartCard>

          <section className="card space-y-4">
            <h2 className="text-base">Personal records</h2>
            <SelectField
              label="Exercise"
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
              options={[{ value: '', label: 'Choose an exercise' }, ...used.map((e) => ({ value: e.id, label: e.name }))]}
            />
            {exerciseId && history.isPending && <p className="text-muted">Loading…</p>}
            {history.isError && <ErrorState error={history.error} onRetry={() => void history.refetch()} />}
            {exerciseId && history.data && (history.data.length === 0 ? (
              <p className="text-muted">No completed sets for this exercise yet.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <StatTile
                    label="Heaviest set"
                    value={pr?.heaviest ? `${formatWeight(pr.heaviest.weight_kg, units)} ${units}` : '–'}
                    hint={pr?.heaviest ? `${pr.heaviest.reps} reps · ${formatISODate(pr.heaviest.day, profile.date_format)}` : undefined}
                  />
                  <StatTile
                    label="Best estimated 1RM"
                    value={pr?.best1RM ? `${formatWeight(pr.best1RM.value_kg, units)} ${units}` : '–'}
                    hint={pr?.best1RM ? `${formatWeight(pr.best1RM.weight_kg, units)}×${pr.best1RM.reps} · ${formatISODate(pr.best1RM.day, profile.date_format)}` : undefined}
                  />
                </div>
                {e1rmSeries.length >= 2 && (
                  <div>
                    <p className="mb-1 text-sm text-muted">Best estimated 1RM per session ({units}, Epley formula)</p>
                    <LineSeries data={e1rmSeries} label="Estimated one-rep max over time" format={(v) => `${v} ${units}`} />
                  </div>
                )}
              </>
            ))}
          </section>
        </div>
      )}
    </>
  );
}
