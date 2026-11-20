import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { fetchAll, unwrap } from '@/lib/supabase/unwrap';
import { assertOnline } from '@/lib/online';
import type { GoalRow } from '@/types/database';
import type { ActivityData } from './logic';

export const goalKeys = { all: ['goals'] as const, activity: ['goals', 'activity'] as const };

export function useGoals() {
  return useQuery({
    queryKey: goalKeys.all,
    queryFn: async () => unwrap(await supabase.from('goals').select('*').order('created_at')) as GoalRow[],
  });
}

/** Everything goals and milestones need, from the user's own logs. */
export function useActivityData() {
  return useQuery({
    queryKey: goalKeys.activity,
    queryFn: async (): Promise<ActivityData> => {
      const [cardio, workouts, checkIns, journal, weight] = await Promise.all([
        fetchAll<ActivityData['cardio'][number]>((f, t) => supabase.from('cardio_entries').select('day, duration_min, activity').range(f, t)),
        fetchAll<ActivityData['workouts'][number]>((f, t) => supabase.from('workouts').select('day, started_at, ended_at').range(f, t)),
        fetchAll<ActivityData['checkIns'][number]>((f, t) => supabase.from('check_ins').select('day, mood, steps').range(f, t)),
        fetchAll<{ day: string }>((f, t) => supabase.from('journal_entries').select('day').range(f, t)),
        supabase.from('body_measurements').select('weight_kg').not('weight_kg', 'is', null).order('day', { ascending: false }).limit(1),
      ]);
      const w = unwrap(weight)[0]?.weight_kg;
      return { cardio, workouts, checkIns, journalDays: journal.map((j) => j.day), latestWeightKg: w == null ? null : Number(w) };
    },
    staleTime: 60_000,
  });
}

export type GoalInput = Pick<GoalRow, 'title' | 'kind' | 'target' | 'start_value' | 'current_value' | 'unit' | 'due_date'>;

export function useSaveGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: Partial<GoalInput> & { archived_at?: string | null; achieved_at?: string | null } }) => {
      assertOnline();
      if (id) return unwrap(await supabase.from('goals').update(input).eq('id', id).select('*').single());
      return unwrap(await supabase.from('goals').insert(input as GoalInput).select('*').single());
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: goalKeys.all }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('goals').delete().eq('id', id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: goalKeys.all }),
  });
}
