import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { fetchAll, unwrap } from '@/lib/supabase/unwrap';
import { assertOnline } from '@/lib/online';
import type { HabitCompletionRow, HabitRow } from '@/types/database';
import type { ISODate } from '@/utils/dates';

export const habitKeys = {
  habits: ['habits'] as const,
  completions: ['habit_completions'] as const,
};

export function useHabits() {
  return useQuery({
    queryKey: habitKeys.habits,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('habits')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
      ),
  });
}

type Completion = Pick<HabitCompletionRow, 'habit_id' | 'day'>;

/** All completions (one small row per tick), so streaks can use full history. */
export function useCompletions() {
  return useQuery({
    queryKey: habitKeys.completions,
    queryFn: () =>
      fetchAll<Completion>((from, to) =>
        supabase.from('habit_completions').select('habit_id, day').order('day').range(from, to),
      ),
  });
}

/** Completions grouped by habit id. */
export function useCompletionMap(rows: Completion[] | undefined): Map<string, Set<ISODate>> {
  return useMemo(() => {
    const m = new Map<string, Set<ISODate>>();
    for (const r of rows ?? []) {
      let s = m.get(r.habit_id);
      if (!s) m.set(r.habit_id, (s = new Set()));
      s.add(r.day);
    }
    return m;
  }, [rows]);
}

/** Tick or untick a day. Optimistic, with rollback if the save fails. */
export function useToggleCompletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ habitId, day, done }: { habitId: string; day: ISODate; done: boolean }) => {
      assertOnline();
      if (done) {
        const res = await supabase.from('habit_completions').insert({ habit_id: habitId, day });
        // Already ticked (e.g. on another device) is fine.
        if (res.error && res.error.code !== '23505') throw res.error;
      } else {
        unwrap(await supabase.from('habit_completions').delete().eq('habit_id', habitId).eq('day', day));
      }
    },
    onMutate: async ({ habitId, day, done }) => {
      await qc.cancelQueries({ queryKey: habitKeys.completions });
      const previous = qc.getQueryData<Completion[]>(habitKeys.completions);
      qc.setQueryData<Completion[]>(habitKeys.completions, (old = []) =>
        done
          ? [...old, { habit_id: habitId, day }]
          : old.filter((c) => !(c.habit_id === habitId && c.day === day)),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(habitKeys.completions, ctx?.previous);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: habitKeys.completions }),
  });
}

export type HabitInput = Pick<
  HabitRow,
  'name' | 'icon' | 'color' | 'frequency' | 'weekdays' | 'times_per_week' | 'target_time' | 'grace_enabled'
> & { start_date?: ISODate };

export function useSaveHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: HabitInput }) => {
      assertOnline();
      if (id) return unwrap(await supabase.from('habits').update(input).eq('id', id).select('*').single());
      return unwrap(await supabase.from('habits').insert(input).select('*').single());
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: habitKeys.habits }),
  });
}

/** Adds several habits in one request (habit ideas). */
export function useAddHabits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inputs: HabitInput[]) => {
      assertOnline();
      return unwrap(await supabase.from('habits').insert(inputs).select('*'));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: habitKeys.habits }),
  });
}

export function useArchiveHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      assertOnline();
      unwrap(
        await supabase
          .from('habits')
          .update({ archived_at: archived ? new Date().toISOString() : null })
          .eq('id', id),
      );
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: habitKeys.habits }),
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('habits').delete().eq('id', id));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: habitKeys.habits });
      void qc.invalidateQueries({ queryKey: habitKeys.completions });
    },
  });
}
