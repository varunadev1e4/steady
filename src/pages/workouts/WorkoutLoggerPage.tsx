import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Lightbulb, Plus, Trash2, X } from 'lucide-react';
import {
  saveWorkout,
  useDeleteWorkout,
  useExercises,
  useLastSets,
  useTemplateExercises,
  useWorkout,
  workoutKeys,
  type SetInput,
} from '@/features/workouts/queries';
import { formatWeight, overloadSuggestion, toKg, MUSCLE_LABELS } from '@/features/workouts/logic';
import { ExercisePicker } from '@/features/workouts/ExercisePicker';
import { RestTimer } from '@/features/workouts/RestTimer';
import { useLoadedProfile } from '@/features/profile/queries';
import type { LastSetRow, WorkoutRow, WorkoutSetRow, TemplateExerciseRow } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/Layout';
import { CardSkeleton, ErrorState, FormMessage } from '@/components/ui/States';
import { useConfirm, useToast } from '@/components/ui/feedbackContext';
import { errorMessage } from '@/utils/errors';
import { formatISODate } from '@/utils/dates';
import { cn } from '@/utils/cn';

interface LogSet {
  weight: string; // in the user's unit, as typed
  reps: string;
  done: boolean;
  warmup: boolean;
}
interface LogExercise {
  exercise_id: string;
  rep_min: number | null;
  rep_max: number | null;
  sets: LogSet[];
}

const DEFAULT_REST_S = 90;

function buildFromSaved(sets: WorkoutSetRow[], units: 'kg' | 'lb', ranges: Map<string, TemplateExerciseRow>): LogExercise[] {
  const out: LogExercise[] = [];
  for (const s of sets) {
    let ex = out.find((e) => e.exercise_id === s.exercise_id);
    if (!ex) {
      const r = ranges.get(s.exercise_id);
      ex = { exercise_id: s.exercise_id, rep_min: r?.rep_min ?? null, rep_max: r?.rep_max ?? null, sets: [] };
      out.push(ex);
    }
    ex.sets.push({
      weight: Number(s.weight_kg) ? formatWeight(Number(s.weight_kg), units) : '',
      reps: s.reps ? String(s.reps) : '',
      done: s.completed,
      warmup: s.is_warmup,
    });
  }
  return out;
}

function prefill(
  exerciseId: string,
  last: LastSetRow[],
  units: 'kg' | 'lb',
  target?: TemplateExerciseRow,
): LogExercise {
  const prev = last.filter((l) => l.exercise_id === exerciseId);
  const count = Math.max(target?.target_sets ?? 0, prev.length, 1);
  const sets: LogSet[] = Array.from({ length: count }, (_, i) => {
    const p = prev[i] ?? prev[prev.length - 1];
    return {
      weight: p && Number(p.weight_kg) ? formatWeight(Number(p.weight_kg), units) : '',
      reps: p ? String(p.reps) : target ? String(target.rep_max) : '',
      done: false,
      warmup: false,
    };
  });
  return { exercise_id: exerciseId, rep_min: target?.rep_min ?? null, rep_max: target?.rep_max ?? null, sets };
}

function Logger({ workout, initial, templateRows }: { workout: WorkoutRow; initial: WorkoutSetRow[]; templateRows: TemplateExerciseRow[] }) {
  const profile = useLoadedProfile();
  const units = profile.units;
  const exercises = useExercises();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const del = useDeleteWorkout();
  const ranges = useMemo(() => new Map(templateRows.map((t) => [t.exercise_id, t])), [templateRows]);

  const planIds = useMemo(
    () => (initial.length ? [...new Set(initial.map((s) => s.exercise_id))] : templateRows.map((t) => t.exercise_id)),
    [initial, templateRows],
  );
  const last = useLastSets(planIds, workout.id);
  const [items, setItems] = useState<LogExercise[] | null>(initial.length ? buildFromSaved(initial, units, ranges) : null);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const extraLast = useLastSets(extraIds, workout.id);
  const [picker, setPicker] = useState(false);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [status, setStatus] = useState<'saved' | 'pending' | 'saving' | 'error'>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);

  // First open of a template workout: build the plan once previous numbers are in.
  useEffect(() => {
    if (items !== null) return;
    if (planIds.length && last.isPending) return;
    setItems(templateRows.map((t) => prefill(t.exercise_id, last.data ?? [], units, t)));
  }, [items, planIds.length, last.isPending, last.data, templateRows, units]);

  const latest = useRef(items);
  latest.current = items;
  const timer = useRef<number | undefined>(undefined);
  const saving = useRef(false);
  const dirty = useRef(false);

  const toSets = (list: LogExercise[]): SetInput[] =>
    list.flatMap((e, ei) =>
      e.sets.map((s, si) => ({
        exercise_id: e.exercise_id,
        exercise_position: ei,
        set_number: si + 1,
        weight_kg: s.weight ? Math.round(toKg(Number(s.weight), units) * 1000) / 1000 : 0,
        reps: s.reps ? Math.round(Number(s.reps)) : 0,
        is_warmup: s.warmup,
        completed: s.done,
      })),
    );

  const save = useCallback(
    async (extra: Partial<WorkoutRow> = {}) => {
      window.clearTimeout(timer.current);
      if (saving.current) {
        dirty.current = true;
        return;
      }
      const list = latest.current;
      if (!list) return;
      saving.current = true;
      dirty.current = false;
      setStatus('saving');
      try {
        await saveWorkout({ id: workout.id, ended_at: workout.ended_at, notes: workout.notes, ...extra }, toSets(list));
        setStatus(dirty.current ? 'pending' : 'saved');
        setSaveError(null);
      } catch (e) {
        dirty.current = true;
        setStatus('error');
        setSaveError(errorMessage(e));
      } finally {
        saving.current = false;
        if (dirty.current) timer.current = window.setTimeout(() => void save(), 1500);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workout.id, workout.ended_at, workout.notes, units],
  );

  useEffect(() => {
    return () => {
      if (dirty.current) void save();
      void qc.invalidateQueries({ queryKey: workoutKeys.workouts });
    };
  }, [save, qc]);

  const mutate = (fn: (list: LogExercise[]) => LogExercise[]) => {
    setItems((cur) => {
      const next = fn(cur ?? []);
      latest.current = next;
      return next;
    });
    dirty.current = true;
    setStatus('pending');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), 1500);
  };

  const updateSet = (ei: number, si: number, patch: Partial<LogSet>) =>
    mutate((list) => list.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) })));

  // When an exercise is added mid-workout, prefill it once its history loads.
  useEffect(() => {
    if (!extraIds.length || extraLast.isPending) return;
    const ids = extraIds;
    setExtraIds([]);
    mutate((list) => [...list, ...ids.filter((id) => !list.some((e) => e.exercise_id === id)).map((id) => prefill(id, extraLast.data ?? [], units))]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraIds, extraLast.isPending]);

  const finish = async () => {
    await save({ ended_at: new Date().toISOString() });
    if (!dirty.current) {
      toast('Workout saved. Nice work.');
      navigate('/workouts');
    }
  };

  const onDelete = async () => {
    const ok = await confirm({ title: 'Delete this workout?', body: 'All of its sets will be removed.', confirmLabel: 'Delete workout', danger: true });
    if (!ok) return;
    dirty.current = false;
    window.clearTimeout(timer.current);
    del.mutate(workout.id, {
      onSuccess: () => {
        toast('Workout deleted');
        navigate('/workouts');
      },
      onError: (e) => toast(errorMessage(e), 'error'),
    });
  };

  const exName = (id: string) => exercises.data?.find((e) => e.id === id);
  const allLast = [...(last.data ?? []), ...(extraLast.data ?? [])];

  if (!items) return <CardSkeleton lines={6} />;

  return (
    <div className={cn('space-y-4', restEndsAt != null && 'pb-16')}>
      <div className="flex items-center justify-between gap-2">
        <Link to="/workouts" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Workouts
        </Link>
        <span className="text-xs text-muted" aria-live="polite">
          {status === 'saving' ? 'Saving…' : status === 'pending' ? 'Unsaved changes…' : status === 'error' ? 'Not saved' : 'All changes saved'}
        </span>
      </div>
      <header>
        <h1 className="text-2xl">{workout.name}</h1>
        <p className="text-sm text-muted">
          {formatISODate(workout.day, profile.date_format)} · weights in {units}
          {workout.ended_at && ' · finished'}
        </p>
      </header>
      {saveError && (
        <FormMessage tone="error">
          {saveError}{' '}
          <button type="button" className="underline" onClick={() => void save()}>
            Try again
          </button>
        </FormMessage>
      )}

      {items.length === 0 && (
        <p className="card text-center text-muted">No exercises yet. Add one to start logging sets.</p>
      )}

      {items.map((ex, ei) => {
        const info = exName(ex.exercise_id);
        const prev = allLast.filter((l) => l.exercise_id === ex.exercise_id);
        const suggestion = ex.rep_max
          ? overloadSuggestion(prev.map((p) => ({ weight_kg: Number(p.weight_kg), reps: p.reps })), ex.rep_max, Number(profile.overload_increment), units)
          : { kind: 'none' as const };
        return (
          <section key={`${ex.exercise_id}-${ei}`} className="card space-y-3" aria-label={info?.name ?? 'Exercise'}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base">{info?.name ?? 'Exercise'}</h2>
                <p className="text-xs text-muted">
                  {info && MUSCLE_LABELS[info.muscle_group]}
                  {ex.rep_min && ex.rep_max && ` · ${ex.rep_min}–${ex.rep_max} reps`}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {prev.length
                    ? `Last time (${formatISODate(prev[0].day, 'd MMM')}): ${prev.map((p) => `${formatWeight(Number(p.weight_kg), units)}×${p.reps}`).join(', ')}`
                    : 'First time logging this exercise.'}
                </p>
              </div>
              <IconButton label={`Remove ${info?.name ?? 'exercise'}`} onClick={() => mutate((list) => list.filter((_, i) => i !== ei))}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            {suggestion.kind !== 'none' && (
              <div className="flex items-start gap-2 rounded-input bg-clay-soft/70 px-3 py-2 text-sm">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-clay-ink" aria-hidden />
                <div className="flex-1">
                  {suggestion.kind === 'increase' ? (
                    <>Try {formatWeight(suggestion.weight_kg, units)} {units}. {suggestion.reason}</>
                  ) : (
                    <>Stay at {formatWeight(suggestion.weight_kg, units)} {units}. {suggestion.reason}</>
                  )}
                </div>
                {suggestion.kind === 'increase' && (
                  <button
                    type="button"
                    className="shrink-0 font-medium text-clay-ink underline"
                    onClick={() =>
                      mutate((list) =>
                        list.map((e, i) =>
                          i !== ei ? e : { ...e, sets: e.sets.map((s) => (s.done || s.warmup ? s : { ...s, weight: formatWeight(suggestion.weight_kg, units) })) },
                        ),
                      )
                    }
                  >
                    Use it
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-[2rem_1fr_auto_1fr_3rem_2rem] items-center gap-x-2 gap-y-2 text-sm">
              <span className="text-xs text-muted">Set</span>
              <span className="text-xs text-muted">{units}</span>
              <span />
              <span className="text-xs text-muted">Reps</span>
              <span className="text-center text-xs text-muted">Done</span>
              <span />
              {ex.sets.map((s, si) => (
                <SetRow
                  key={si}
                  index={si}
                  set={s}
                  onChange={(patch) => updateSet(ei, si, patch)}
                  onDone={() => {
                    updateSet(ei, si, { done: !s.done });
                    if (!s.done) setRestEndsAt(Date.now() + DEFAULT_REST_S * 1000);
                  }}
                  onRemove={() => mutate((list) => list.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) })))}
                />
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                mutate((list) =>
                  list.map((e, i) => {
                    if (i !== ei) return e;
                    const lastSet = e.sets[e.sets.length - 1];
                    return { ...e, sets: [...e.sets, { weight: lastSet?.weight ?? '', reps: lastSet?.reps ?? '', done: false, warmup: false }] };
                  }),
                )
              }
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add set
            </Button>
          </section>
        );
      })}

      <Button variant="secondary" block onClick={() => setPicker(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        Add exercise
      </Button>
      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        exclude={items.map((e) => e.exercise_id)}
        onPick={(id) => setExtraIds((ids) => [...ids, id])}
      />

      <div className="flex flex-wrap gap-2 pt-2">
        <Button size="lg" onClick={() => void finish()} loading={status === 'saving'}>
          <Check className="h-5 w-5" aria-hidden />
          {workout.ended_at ? 'Save and close' : 'Finish workout'}
        </Button>
        <Button variant="ghost" className="text-danger" onClick={() => void onDelete()}>
          <Trash2 className="h-4 w-4" aria-hidden />
          Delete
        </Button>
      </div>

      <RestTimer endsAt={restEndsAt} onChange={setRestEndsAt} />
    </div>
  );
}

function SetRow({
  index,
  set,
  onChange,
  onDone,
  onRemove,
}: {
  index: number;
  set: LogSet;
  onChange: (p: Partial<LogSet>) => void;
  onDone: () => void;
  onRemove: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className={cn('text-center font-medium', set.warmup ? 'text-amber-ink' : 'text-muted')}
        onClick={() => onChange({ warmup: !set.warmup })}
        aria-label={`Set ${index + 1}${set.warmup ? ', warm-up' : ''}. Tap to toggle warm-up.`}
        title="Tap to mark as warm-up"
      >
        {set.warmup ? 'W' : index + 1}
      </button>
      <input
        inputMode="decimal"
        aria-label={`Set ${index + 1} weight`}
        value={set.weight}
        onChange={(e) => onChange({ weight: e.target.value.replace(/[^\d.]/g, '') })}
        className={cn('input py-2 text-center tabular-nums', set.done && 'bg-accent-soft')}
        placeholder="0"
      />
      <span className="text-muted" aria-hidden>
        ×
      </span>
      <input
        inputMode="numeric"
        aria-label={`Set ${index + 1} reps`}
        value={set.reps}
        onChange={(e) => onChange({ reps: e.target.value.replace(/\D/g, '') })}
        className={cn('input py-2 text-center tabular-nums', set.done && 'bg-accent-soft')}
        placeholder="0"
      />
      <button
        type="button"
        role="checkbox"
        aria-checked={set.done}
        aria-label={`Set ${index + 1} done`}
        onClick={onDone}
        className={cn(
          'mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
          set.done ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-bg',
        )}
      >
        {set.done && <Check className="h-5 w-5" strokeWidth={3} aria-hidden />}
      </button>
      <IconButton label={`Remove set ${index + 1}`} onClick={onRemove} className="h-8 w-8">
        <X className="h-3.5 w-3.5" />
      </IconButton>
    </>
  );
}

export function WorkoutLoggerPage() {
  const { id } = useParams();
  const q = useWorkout(id);
  const templateExercises = useTemplateExercises();
  if (q.isPending || templateExercises.isPending) return <CardSkeleton lines={8} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (templateExercises.isError) return <ErrorState error={templateExercises.error} onRetry={() => void templateExercises.refetch()} />;
  if (!q.data) return <ErrorState error="This workout doesn't exist any more." />;
  const rows = templateExercises.data.filter((t) => t.template_id === q.data!.workout.template_id);
  return <Logger key={q.data.workout.id} workout={q.data.workout} initial={q.data.sets} templateRows={rows} />;
}
