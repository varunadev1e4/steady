import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { unwrap, unwrapMaybe } from '@/lib/supabase/unwrap';
import { assertOnline } from '@/lib/online';
import type { CheckInRow } from '@/types/database';
import type { ISODate } from '@/utils/dates';

export const checkInKeys = {
  all: ['check_ins'] as const,
  day: (day: ISODate) => ['check_ins', 'day', day] as const,
  range: (from: ISODate, to: ISODate) => ['check_ins', 'range', from, to] as const,
};

export function useCheckIn(day: ISODate) {
  return useQuery({
    queryKey: checkInKeys.day(day),
    queryFn: async () => unwrapMaybe(await supabase.from('check_ins').select('*').eq('day', day).maybeSingle()),
  });
}

export function useCheckInRange(from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: checkInKeys.range(from, to),
    queryFn: async () =>
      unwrap(
        await supabase.from('check_ins').select('*').gte('day', from).lte('day', to).order('day', { ascending: true }),
      ),
  });
}

export type CheckInValues = Pick<
  CheckInRow,
  'mood' | 'energy' | 'stress' | 'sleep_hours' | 'sleep_quality' | 'water_glasses' | 'note'
> &
  Partial<Pick<CheckInRow, 'bedtime' | 'wake_time'>>;

export function useSaveCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ day, values }: { day: ISODate; values: CheckInValues }) => {
      assertOnline();
      return unwrap(
        await supabase
          .from('check_ins')
          .upsert({ day, ...values }, { onConflict: 'user_id,day' })
          .select('*')
          .single(),
      );
    },
    onSuccess: (row) => {
      qc.setQueryData(checkInKeys.day(row.day), row);
      void qc.invalidateQueries({ queryKey: checkInKeys.all });
    },
  });
}

/** Saves the step count for a day (typed in from the phone's step counter). */
export function useSetSteps() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ day, steps }: { day: ISODate; steps: number | null }) => {
      assertOnline();
      return unwrap(
        await supabase.from('check_ins').upsert({ day, steps }, { onConflict: 'user_id,day' }).select('*').single(),
      );
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: checkInKeys.all }),
  });
}

/**
 * Sets the water count for a day. Optimistic: the number changes instantly
 * and rolls back if the save fails.
 */
export function useSetWater() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ day, glasses }: { day: ISODate; glasses: number }) => {
      assertOnline();
      return unwrap(
        await supabase
          .from('check_ins')
          .upsert({ day, water_glasses: glasses }, { onConflict: 'user_id,day' })
          .select('*')
          .single(),
      );
    },
    onMutate: async ({ day, glasses }) => {
      const key = checkInKeys.day(day);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<CheckInRow | null>(key);
      qc.setQueryData<CheckInRow | null>(key, (old) =>
        old ? { ...old, water_glasses: glasses } : ({ day, water_glasses: glasses } as CheckInRow),
      );
      return { previous, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: checkInKeys.all });
    },
  });
}
