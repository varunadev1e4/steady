import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { fetchAll, unwrap, unwrapMaybe } from '@/lib/supabase/unwrap';
import { assertOnline } from '@/lib/online';
import type {
  BodyMeasurementRow,
  CardioRow,
  Equipment,
  Json,
  MuscleGroup,
  WorkoutRow,
  WorkoutSetRow,
} from '@/types/database';
import type { ISODate } from '@/utils/dates';

export const workoutKeys = {
  exercises: ['exercises'] as const,
  templates: ['workout_templates'] as const,
  templateExercises: ['template_exercises'] as const,
  workouts: ['workouts'] as const,
  workout: (id: string) => ['workouts', 'one', id] as const,
  range: (from: ISODate, to: ISODate) => ['workouts', 'range', from, to] as const,
  recent: ['workouts', 'recent'] as const,
  lastSets: (ids: string[], exclude?: string) => ['workouts', 'last_sets', ids, exclude] as const,
  exerciseHistory: (id: string) => ['workouts', 'history', id] as const,
  cardio: ['cardio_entries'] as const,
  measurements: ['body_measurements'] as const,
};

const invalidateWorkouts = (qc: ReturnType<typeof useQueryClient>) =>
  void qc.invalidateQueries({ queryKey: workoutKeys.workouts });

/* ------------------------------------------------------------ library -- */

export function useExercises() {
  return useQuery({
    queryKey: workoutKeys.exercises,
    queryFn: async () => unwrap(await supabase.from('exercises').select('*').order('name')),
    staleTime: 5 * 60_000,
  });
}

export function useSaveExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id?: string; name: string; muscle_group: MuscleGroup; equipment: Equipment }) => {
      assertOnline();
      const { id, ...input } = v;
      if (id) return unwrap(await supabase.from('exercises').update(input).eq('id', id).select('*').single());
      return unwrap(await supabase.from('exercises').insert({ ...input, is_custom: true }).select('*').single());
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: workoutKeys.exercises }),
  });
}

export function useArchiveExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      assertOnline();
      unwrap(await supabase.from('exercises').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: workoutKeys.exercises }),
  });
}

export function useDeleteExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      const res = await supabase.from('exercises').delete().eq('id', id);
      if (res.error?.code === '23503') {
        throw new Error('This exercise has logged sets, so it can only be archived (its history is kept).');
      }
      unwrap(res);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: workoutKeys.exercises }),
  });
}

/* ---------------------------------------------------------- templates -- */

export function useTemplates() {
  return useQuery({
    queryKey: workoutKeys.templates,
    queryFn: async () => unwrap(await supabase.from('workout_templates').select('*').order('sort_order').order('name')),
  });
}

export function useTemplateExercises() {
  return useQuery({
    queryKey: workoutKeys.templateExercises,
    queryFn: async () => unwrap(await supabase.from('template_exercises').select('*').order('position')),
  });
}

export interface TemplateInput {
  id?: string;
  name: string;
  notes: string | null;
  weekdays: number[];
  exercises: Array<{ exercise_id: string; target_sets: number; rep_min: number; rep_max: number }>;
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ exercises, ...template }: TemplateInput) => {
      assertOnline();
      return unwrap(
        await supabase.rpc('save_template', {
          p_template: template as unknown as Json,
          p_exercises: exercises as unknown as Json,
        }),
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: workoutKeys.templates });
      void qc.invalidateQueries({ queryKey: workoutKeys.templateExercises });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('workout_templates').delete().eq('id', id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: workoutKeys.templates }),
  });
}

/* ----------------------------------------------------------- workouts -- */

export function useWorkoutsInRange(from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: workoutKeys.range(from, to),
    queryFn: async () =>
      unwrap(
        await supabase.from('workouts').select('*').gte('day', from).lte('day', to).order('day', { ascending: false }),
      ),
  });
}

export function useRecentWorkouts(limit = 30) {
  return useQuery({
    queryKey: workoutKeys.recent,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('workouts')
          .select('*')
          .order('day', { ascending: false })
          .order('started_at', { ascending: false })
          .limit(limit),
      ),
  });
}

export function useWorkout(id: string | undefined) {
  return useQuery({
    queryKey: workoutKeys.workout(id ?? 'none'),
    enabled: Boolean(id),
    queryFn: async () => {
      const workout = unwrapMaybe(await supabase.from('workouts').select('*').eq('id', id!).maybeSingle());
      if (!workout) return null;
      const sets = unwrap(
        await supabase.from('workout_sets').select('*').eq('workout_id', id!).order('exercise_position').order('set_number'),
      );
      return { workout, sets };
    },
    staleTime: Infinity, // the logger owns this data while open
  });
}

/** Sets for a list of workouts (for weekly volume). */
export function useSetsForWorkouts(workoutIds: string[]) {
  return useQuery({
    queryKey: ['workouts', 'sets', workoutIds],
    enabled: workoutIds.length > 0,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('workout_sets')
          .select('workout_id, exercise_id, completed, is_warmup, weight_kg, reps')
          .in('workout_id', workoutIds),
      ),
  });
}

export function useLastSets(exerciseIds: string[], exclude?: string) {
  return useQuery({
    queryKey: workoutKeys.lastSets(exerciseIds, exclude),
    enabled: exerciseIds.length > 0,
    queryFn: async () =>
      unwrap(await supabase.rpc('last_sets', { p_exercise_ids: exerciseIds, p_exclude: exclude ?? null })),
  });
}

export function useExerciseHistory(exerciseId: string | undefined) {
  return useQuery({
    queryKey: workoutKeys.exerciseHistory(exerciseId ?? 'none'),
    enabled: Boolean(exerciseId),
    queryFn: async () => {
      const sets = await fetchAll<Pick<WorkoutSetRow, 'workout_id' | 'weight_kg' | 'reps' | 'completed' | 'is_warmup'>>(
        (from, to) =>
          supabase
            .from('workout_sets')
            .select('workout_id, weight_kg, reps, completed, is_warmup')
            .eq('exercise_id', exerciseId!)
            .range(from, to),
      );
      const ids = [...new Set(sets.map((s) => s.workout_id))];
      const days = new Map<string, string>();
      for (let i = 0; i < ids.length; i += 150) {
        const rows = unwrap(await supabase.from('workouts').select('id, day').in('id', ids.slice(i, i + 150)));
        for (const r of rows) days.set(r.id, r.day);
      }
      return sets
        .filter((s) => s.completed && !s.is_warmup && days.has(s.workout_id))
        .map((s) => ({ day: days.get(s.workout_id)!, weight_kg: Number(s.weight_kg), reps: s.reps }))
        .sort((a, b) => a.day.localeCompare(b.day));
    },
  });
}

export interface SetInput {
  exercise_id: string;
  exercise_position: number;
  set_number: number;
  weight_kg: number;
  reps: number;
  is_warmup: boolean;
  completed: boolean;
}

export async function saveWorkout(
  workout: Partial<Pick<WorkoutRow, 'id' | 'day' | 'template_id' | 'name' | 'started_at' | 'ended_at' | 'notes'>>,
  sets: SetInput[],
): Promise<string> {
  assertOnline();
  return unwrap(
    await supabase.rpc('save_workout', { p_workout: workout as unknown as Json, p_sets: sets as unknown as Json }),
  );
}

export function useStartWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (w: { day: ISODate; template_id: string | null; name: string }) =>
      saveWorkout({ ...w, started_at: new Date().toISOString() }, []),
    onSuccess: () => invalidateWorkouts(qc),
  });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('workouts').delete().eq('id', id));
    },
    onSuccess: () => invalidateWorkouts(qc),
  });
}

/* ------------------------------------------------------------- cardio -- */

export function useCardio(from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: [...workoutKeys.cardio, from, to],
    queryFn: async () =>
      unwrap(
        await supabase.from('cardio_entries').select('*').gte('day', from).lte('day', to).order('day', { ascending: false }),
      ),
  });
}

export function useAddCardio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Pick<CardioRow, 'day' | 'activity' | 'duration_min' | 'distance_km' | 'notes'>) => {
      assertOnline();
      return unwrap(await supabase.from('cardio_entries').insert(v).select('*').single());
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: workoutKeys.cardio }),
  });
}

export function useDeleteCardio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('cardio_entries').delete().eq('id', id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: workoutKeys.cardio }),
  });
}

/* ------------------------------------------------------- measurements -- */

export function useMeasurements() {
  return useQuery({
    queryKey: workoutKeys.measurements,
    queryFn: async () =>
      unwrap(await supabase.from('body_measurements').select('*').order('day', { ascending: false }).limit(400)),
  });
}

export type MeasurementInput = Omit<BodyMeasurementRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export function useSaveMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: MeasurementInput) => {
      assertOnline();
      return unwrap(
        await supabase.from('body_measurements').upsert(v, { onConflict: 'user_id,day' }).select('*').single(),
      );
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: workoutKeys.measurements }),
  });
}

export function useDeleteMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('body_measurements').delete().eq('id', id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: workoutKeys.measurements }),
  });
}
